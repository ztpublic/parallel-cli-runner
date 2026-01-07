// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logging;

use std::env;

struct WsArgs {
    port: u16,
    auth_token: String,
}

fn main() {
    // Determine mode and initialize logging
    let is_ws_mode = parse_ws_args().is_ok_and(|opt| opt.is_some());

    let _guard = if is_ws_mode {
        // Extension mode: check for custom log directory
        logging::init_extension_logging().or_else(|| logging::init_ws_server_logging())
    } else {
        // Desktop mode: use platform-specific log directory
        logging::init_desktop_logging()
    };

    // Set up panic hook to capture panics to log file
    logging::setup_panic_hook();

    match parse_ws_args() {
        Ok(Some(args)) => {
            let runtime = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("failed to start runtime");
            if let Err(err) = runtime
                .block_on(parallel_cli_runner_lib::ws_server::run_ws_server(
                    args.port,
                    args.auth_token,
                ))
            {
                tracing::error!("ws server failed: {err}");
                std::process::exit(1);
            }
        }
        Ok(None) => {
            parallel_cli_runner_lib::run();
        }
        Err(err) => {
            tracing::error!("{err}");
            std::process::exit(2);
        }
    }
}

fn parse_ws_args() -> Result<Option<WsArgs>, String> {
    let args: Vec<String> = env::args().collect();
    let port = find_arg_value(&args, "--port");
    let token = find_arg_value(&args, "--auth-token");

    if port.is_none() && token.is_none() {
        return Ok(None);
    }

    let port = port.ok_or_else(|| "--port is required when running in ws mode".to_string())?;
    let token =
        token.ok_or_else(|| "--auth-token is required when running in ws mode".to_string())?;

    let port = port
        .parse::<u16>()
        .map_err(|_| format!("invalid --port value: {port}"))?;

    Ok(Some(WsArgs {
        port,
        auth_token: token,
    }))
}

fn find_arg_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .enumerate()
        .find_map(|(idx, arg)| {
            if arg == name {
                return args.get(idx + 1).cloned();
            }
            if let Some(value) = arg.strip_prefix(&format!("{name}=")) {
                return Some(value.to_string());
            }
            None
        })
}
