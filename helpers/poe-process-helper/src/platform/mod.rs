#[cfg(target_os = "linux")]
mod linux;
#[cfg(not(any(windows, target_os = "linux")))]
mod stub;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "linux")]
pub(crate) use linux::{
    enumerate_poe_processes, set_process_title, watch_parent_process, ParentProcessGuard,
};
#[cfg(not(any(windows, target_os = "linux")))]
pub(crate) use stub::{enumerate_poe_processes, set_process_title, watch_parent_process};
#[cfg(windows)]
pub(crate) use windows::{
    enumerate_poe_processes, set_process_title, watch_parent_process, ParentProcessGuard,
};

#[cfg(not(any(windows, target_os = "linux")))]
pub(crate) use stub::ParentProcessGuard;
