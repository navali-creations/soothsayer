use crate::poe_process::canonical_poe_process_name;

pub(crate) fn canonical_name_from_comm(comm: &str) -> Option<&'static str> {
    canonical_poe_process_name(comm.trim())
}

pub(crate) fn canonical_name_from_cmdline(cmdline: &[u8]) -> Option<&'static str> {
    cmdline
        .split(|byte| *byte == 0)
        .filter_map(|argument| std::str::from_utf8(argument).ok())
        .filter_map(argument_basename)
        .find_map(canonical_poe_process_name)
}

pub(crate) fn parse_proc_stat_start_time(stat: &str) -> Option<u64> {
    // The second field is parenthesized and may itself contain spaces or ')'.
    // Fields after its final ')' begin at field 3; starttime is field 22.
    stat.rsplit_once(')')?
        .1
        .split_whitespace()
        .nth(19)?
        .parse()
        .ok()
}

fn argument_basename(argument: &str) -> Option<&str> {
    let basename = argument.rsplit(['/', '\\']).next()?.trim();

    (!basename.is_empty()).then_some(basename)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_process_name_from_linux_comm() {
        assert_eq!(
            canonical_name_from_comm("PathOfExile.exe\n"),
            Some("PathOfExile.exe"),
        );
        assert_eq!(canonical_name_from_comm("PathOfExileSte"), None);
    }

    #[test]
    fn resolves_process_name_from_wine_or_proton_command_line() {
        assert_eq!(
            canonical_name_from_cmdline(
                b"/usr/bin/wine\0Z:\\Games\\Path of Exile\\PathOfExileSteam.exe\0",
            ),
            Some("PathOfExileSteam.exe"),
        );
        assert_eq!(
            canonical_name_from_cmdline(b"/games/PathOfExile_KG.exe\0--waitforpreload\0"),
            Some("PathOfExile_KG.exe"),
        );
        assert_eq!(
            canonical_name_from_cmdline(b"/usr/bin/wine\0PathOfExile_x64Steam.exe\0"),
            None,
        );
    }

    #[test]
    fn parses_parent_start_time_from_proc_stat() {
        let mut fields = vec!["S"; 20];
        fields[19] = "987654";
        let stat = format!("123 (parent process) {}", fields.join(" "));

        assert_eq!(parse_proc_stat_start_time(&stat), Some(987654));
        assert_eq!(
            parse_proc_stat_start_time("123 (parent) name) S 1 2 3"),
            None,
        );
    }
}
