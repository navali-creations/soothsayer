use crate::poe_process::PoeProcess;

pub(crate) struct ParentProcessGuard;

impl ParentProcessGuard {
    pub(crate) fn is_parent_running(&self) -> bool {
        true
    }
}

pub(crate) fn set_process_title(_title: &str) {}

pub(crate) fn watch_parent_process(parent_process_id: u32) -> Result<ParentProcessGuard, String> {
    if parent_process_id == 0 {
        return Err("Parent process id must be greater than 0".to_owned());
    }

    Ok(ParentProcessGuard)
}

pub(crate) fn enumerate_poe_processes() -> Result<Vec<PoeProcess>, String> {
    Ok(Vec::new())
}
