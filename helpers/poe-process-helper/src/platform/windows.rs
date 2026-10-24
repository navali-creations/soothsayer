use std::collections::HashMap;
use std::ffi::c_void;
use std::io;
use std::mem::{size_of, zeroed};
use std::thread;
use std::time::Duration;

use crate::poe_process::{
    canonical_poe_process_name, detect_poe_game_from_window_title,
    is_known_poe_window_title_length, PoeProcess,
};

const PROCESS_SNAPSHOT_RETRIES: usize = 3;
const MAX_PATH: usize = 260;
const TH32CS_SNAPPROCESS: u32 = 0x0000_0002;
const SYNCHRONIZE: u32 = 0x0010_0000;
const WAIT_TIMEOUT: u32 = 0x0000_0102;
const INVALID_HANDLE_VALUE: Handle = !0 as Handle;

type Bool = i32;
type Dword = u32;
type Handle = *mut c_void;
type Hwnd = *mut c_void;
type Lparam = isize;

#[repr(C)]
#[allow(non_snake_case)]
struct ProcessEntry32W {
    dw_size: Dword,
    cnt_usage: Dword,
    th32_process_id: Dword,
    th32_default_heap_id: usize,
    th32_module_id: Dword,
    cnt_threads: Dword,
    th32_parent_process_id: Dword,
    pc_pri_class_base: i32,
    dw_flags: Dword,
    sz_exe_file: [u16; MAX_PATH],
}

type EnumWindowsProc = unsafe extern "system" fn(hwnd: Hwnd, lparam: Lparam) -> Bool;

#[link(name = "kernel32")]
extern "system" {
    fn CloseHandle(handle: Handle) -> Bool;
    fn CreateToolhelp32Snapshot(flags: Dword, process_id: Dword) -> Handle;
    fn Process32FirstW(snapshot: Handle, entry: *mut ProcessEntry32W) -> Bool;
    fn Process32NextW(snapshot: Handle, entry: *mut ProcessEntry32W) -> Bool;
    fn OpenProcess(desired_access: Dword, inherit_handle: Bool, process_id: Dword) -> Handle;
    fn SetConsoleTitleW(title: *const u16) -> Bool;
    fn WaitForSingleObject(handle: Handle, milliseconds: Dword) -> Dword;
}

#[link(name = "user32")]
extern "system" {
    fn EnumWindows(enum_func: Option<EnumWindowsProc>, lparam: Lparam) -> Bool;
    fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max_count: i32) -> i32;
    fn GetWindowThreadProcessId(hwnd: Hwnd, process_id: *mut Dword) -> Dword;
    fn IsWindowVisible(hwnd: Hwnd) -> Bool;
}

struct SnapshotHandle(Handle);

impl Drop for SnapshotHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

pub(crate) struct ParentProcessGuard(Handle);

impl ParentProcessGuard {
    pub(crate) fn is_parent_running(&self) -> bool {
        let wait_result = unsafe { WaitForSingleObject(self.0, 0) };

        wait_result == WAIT_TIMEOUT
    }
}

impl Drop for ParentProcessGuard {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

struct WindowEnumContext {
    titles_by_pid: HashMap<u32, Vec<String>>,
}

pub(crate) fn set_process_title(title: &str) {
    let wide_title = to_wide_null(title);
    unsafe {
        SetConsoleTitleW(wide_title.as_ptr());
    }
}

pub(crate) fn watch_parent_process(parent_process_id: u32) -> Result<ParentProcessGuard, String> {
    if parent_process_id == 0 {
        return Err("Parent process id must be greater than 0".to_owned());
    }

    let handle = unsafe { OpenProcess(SYNCHRONIZE, 0, parent_process_id) };
    if handle.is_null() {
        return Err(format!(
            "Parent process watch failed for PID {}: {}",
            parent_process_id,
            io::Error::last_os_error(),
        ));
    }

    Ok(ParentProcessGuard(handle))
}

pub(crate) fn enumerate_poe_processes() -> Result<Vec<PoeProcess>, String> {
    let mut processes = enumerate_matching_processes()?;
    if processes.is_empty() {
        return Ok(processes);
    }

    let titles_by_pid = enumerate_window_titles_by_pid();
    for process in &mut processes {
        if let Some(titles) = titles_by_pid.get(&process.pid) {
            process.window_title = choose_window_title(titles);
            process.game = detect_poe_game_from_window_title(&process.window_title);
        }
    }

    Ok(processes)
}

fn enumerate_matching_processes() -> Result<Vec<PoeProcess>, String> {
    let snapshot = create_process_snapshot()?;
    let _snapshot_guard = SnapshotHandle(snapshot);
    let mut entry = unsafe { zeroed::<ProcessEntry32W>() };
    entry.dw_size = size_of::<ProcessEntry32W>() as Dword;

    let mut processes = Vec::new();
    let has_first_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    if !has_first_entry {
        return Err(format!(
            "Process32FirstW failed: {}",
            io::Error::last_os_error()
        ));
    }

    loop {
        let process_name = wide_null_to_string(&entry.sz_exe_file);
        if let Some(canonical_name) = canonical_poe_process_name(&process_name) {
            processes.push(PoeProcess {
                pid: entry.th32_process_id,
                process_name: canonical_name.to_owned(),
                window_title: String::new(),
                game: None,
            });
        }

        if unsafe { Process32NextW(snapshot, &mut entry) } == 0 {
            break;
        }
    }

    Ok(processes)
}

fn create_process_snapshot() -> Result<Handle, String> {
    for attempt in 0..PROCESS_SNAPSHOT_RETRIES {
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot != INVALID_HANDLE_VALUE {
            return Ok(snapshot);
        }
        if attempt + 1 < PROCESS_SNAPSHOT_RETRIES {
            thread::sleep(Duration::from_millis(10));
        }
    }

    Err(format!(
        "CreateToolhelp32Snapshot failed: {}",
        io::Error::last_os_error()
    ))
}

fn enumerate_window_titles_by_pid() -> HashMap<u32, Vec<String>> {
    let mut context = WindowEnumContext {
        titles_by_pid: HashMap::new(),
    };

    let ok = unsafe { EnumWindows(Some(enum_window), &mut context as *mut _ as Lparam) };
    if ok == 0 {
        eprintln!("EnumWindows failed: {}", io::Error::last_os_error());
    }

    context.titles_by_pid
}

unsafe extern "system" fn enum_window(hwnd: Hwnd, lparam: Lparam) -> Bool {
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }

    let text_length = GetWindowTextLengthW(hwnd);
    if text_length <= 0 {
        return 1;
    }
    if !is_known_poe_window_title_length(text_length as usize) {
        return 1;
    }

    let mut process_id = 0;
    GetWindowThreadProcessId(hwnd, &mut process_id);
    if process_id == 0 {
        return 1;
    }

    let mut buffer = vec![0u16; text_length as usize + 1];
    let copied = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
    if copied <= 0 {
        return 1;
    }

    let title = String::from_utf16_lossy(&buffer[..copied as usize])
        .trim()
        .to_owned();
    if title.is_empty() {
        return 1;
    }

    let context = &mut *(lparam as *mut WindowEnumContext);
    context
        .titles_by_pid
        .entry(process_id)
        .or_default()
        .push(title);

    1
}

fn choose_window_title(titles: &[String]) -> String {
    titles
        .iter()
        .find(|title| is_path_of_exile_title(title))
        .or_else(|| titles.first())
        .cloned()
        .unwrap_or_default()
}

fn is_path_of_exile_title(title: &str) -> bool {
    detect_poe_game_from_window_title(title).is_some()
}

fn wide_null_to_string(value: &[u16]) -> String {
    let length = value
        .iter()
        .position(|character| *character == 0)
        .unwrap_or(value.len());

    String::from_utf16_lossy(&value[..length])
}

fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_path_of_exile_window_titles() {
        assert_eq!(
            choose_window_title(&["Steam".to_owned(), "Path of Exile 2".to_owned(),]),
            "Path of Exile 2",
        );
    }
}
