use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use x11rb::connection::Connection;
use x11rb::protocol::xproto::{Atom, AtomEnum, ConnectionExt as _, Window};

use crate::linux_process::{
    canonical_name_from_cmdline, canonical_name_from_comm, parse_proc_stat_start_time,
};
use crate::poe_process::{
    detect_poe_game_from_window_title, is_known_poe_window_title_length, PoeProcess,
};

const MAX_CLIENT_WINDOWS: usize = 4_096;
const MAX_WINDOW_TITLE_PROPERTY_LONGS: u32 = 260;
const PROCESS_COMM_MAX_BYTES: usize = 15;

pub(crate) struct ParentProcessGuard {
    stat_path: PathBuf,
    start_time: u64,
}

impl ParentProcessGuard {
    pub(crate) fn is_parent_running(&self) -> bool {
        read_process_start_time(&self.stat_path) == Some(self.start_time)
    }
}

struct Atoms {
    net_client_list: Atom,
    net_client_list_stacking: Atom,
    net_wm_name: Atom,
    net_wm_pid: Atom,
    utf8_string: Atom,
}

pub(crate) fn set_process_title(title: &str) {
    let mut end = title.len().min(PROCESS_COMM_MAX_BYTES);
    while !title.is_char_boundary(end) {
        end -= 1;
    }

    let _ = fs::write("/proc/self/comm", &title[..end]);
}

pub(crate) fn watch_parent_process(parent_process_id: u32) -> Result<ParentProcessGuard, String> {
    if parent_process_id == 0 {
        return Err("Parent process id must be greater than 0".to_owned());
    }

    let stat_path = PathBuf::from(format!("/proc/{parent_process_id}/stat"));
    let start_time = read_process_start_time(&stat_path).ok_or_else(|| {
        format!("Parent process watch failed for PID {parent_process_id}: process not found")
    })?;

    Ok(ParentProcessGuard {
        stat_path,
        start_time,
    })
}

pub(crate) fn enumerate_poe_processes() -> Result<Vec<PoeProcess>, String> {
    let mut processes = enumerate_matching_processes()?;
    if processes.is_empty() {
        return Ok(processes);
    }

    let process_ids = processes.iter().map(|process| process.pid).collect();
    let titles_by_pid = enumerate_window_titles_by_pid(&process_ids)
        .map_err(|error| format!("Linux PoE window classification is unavailable: {error}"))?;
    apply_window_titles(&mut processes, &titles_by_pid);

    Ok(processes)
}

fn enumerate_matching_processes() -> Result<Vec<PoeProcess>, String> {
    let entries = fs::read_dir("/proc")
        .map_err(|error| format!("Failed to enumerate Linux processes: {error}"))?;
    let mut processes = Vec::new();

    for entry in entries.flatten() {
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|value| value.parse::<u32>().ok())
        else {
            continue;
        };

        let process_dir = entry.path();
        let process_name = fs::read_to_string(process_dir.join("comm"))
            .ok()
            .and_then(|comm| canonical_name_from_comm(&comm))
            .or_else(|| {
                fs::read(process_dir.join("cmdline"))
                    .ok()
                    .and_then(|cmdline| canonical_name_from_cmdline(&cmdline))
            });

        if let Some(process_name) = process_name {
            processes.push(PoeProcess {
                pid,
                process_name: process_name.to_owned(),
                window_title: String::new(),
                game: None,
            });
        }
    }

    processes.sort_unstable_by_key(|process| process.pid);
    Ok(processes)
}

fn enumerate_window_titles_by_pid(
    process_ids: &HashSet<u32>,
) -> Result<HashMap<u32, Vec<String>>, String> {
    let (connection, screen_number) =
        x11rb::connect(None).map_err(|error| format!("X11 connection failed: {error}"))?;
    let root = connection
        .setup()
        .roots
        .get(screen_number)
        .ok_or_else(|| "X11 default screen is unavailable".to_owned())?
        .root;
    let atoms = Atoms::load(&connection)?;
    let windows = enumerate_client_windows(&connection, root, &atoms);
    let mut titles_by_pid = HashMap::<u32, Vec<String>>::new();

    for window in windows {
        let Some(pid) = read_window_pid(&connection, window, atoms.net_wm_pid) else {
            continue;
        };
        if !process_ids.contains(&pid) {
            continue;
        }

        let Some(title) = read_window_title(&connection, window, &atoms) else {
            continue;
        };
        if title.is_empty() {
            continue;
        }

        titles_by_pid.entry(pid).or_default().push(title);
    }

    Ok(titles_by_pid)
}

fn enumerate_client_windows<C: Connection>(
    connection: &C,
    root: Window,
    atoms: &Atoms,
) -> Vec<Window> {
    let mut windows = read_window_list(connection, root, atoms.net_client_list);
    if windows.is_empty() {
        windows = read_window_list(connection, root, atoms.net_client_list_stacking);
    }
    if !windows.is_empty() {
        return windows;
    }

    enumerate_window_tree(connection, root)
}

fn enumerate_window_tree<C: Connection>(connection: &C, root: Window) -> Vec<Window> {
    let mut windows = Vec::new();
    let mut pending = vec![root];
    let mut seen = HashSet::from([root]);

    while let Some(window) = pending.pop() {
        let Some(children) = connection
            .query_tree(window)
            .ok()
            .and_then(|cookie| cookie.reply().ok())
            .map(|reply| reply.children)
        else {
            continue;
        };

        for child in children {
            if !seen.insert(child) {
                continue;
            }
            windows.push(child);
            if windows.len() >= MAX_CLIENT_WINDOWS {
                return windows;
            }
            pending.push(child);
        }
    }

    windows
}

fn read_window_list<C: Connection>(connection: &C, root: Window, property: Atom) -> Vec<Window> {
    read_u32_property(
        connection,
        root,
        property,
        AtomEnum::WINDOW.into(),
        MAX_CLIENT_WINDOWS as u32,
    )
    .unwrap_or_default()
}

fn read_window_pid<C: Connection>(connection: &C, window: Window, property: Atom) -> Option<u32> {
    read_u32_property(connection, window, property, AtomEnum::CARDINAL.into(), 1)?
        .into_iter()
        .next()
        .filter(|pid| *pid > 0)
}

fn read_u32_property<C: Connection>(
    connection: &C,
    window: Window,
    property: Atom,
    property_type: Atom,
    max_items: u32,
) -> Option<Vec<u32>> {
    connection
        .get_property(false, window, property, property_type, 0, max_items)
        .ok()?
        .reply()
        .ok()?
        .value32()
        .map(Iterator::collect)
}

fn read_window_title<C: Connection>(
    connection: &C,
    window: Window,
    atoms: &Atoms,
) -> Option<String> {
    read_string_property(connection, window, atoms.net_wm_name, atoms.utf8_string).or_else(|| {
        read_string_property(
            connection,
            window,
            AtomEnum::WM_NAME.into(),
            AtomEnum::STRING.into(),
        )
    })
}

fn read_string_property<C: Connection>(
    connection: &C,
    window: Window,
    property: Atom,
    property_type: Atom,
) -> Option<String> {
    let value = connection
        .get_property(
            false,
            window,
            property,
            property_type,
            0,
            MAX_WINDOW_TITLE_PROPERTY_LONGS,
        )
        .ok()?
        .reply()
        .ok()?
        .value;
    let title = String::from_utf8_lossy(&value)
        .trim_matches('\0')
        .trim()
        .to_owned();

    (!title.is_empty()).then_some(title)
}

fn apply_window_titles(processes: &mut [PoeProcess], titles_by_pid: &HashMap<u32, Vec<String>>) {
    for process in processes {
        let Some(titles) = titles_by_pid.get(&process.pid) else {
            continue;
        };
        let Some(title) = choose_window_title(titles) else {
            continue;
        };

        process.window_title = title.to_owned();
        process.game = detect_poe_game_from_window_title(title);
    }
}

fn choose_window_title(titles: &[String]) -> Option<&str> {
    titles
        .iter()
        .find(|title| {
            is_known_poe_window_title_length(title.trim().len())
                && detect_poe_game_from_window_title(title).is_some()
        })
        .or_else(|| titles.first())
        .map(String::as_str)
}

fn read_process_start_time(path: &Path) -> Option<u64> {
    fs::read_to_string(path)
        .ok()
        .and_then(|stat| parse_proc_stat_start_time(&stat))
}

impl Atoms {
    fn load<C: Connection>(connection: &C) -> Result<Self, String> {
        Ok(Self {
            net_client_list: intern_atom(connection, b"_NET_CLIENT_LIST")?,
            net_client_list_stacking: intern_atom(connection, b"_NET_CLIENT_LIST_STACKING")?,
            net_wm_name: intern_atom(connection, b"_NET_WM_NAME")?,
            net_wm_pid: intern_atom(connection, b"_NET_WM_PID")?,
            utf8_string: intern_atom(connection, b"UTF8_STRING")?,
        })
    }
}

fn intern_atom<C: Connection>(connection: &C, name: &[u8]) -> Result<Atom, String> {
    connection
        .intern_atom(false, name)
        .map_err(|error| format!("Failed to request X11 atom: {error}"))?
        .reply()
        .map(|reply| reply.atom)
        .map_err(|error| format!("Failed to resolve X11 atom: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::poe_process::PoeGame;

    #[test]
    fn applies_only_exact_path_of_exile_titles() {
        let mut processes = vec![PoeProcess {
            pid: 42,
            process_name: "PathOfExileSteam.exe".to_owned(),
            window_title: String::new(),
            game: None,
        }];
        let titles = HashMap::from([(42, vec!["Steam".to_owned(), "Path of Exile 2".to_owned()])]);

        apply_window_titles(&mut processes, &titles);

        assert_eq!(processes[0].window_title, "Path of Exile 2");
        assert_eq!(processes[0].game, Some(PoeGame::Poe2));
    }
}
