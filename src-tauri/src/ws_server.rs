use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use http::StatusCode;
use tokio::net::TcpListener as TokioTcpListener;
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::Message;

use crate::acp::{self, types::AcpEvent};
use crate::pty::PtyManager;
use crate::ws::*;

pub async fn run_ws_server(port: u16, auth_token: String) -> anyhow::Result<()> {
    let listener = TokioTcpListener::bind(("127.0.0.1", port)).await?;
    run_ws_server_on_tokio_listener(listener, auth_token).await
}

pub fn bind_ws_listener(port: u16) -> anyhow::Result<(std::net::TcpListener, u16)> {
    let std_listener = std::net::TcpListener::bind(("127.0.0.1", port))?;
    std_listener.set_nonblocking(true)?;
    let actual_port = std_listener.local_addr()?.port();
    Ok((std_listener, actual_port))
}

pub async fn run_ws_server_on_listener(
    listener: std::net::TcpListener,
    auth_token: String,
) -> anyhow::Result<()> {
    listener.set_nonblocking(true)?;
    let listener = TokioTcpListener::from_std(listener)?;
    run_ws_server_on_tokio_listener(listener, auth_token).await
}

async fn run_ws_server_on_tokio_listener(
    listener: TokioTcpListener,
    auth_token: String,
) -> anyhow::Result<()> {
    let events = tokio::sync::broadcast::channel(256).0;
    let state = WsState {
        manager: PtyManager::default(),
        acp: acp::AcpManager::new(acp_event_sink(events.clone())),
        events,
    };

    loop {
        let (stream, _addr) = listener.accept().await?;
        let state = state.clone();
        let token = auth_token.clone();
        tokio::spawn(async move {
            if let Err(err) = handle_connection(stream, state, token).await {
                tracing::error!("ws connection error: {err}");
            }
        });
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    state: WsState,
    expected_token: String,
) -> anyhow::Result<()> {
    let ws_stream = accept_hdr_async(stream, |req: &Request, resp: Response| {
        if is_authorized(req, &expected_token) {
            Ok(resp)
        } else {
            Err(unauthorized_response())
        }
    })
    .await?;

    let (mut write, mut read) = ws_stream.split();
    let (out_tx, mut out_rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    let mut event_rx = state.events.subscribe();

    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            if write.send(message).await.is_err() {
                break;
            }
        }
    });

    let event_forwarder = {
        let out_tx = out_tx.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                let payload = TransportEvent {
                    kind: "event",
                    event: event.event,
                    payload: event.payload,
                };
                if let Ok(text) = serde_json::to_string(&payload) {
                    if out_tx.send(Message::Text(text.into())).is_err() {
                        break;
                    }
                }
            }
        })
    };

    while let Some(message) = read.next().await {
        let message = match message {
            Ok(message) => message,
            Err(_) => break,
        };

        if let Message::Text(text) = message {
            let Ok(request) = serde_json::from_str::<TransportRequest>(&text) else {
                continue;
            };
            if request.kind != "request" {
                continue;
            }

            let state = state.clone();
            let out_tx = out_tx.clone();
            tokio::spawn(async move {
                let response = match handle_request(request.method, request.params, state).await {
                    Ok(result) => TransportResponse {
                        kind: "response",
                        id: request.id,
                        ok: true,
                        result: Some(result),
                        error: None,
                    },
                    Err(err) => TransportResponse {
                        kind: "response",
                        id: request.id,
                        ok: false,
                        result: None,
                        error: Some(TransportError {
                            message: err.message,
                            code: Some(err.code),
                        }),
                    },
                };

                if let Ok(text) = serde_json::to_string(&response) {
                    let _ = out_tx.send(Message::Text(text.into()));
                }
            });
        }
    }

    drop(out_tx);
    let _ = writer.await;
    let _ = event_forwarder.await;
    Ok(())
}

fn is_authorized(request: &Request, expected_token: &str) -> bool {
    request
        .uri()
        .query()
        .and_then(extract_token)
        .map(|token| token == expected_token)
        .unwrap_or(false)
}

fn extract_token(query: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next()?;
        let value = parts.next().unwrap_or("");
        if key == "token" {
            return Some(value.to_string());
        }
    }
    None
}

fn unauthorized_response() -> ErrorResponse {
    http::Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .body(Some("unauthorized".to_string()))
        .unwrap_or_else(|_| http::Response::new(Some("unauthorized".to_string())))
}

fn acp_event_sink(events: tokio::sync::broadcast::Sender<EventMessage>) -> acp::types::AcpEventSink {
    Arc::new(move |event| match event {
        AcpEvent::SessionUpdate(payload) => emit_event(&events, "acp-session-update", payload),
        AcpEvent::ConnectionState(payload) => emit_event(&events, "acp-session-state", payload),
        AcpEvent::PermissionRequest(payload) => {
            emit_event(&events, "acp-permission-request", payload)
        }
    })
}

fn emit_event<T: serde::Serialize>(
    events: &tokio::sync::broadcast::Sender<EventMessage>,
    event: &str,
    payload: T,
) {
    let Ok(value) = serde_json::to_value(payload) else {
        return;
    };
    let _ = events.send(EventMessage {
        event: event.to_string(),
        payload: value,
    });
}
