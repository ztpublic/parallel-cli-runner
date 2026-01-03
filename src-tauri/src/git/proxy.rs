use std::process::Command;

#[cfg(target_os = "macos")]
fn get_proxy_url() -> Option<(String, String)> {
    if let Ok(output) = Command::new("scutil").arg("--proxy").output() {
        let s = String::from_utf8_lossy(&output.stdout);

        let mut http_enabled = false;
        let mut http_host = String::new();
        let mut http_port = String::new();

        let mut socks_enabled = false;
        let mut socks_host = String::new();
        let mut socks_port = String::new();

        let bypass = String::new();

        for line in s.lines() {
            let line = line.trim();
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim();
                let value = value.trim();
                match key {
                    "HTTPEnable" => {
                        if value == "1" {
                            http_enabled = true;
                        }
                    }
                    "HTTPProxy" => http_host = value.to_string(),
                    "HTTPPort" => http_port = value.to_string(),
                    "SOCKSEnable" => {
                        if value == "1" {
                            socks_enabled = true;
                        }
                    }
                    "SOCKSProxy" => socks_host = value.to_string(),
                    "SOCKSPort" => socks_port = value.to_string(),
                    "ExceptionsList" => {
                        // scutil output for list is complex, usually spans lines.
                        // For simplicity, we might skip parsing complex bypass list from scutil
                        // and rely on sysproxy if needed, or just ignore for now as the issue is CONNECT.
                    }
                    _ => {}
                }
            }
        }

        // Prefer HTTP
        if http_enabled && !http_host.is_empty() && !http_port.is_empty() {
            return Some((format!("http://{}:{}", http_host, http_port), bypass));
        }
        if socks_enabled && !socks_host.is_empty() && !socks_port.is_empty() {
            return Some((
                format!("socks5://{}:{}", socks_host, socks_port),
                bypass,
            ));
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn get_proxy_url() -> Option<(String, String)> {
    if let Ok(proxy) = sysproxy::Sysproxy::get_system_proxy() {
        if proxy.enable {
            let host = proxy.host;
            let port = proxy.port;
            let url = if host.contains("://") {
                format!("{}:{}", host, port)
            } else {
                format!("http://{}:{}", host, port)
            };
            return Some((url, proxy.bypass));
        }
    }
    None
}

pub fn configure_proxy(cmd: &mut Command) -> Option<String> {
    let detected_proxy = get_proxy_url();
    if let Some((proxy_url, bypass)) = &detected_proxy {
        cmd.env("http_proxy", proxy_url);
        cmd.env("https_proxy", proxy_url);
        cmd.env("HTTP_PROXY", proxy_url);
        cmd.env("HTTPS_PROXY", proxy_url);

        if !bypass.is_empty() {
            cmd.env("no_proxy", bypass);
            cmd.env("NO_PROXY", bypass);
        }
        return Some(proxy_url.clone());
    }
    None
}
