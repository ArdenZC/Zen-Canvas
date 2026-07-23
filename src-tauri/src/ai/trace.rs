use std::{
    collections::VecDeque,
    sync::{Mutex, OnceLock},
    time::SystemTime,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const MAX_AI_TRACE_COUNT: usize = 32;
pub const MAX_RAW_PROVIDER_RESPONSE_CHARS: usize = 256 * 1024;
pub const MAX_EXTRACTED_CONTENT_CHARS: usize = 128 * 1024;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AITraceMode {
    #[default]
    Off,
    Failures,
    All,
}

impl AITraceMode {
    pub fn records(self, failed: bool) -> bool {
        match self {
            Self::Off => false,
            Self::Failures => failed,
            Self::All => true,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AITraceOperation {
    ConnectionTest,
    #[default]
    FileClassification,
    CleanupAnalysis,
    ModelDiscovery,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AITraceContext {
    #[serde(default)]
    pub operation: AITraceOperation,
    pub job_id: Option<String>,
    pub batch_id: Option<String>,
    pub target_count: Option<usize>,
    pub batch_size: Option<usize>,
    #[serde(default, skip_serializing)]
    pub redaction_secrets: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AITraceRequest {
    pub url_host: String,
    pub path: String,
    pub message_count: usize,
    pub target_count: Option<usize>,
    pub batch_size: Option<usize>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub force_json: bool,
    pub response_format: Option<String>,
    pub thinking_mode: Option<String>,
    pub extra_body_keys: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AITraceUsage {
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AITraceResponse {
    pub http_status: Option<u16>,
    pub finish_reason: Option<String>,
    pub message_keys: Vec<String>,
    pub content_type: Option<String>,
    pub content_length: Option<usize>,
    pub reasoning_content_length: Option<usize>,
    pub usage: Option<AITraceUsage>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIRequestTrace {
    pub trace_id: String,
    pub job_id: Option<String>,
    pub batch_id: Option<String>,
    pub started_at: String,
    pub elapsed_ms: u128,
    pub operation: AITraceOperation,
    pub provider_id: String,
    pub provider_label: String,
    pub model: String,
    pub request: AITraceRequest,
    pub response: AITraceResponse,
    pub raw_provider_response: Option<String>,
    pub extracted_content: Option<String>,
    pub cleaned_json_text: Option<String>,
    pub parsed_json: Option<Value>,
    pub parse_stage: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Default)]
pub struct AITraceUpdate {
    pub elapsed_ms: Option<u128>,
    pub response: Option<AITraceResponse>,
    pub raw_provider_response: Option<String>,
    pub extracted_content: Option<String>,
    pub cleaned_json_text: Option<String>,
    pub parsed_json: Option<Value>,
    pub parse_stage: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct SecretRedactor {
    secrets: Vec<String>,
}

impl SecretRedactor {
    pub fn new(secrets: impl IntoIterator<Item = impl AsRef<str>>) -> Self {
        let mut values = Vec::new();
        for secret in secrets {
            let secret = secret.as_ref().trim();
            if secret.len() < 3 {
                continue;
            }
            for candidate in [
                secret.to_string(),
                secret
                    .encode_utf16()
                    .flat_map(|unit| unit.to_le_bytes())
                    .map(char::from)
                    .collect(),
                secret
                    .encode_utf16()
                    .flat_map(|unit| unit.to_be_bytes())
                    .map(char::from)
                    .collect(),
            ] {
                if !candidate.is_empty() && !values.iter().any(|value| value == &candidate) {
                    values.push(candidate);
                }
            }
        }
        values.sort_by_key(|value| std::cmp::Reverse(value.len()));
        Self { secrets: values }
    }

    pub fn redact_text(&self, text: &str) -> String {
        let mut output = text.to_string();
        for secret in &self.secrets {
            output = output.replace(secret, "[redacted]");
        }
        redact_local_paths(&redact_labeled_secret_values(&output))
    }

    pub fn redact_json(&self, value: &Value) -> Value {
        match value {
            Value::Object(object) => Value::Object(
                object
                    .iter()
                    .map(|(key, value)| {
                        if is_sensitive_key(key) {
                            (key.clone(), Value::String("[redacted]".to_string()))
                        } else {
                            (key.clone(), self.redact_json(value))
                        }
                    })
                    .collect(),
            ),
            Value::Array(values) => {
                Value::Array(values.iter().map(|value| self.redact_json(value)).collect())
            }
            Value::String(text) => Value::String(self.redact_text(text)),
            _ => value.clone(),
        }
    }

    pub fn redact_optional_text(&self, text: Option<&str>, limit: usize) -> (Option<String>, bool) {
        let Some(text) = text else {
            return (None, false);
        };
        let redacted = self.redact_text(text);
        let (value, truncated) = truncate_preserving_head_tail(&redacted, limit);
        (Some(value), truncated)
    }
}

pub fn new_trace_id() -> String {
    format!("ai-trace-{}", Uuid::new_v4())
}

pub fn now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| format!("{:?}", SystemTime::now()))
}

pub fn truncate_preserving_head_tail(value: &str, limit: usize) -> (String, bool) {
    let chars = value.chars().collect::<Vec<_>>();
    if chars.len() <= limit {
        return (value.to_string(), false);
    }
    if limit <= 32 {
        return (chars.into_iter().take(limit).collect(), true);
    }
    let marker = "\n…[truncated]…\n";
    let available = limit.saturating_sub(marker.chars().count());
    let head_len = available / 2;
    let tail_len = available.saturating_sub(head_len);
    let head = chars.iter().take(head_len).collect::<String>();
    let tail = chars
        .iter()
        .skip(chars.len().saturating_sub(tail_len))
        .collect::<String>();
    (format!("{head}{marker}{tail}"), true)
}

pub fn record_trace(mode: AITraceMode, mut trace: AIRequestTrace, failed: bool) -> Option<String> {
    if !mode.records(failed) {
        return None;
    }
    if trace.trace_id.is_empty() {
        trace.trace_id = new_trace_id();
    }
    let trace_id = trace.trace_id.clone();
    let store = trace_store();
    let mut store = store.lock().expect("AI trace store poisoned");
    store.push_back(trace);
    while store.len() > MAX_AI_TRACE_COUNT {
        store.pop_front();
    }
    Some(trace_id)
}

pub fn update_trace(trace_id: &str, update: AITraceUpdate) {
    update_trace_with_secrets(trace_id, update, std::iter::empty::<&str>());
}

pub fn update_trace_with_secrets(
    trace_id: &str,
    update: AITraceUpdate,
    secrets: impl IntoIterator<Item = impl AsRef<str>>,
) {
    let mut store = trace_store().lock().expect("AI trace store poisoned");
    let Some(trace) = store.iter_mut().find(|trace| trace.trace_id == trace_id) else {
        return;
    };
    if let Some(elapsed_ms) = update.elapsed_ms {
        trace.elapsed_ms = elapsed_ms;
    }
    if let Some(response) = update.response {
        trace.response = response;
    }
    let redactor = SecretRedactor::new(secrets);
    if let Some(value) = update.raw_provider_response.as_deref() {
        let (value, truncated) =
            redactor.redact_optional_text(Some(value), MAX_RAW_PROVIDER_RESPONSE_CHARS);
        trace.raw_provider_response = value;
        trace.truncated |= truncated;
    }
    if let Some(value) = update.extracted_content.as_deref() {
        let (value, truncated) =
            redactor.redact_optional_text(Some(value), MAX_EXTRACTED_CONTENT_CHARS);
        trace.extracted_content = value;
        trace.truncated |= truncated;
    }
    if let Some(value) = update.cleaned_json_text.as_deref() {
        let (value, truncated) =
            redactor.redact_optional_text(Some(value), MAX_EXTRACTED_CONTENT_CHARS);
        trace.cleaned_json_text = value;
        trace.truncated |= truncated;
    }
    if let Some(value) = update.parsed_json {
        trace.parsed_json = Some(redactor.redact_json(&value));
    }
    if let Some(parse_stage) = update.parse_stage {
        trace.parse_stage = parse_stage;
    }
    if let Some(error_code) = update.error_code {
        trace.error_code = Some(error_code);
    }
    if let Some(error_message) = update.error_message {
        trace.error_message = Some(redactor.redact_text(&error_message));
    }
}

fn redact_local_paths(text: &str) -> String {
    let chars = text.chars().collect::<Vec<_>>();
    let mut output = String::with_capacity(text.len());
    let mut index = 0;
    while index < chars.len() {
        if let Some(root_len) = local_path_root_len(&chars, index) {
            output.push_str("[local-path]");
            index += root_len;
            while index < chars.len()
                && !chars[index].is_whitespace()
                && !matches!(
                    chars[index],
                    '"' | '\'' | '<' | '>' | ']' | '[' | '}' | '{' | ',' | ';'
                )
            {
                index += 1;
            }
        } else {
            output.push(chars[index]);
            index += 1;
        }
    }
    output
}

fn local_path_root_len(chars: &[char], index: usize) -> Option<usize> {
    if index + 2 < chars.len()
        && chars[index].is_ascii_alphabetic()
        && chars[index + 1] == ':'
        && matches!(chars[index + 2], '\\' | '/')
    {
        return Some(3);
    }
    if index + 1 < chars.len() && chars[index] == '\\' && chars[index + 1] == '\\' {
        return Some(2);
    }
    for root in ["/Users/", "/home/", "/tmp/", "/var/", "/mnt/", "/Volumes/"] {
        let root_chars = root.chars().collect::<Vec<_>>();
        if chars.get(index..index + root_chars.len()) == Some(root_chars.as_slice()) {
            return Some(root_chars.len());
        }
    }
    None
}

pub fn list_traces() -> Vec<AIRequestTrace> {
    trace_store()
        .lock()
        .expect("AI trace store poisoned")
        .iter()
        .cloned()
        .collect()
}

pub fn clear_traces() {
    trace_store()
        .lock()
        .expect("AI trace store poisoned")
        .clear();
}

pub fn export_traces_json() -> Result<String, String> {
    serde_json::to_string_pretty(&list_traces()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_ai_request_traces() -> Vec<AIRequestTrace> {
    list_traces()
}

#[tauri::command]
pub fn clear_ai_request_traces() {
    clear_traces();
}

#[tauri::command]
pub fn export_ai_request_traces() -> Result<String, String> {
    export_traces_json()
}

fn trace_store() -> &'static Mutex<VecDeque<AIRequestTrace>> {
    static STORE: OnceLock<Mutex<VecDeque<AIRequestTrace>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(VecDeque::with_capacity(MAX_AI_TRACE_COUNT)))
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(|character| character.to_lowercase())
        .collect::<String>();
    normalized == "authorization"
        || normalized == "bearer"
        || normalized == "apikey"
        || normalized == "accesskey"
        || normalized == "accesstoken"
        || normalized == "secret"
        || normalized == "secretkey"
        || normalized == "password"
        || normalized == "cookie"
        || normalized == "xapikey"
        || normalized == "ak"
        || normalized == "sk"
        || normalized.contains("token")
        || normalized.contains("credential")
}

fn redact_labeled_secret_values(text: &str) -> String {
    let labels = [
        "authorization",
        "bearer",
        "api_key",
        "apikey",
        "access_token",
        "secret",
        "password",
        "cookie",
        "x-api-key",
    ];
    let mut output = String::with_capacity(text.len());
    let lower = text.to_ascii_lowercase();
    let mut cursor = 0;
    while cursor < text.len() {
        let Some((label_start, label)) = labels
            .iter()
            .chain(["ak", "sk"].iter())
            .filter_map(|label| {
                find_labeled_secret_start(&lower, label, cursor).map(|start| (start, *label))
            })
            .min_by_key(|(index, _)| *index)
        else {
            output.push_str(&text[cursor..]);
            break;
        };
        output.push_str(&text[cursor..label_start]);
        let label_end = label_start + label.len();
        output.push_str(&text[label_start..label_end]);
        let mut value_start = label_end;
        while value_start < text.len()
            && matches!(
                text.as_bytes()[value_start],
                b' ' | b'\t' | b'"' | b'\'' | b':' | b'='
            )
        {
            output.push(text.as_bytes()[value_start] as char);
            value_start += 1;
        }
        let mut value_end = value_start;
        while value_end < text.len()
            && !matches!(
                text.as_bytes()[value_end],
                b' ' | b'\t' | b'\r' | b'\n' | b',' | b'}' | b']' | b'"' | b'\''
            )
        {
            value_end += 1;
        }
        if value_end > value_start {
            output.push_str("[redacted]");
        }
        cursor = value_end.max(label_end);
    }
    output
}

fn find_labeled_secret_start(lower: &str, label: &str, from: usize) -> Option<usize> {
    let bytes = lower.as_bytes();
    let mut search_from = from;
    while search_from < lower.len() {
        let offset = lower[search_from..].find(label)?;
        let start = search_from + offset;
        let end = start + label.len();
        let before_is_boundary =
            start == 0 || !bytes[start - 1].is_ascii_alphanumeric() && bytes[start - 1] != b'_';
        let next = bytes.get(end).copied();
        let label_is_short = matches!(label, "ak" | "sk");
        let after_is_boundary = matches!(
            next,
            None | Some(b':') | Some(b'=') | Some(b'"') | Some(b'\'')
        ) || (label_is_short || label == "bearer")
            && matches!(next, Some(b' ') | Some(b'\t'));
        if before_is_boundary && after_is_boundary {
            return Some(start);
        }
        search_from = end;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    fn test_guard() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .expect("trace test lock")
    }

    #[test]
    fn redactor_removes_text_json_and_utf16_canaries() {
        let _guard = test_guard();
        let redactor = SecretRedactor::new(["Canary-Secret-123"]);
        let utf16 = "Canary-Secret-123"
            .encode_utf16()
            .flat_map(|unit| unit.to_le_bytes())
            .map(char::from)
            .collect::<String>();
        assert!(!redactor
            .redact_text(&format!("Authorization: Bearer Canary-Secret-123 {utf16}"))
            .contains("Canary-Secret-123"));
        let value = redactor.redact_json(&json!({
            "apiKey": "Canary-Secret-123",
            "nested": ["Canary-Secret-123"]
        }));
        assert!(!value.to_string().contains("Canary-Secret-123"));
    }

    #[test]
    fn redactor_does_not_corrupt_json_keys_containing_short_secret_labels() {
        let _guard = test_guard();
        let redactor = SecretRedactor::new(std::iter::empty::<&str>());
        let redacted = redactor
            .redact_text(r#"{"riskLevel":"Normal","reason":"secretary notes","sk":"value"}"#);
        let value: serde_json::Value =
            serde_json::from_str(&redacted).expect("redaction must preserve JSON syntax");
        assert_eq!(value["riskLevel"], "Normal");
        assert_eq!(value["reason"], "secretary notes");
        assert_eq!(value["sk"], "[redacted]");
    }

    #[test]
    fn redactor_hides_common_local_path_forms() {
        let _guard = test_guard();
        let redacted = SecretRedactor::new(std::iter::empty::<&str>()).redact_text(
            r#"C:\Users\Alice\Documents\report.pdf /home/alice/report.pdf \\server\share\report.pdf"#,
        );
        assert!(!redacted.contains("Alice"));
        assert!(!redacted.contains("/home/alice"));
        assert!(!redacted.contains("\\\\server"));
        assert_eq!(redacted.matches("[local-path]").count(), 3);
    }

    #[test]
    fn failures_mode_keeps_successes_out_of_the_ring_buffer() {
        let _guard = test_guard();
        clear_traces();
        let success = AIRequestTrace {
            trace_id: "success-trace".to_string(),
            ..AIRequestTrace::default()
        };
        let failure = AIRequestTrace {
            trace_id: "failure-trace".to_string(),
            ..AIRequestTrace::default()
        };
        assert!(record_trace(AITraceMode::Failures, success, false).is_none());
        assert!(record_trace(AITraceMode::Failures, failure, true).is_some());
        let traces = list_traces();
        assert_eq!(traces.len(), 1);
        assert_eq!(traces[0].trace_id, "failure-trace");
    }

    #[test]
    fn truncate_preserves_head_and_tail() {
        let _guard = test_guard();
        let (value, truncated) = truncate_preserving_head_tail(&"x".repeat(100), 40);
        assert!(truncated);
        assert!(value.contains("truncated"));
        assert!(value.chars().count() <= 40);
    }

    #[test]
    fn off_mode_records_nothing() {
        let _guard = test_guard();
        clear_traces();
        let trace = AIRequestTrace {
            trace_id: "off-test".to_string(),
            ..AIRequestTrace::default()
        };
        assert!(record_trace(AITraceMode::Off, trace, true).is_none());
        assert!(list_traces().is_empty());
    }

    #[test]
    fn ring_buffer_is_bounded() {
        let _guard = test_guard();
        clear_traces();
        for index in 0..(MAX_AI_TRACE_COUNT + 5) {
            record_trace(
                AITraceMode::All,
                AIRequestTrace {
                    trace_id: format!("trace-{index}"),
                    ..AIRequestTrace::default()
                },
                false,
            );
        }
        assert_eq!(list_traces().len(), MAX_AI_TRACE_COUNT);
    }

    #[test]
    fn redaction_secrets_never_serialize_into_trace_context() {
        let _guard = test_guard();
        let context = AITraceContext {
            job_id: Some("job-1".to_string()),
            redaction_secrets: vec![
                "C:\\Users\\Alice\\Documents\\private.pdf".to_string(),
                "file-id-secret".to_string(),
            ],
            ..Default::default()
        };
        let serialized = serde_json::to_string(&context).expect("serialize trace context");
        assert!(serialized.contains("job-1"));
        assert!(!serialized.contains("private.pdf"));
        assert!(!serialized.contains("file-id-secret"));
    }
}
