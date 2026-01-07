mod agent_catalog;
mod message_conversion;
mod runtime;

pub mod types;

pub use agent_catalog::AcpAgentCatalog;
pub use message_conversion::{acp_response_to_chunks, ai_messages_to_content_blocks, text_to_content_block, AcpResponseChunk};
pub use runtime::AcpManager;

#[cfg(test)]
mod tests;
