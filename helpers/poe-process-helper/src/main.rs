//! Native process watcher helper for Soothsayer.
//!
//! Electron spawns this binary and reads line-delimited JSON from stdout. It
//! polls once per second and emits only state changes or a periodic heartbeat.

#[cfg(any(target_os = "linux", test))]
mod linux_process;
mod platform;
mod poe_process;
mod protocol;

use std::process;
use std::thread;
use std::time::{Duration, Instant};

use platform::{
    enumerate_poe_processes, set_process_title, watch_parent_process, ParentProcessGuard,
};
use protocol::{create_error_payload, create_state_payload, write_line, write_state};

const HELPER_TITLE: &str = "Soothsayer PoE Process Watcher";
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_secs(1);
const STOPPED_OBSERVATIONS_BEFORE_EMIT: usize = 2;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let once = args.iter().any(|arg| arg == "--once");
    let title = parse_arg_value(&args, "--title").unwrap_or(HELPER_TITLE);

    set_process_title(title);

    if once {
        write_once();
        return;
    }

    let parent_process = match resolve_parent_process(&args) {
        Ok(process) => process,
        Err(error) => {
            let _ = write_line(&create_error_payload(&error));
            eprintln!("{error}");
            process::exit(1);
        }
    };

    watch_forever(parent_process.as_ref());
}

fn write_once() {
    match enumerate_poe_processes() {
        Ok(processes) => {
            if let Err(error) = write_state(&processes) {
                eprintln!("{error}");
            }
        }
        Err(error) => {
            if let Err(write_error) = write_line(&create_error_payload(&error)) {
                eprintln!("{write_error}");
            }
        }
    }
}

fn watch_forever(parent_process: Option<&ParentProcessGuard>) {
    let mut last_state = String::new();
    let mut next_heartbeat = Instant::now() + HEARTBEAT_INTERVAL;
    let mut stopped_observations = 0usize;

    loop {
        if parent_process.is_some_and(|process| !process.is_parent_running()) {
            return;
        }

        let processes = match enumerate_poe_processes() {
            Ok(processes) => processes,
            Err(error) => {
                let _ = write_line(&create_error_payload(&error));
                return;
            }
        };

        let state = create_state_payload(&processes);
        let is_stopped_state = !processes.iter().any(|process| process.game.is_some());
        let now = Instant::now();

        if !is_stopped_state {
            stopped_observations = 0;
        }

        let should_emit_state = state != last_state
            && (last_state.is_empty() || !is_stopped_state || {
                stopped_observations += 1;
                stopped_observations >= STOPPED_OBSERVATIONS_BEFORE_EMIT
            });

        if should_emit_state {
            if write_line(&state).is_err() {
                return;
            }
            last_state = state;
            stopped_observations = 0;
            next_heartbeat = now + HEARTBEAT_INTERVAL;
        } else if now >= next_heartbeat {
            if write_line(r#"{"type":"heartbeat"}"#).is_err() {
                return;
            }
            next_heartbeat = now + HEARTBEAT_INTERVAL;
        }

        thread::sleep(POLL_INTERVAL);
    }
}

fn parse_arg_value<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.windows(2)
        .find(|window| window[0] == name)
        .map(|window| window[1].as_str())
}

fn parse_process_id(value: &str) -> Option<u32> {
    value
        .parse::<u32>()
        .ok()
        .filter(|process_id| *process_id > 0)
}

fn resolve_parent_process(args: &[String]) -> Result<Option<ParentProcessGuard>, String> {
    let Some(parent_process_id) = parse_arg_value(args, "--parent-pid") else {
        return Ok(None);
    };
    let parent_process_id = parse_process_id(parent_process_id)
        .ok_or_else(|| format!("Invalid parent process id: {parent_process_id}"))?;

    watch_parent_process(parent_process_id).map(Some)
}
