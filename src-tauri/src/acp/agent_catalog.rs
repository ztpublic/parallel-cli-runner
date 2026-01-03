use super::types::AcpAgentConfig;

#[derive(Debug, Default)]
pub struct AcpAgentCatalog {
    agents: Vec<AcpAgentConfig>,
}

impl AcpAgentCatalog {
    pub fn new(agents: Vec<AcpAgentConfig>) -> Self {
        Self { agents }
    }

    pub fn list(&self) -> &[AcpAgentConfig] {
        &self.agents
    }
}
