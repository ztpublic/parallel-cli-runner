mod agent_catalog;
mod message_conversion;
mod runtime;

pub mod types;

pub use agent_catalog::AcpAgentCatalog;
pub use message_conversion::{acp_response_to_chunks, ai_messages_to_content_blocks, text_to_content_block, AcpResponseChunk};
pub use runtime::AcpManager;
use std::path::PathBuf;
use types::AcpAgentConfig;

pub fn normalize_agent_config(mut config: AcpAgentConfig) -> AcpAgentConfig {
    if config.command == "demo" {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let mut example_path = PathBuf::from(manifest_dir)
            .join("target")
            .join("debug")
            .join("examples")
            .join("agent_example");
        if cfg!(windows) {
            example_path.set_extension("exe");
        }

        if example_path.exists() {
            config.command = example_path.to_string_lossy().to_string();
            config.args = Vec::new();
        } else {
            config.command = "cargo".to_string();
            config.args = vec![
                "run".to_string(),
                "--example".to_string(),
                "agent_example".to_string(),
                "--quiet".to_string(),
            ];
        }
        config.cwd = Some(manifest_dir.to_string());
    }
    config
}

#[cfg(test)]
mod tests;
