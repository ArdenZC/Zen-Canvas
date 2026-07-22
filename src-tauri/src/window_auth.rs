use tauri::{Runtime, WebviewWindow};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const SEARCH_WINDOW_LABEL: &str = "search";

pub fn require_main_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    require_main_window_label(window.label())
}

pub fn require_main_window_label(label: &str) -> Result<(), String> {
    if label == MAIN_WINDOW_LABEL {
        Ok(())
    } else {
        Err("main_window_required".to_string())
    }
}

pub fn is_main_window_label(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_main_window_can_mutate_state() {
        assert!(require_main_window_label("main").is_ok());
        assert!(require_main_window_label("search").is_err());
    }
}
