//! Versioned IPC protocol and hardened named-pipe transport for the Windows
//! global-index service.
//!
//! The service accepts metadata-index commands only from the same installed
//! Zen Canvas executable running in an interactive session. It never receives
//! arbitrary paths or file-operation commands, and service shutdown remains an
//! SCM-only operation.

use crate::global_index::models::{GlobalEntry, GlobalEntryInput, GlobalVolume};
use serde::{Deserialize, Serialize};

pub const IPC_PROTOCOL_VERSION: u16 = 3;
pub const INDEX_SERVICE_PIPE: &str = r"\\.\pipe\ZenCanvas.GlobalIndex.v3";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IndexServiceCommand {
    DiscoverSources,
    StartInitialIndex {
        source_id: String,
    },
    ResumeIncrementalSync {
        source_id: String,
    },
    Pause,
    Status,
    Rebuild {
        source_id: String,
    },
    /// Retained for wire compatibility with pre-v3 clients. The hardened
    /// validator always rejects it; the SCM is the only shutdown authority.
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexServiceRequest {
    pub protocol_version: u16,
    pub request_id: String,
    pub command: IndexServiceCommand,
    #[serde(default)]
    pub source: Option<GlobalVolume>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexServiceResponse {
    pub protocol_version: u16,
    pub request_id: String,
    pub ok: bool,
    pub error_code: Option<String>,
    pub message: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "event")]
pub enum IndexServiceEvent {
    Sources {
        sources: Vec<GlobalVolume>,
    },
    Entries {
        entries: Vec<GlobalEntryInput>,
    },
    EntryStale {
        entry_id: String,
    },
    VolumeEntriesStale {
        volume_id: String,
    },
    Checkpoint {
        volume_id: String,
        journal_id: Option<String>,
        journal_cursor: Option<String>,
    },
    SourceState {
        volume_id: String,
        status: String,
        error: Option<String>,
    },
    SourceProvider {
        volume_id: String,
        provider: String,
    },
    ResolveParentPath {
        lookup_id: String,
        volume_id: String,
        parent_platform_file_id: String,
    },
    FindEntryByIdentity {
        lookup_id: String,
        volume_id: String,
        platform_file_id: String,
        parent_platform_file_id: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "response")]
pub enum IndexServiceLookupResponse {
    ParentPath {
        lookup_id: String,
        path: Option<String>,
    },
    Entry {
        lookup_id: String,
        entry: Box<Option<GlobalEntry>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum IndexServiceFrame {
    Event {
        request_id: String,
        event: IndexServiceEvent,
    },
    LookupResponse {
        response: IndexServiceLookupResponse,
    },
    Response {
        response: IndexServiceResponse,
    },
}

impl IndexServiceRequest {
    pub fn new(command: IndexServiceCommand, source: Option<GlobalVolume>) -> Self {
        Self {
            protocol_version: IPC_PROTOCOL_VERSION,
            request_id: uuid::Uuid::new_v4().to_string(),
            command,
            source,
        }
    }
}

pub fn validate_request(request: &IndexServiceRequest) -> Result<(), String> {
    if request.protocol_version != IPC_PROTOCOL_VERSION {
        return Err("unsupported_index_service_protocol".to_string());
    }
    if request.request_id.trim().is_empty() || request.request_id.len() > 128 {
        return Err("invalid_index_service_request_id".to_string());
    }
    match &request.command {
        IndexServiceCommand::StartInitialIndex { source_id }
        | IndexServiceCommand::ResumeIncrementalSync { source_id }
        | IndexServiceCommand::Rebuild { source_id } => {
            if source_id.trim().is_empty() || source_id.len() > 256 {
                return Err("invalid_index_service_source_id".to_string());
            }
            let source = request
                .source
                .as_ref()
                .ok_or_else(|| "index_service_source_snapshot_required".to_string())?;
            validate_source_snapshot(source)?;
        }
        IndexServiceCommand::Shutdown => {
            return Err("index_service_shutdown_via_scm_only".to_string());
        }
        IndexServiceCommand::DiscoverSources
        | IndexServiceCommand::Pause
        | IndexServiceCommand::Status => {
            if request.source.is_some() {
                return Err("index_service_unexpected_source_snapshot".to_string());
            }
        }
    }
    Ok(())
}

fn validate_source_snapshot(source: &GlobalVolume) -> Result<(), String> {
    for (field, value, max) in [
        ("id", source.id.as_str(), 256usize),
        ("stable_volume_id", source.stable_volume_id.as_str(), 1024),
        ("mount_path", source.mount_path.as_str(), 4096),
        ("filesystem_type", source.filesystem_type.as_str(), 128),
        ("provider", source.provider.as_str(), 128),
    ] {
        if value.trim().is_empty() || value.len() > max {
            return Err(format!("index_service_invalid_source_{field}"));
        }
    }
    Ok(())
}

pub fn direct_mode_reason() -> &'static str {
    "The Windows index service is unavailable; using the in-process least-privilege fallback."
}

#[cfg(windows)]
mod named_pipe {
    use super::{
        validate_request, IndexServiceEvent, IndexServiceFrame, IndexServiceLookupResponse,
        IndexServiceRequest, IndexServiceResponse, INDEX_SERVICE_PIPE,
    };
    use std::path::PathBuf;
    use std::ptr;
    use std::sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    };
    use std::thread;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, LocalFree, ERROR_MORE_DATA, ERROR_PIPE_BUSY,
        ERROR_PIPE_CONNECTED, GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::{RevertToSelf, SECURITY_ATTRIBUTES, TOKEN_QUERY};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FlushFileBuffers, ReadFile, WriteFile, OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, GetNamedPipeClientProcessId,
        GetNamedPipeClientSessionId, ImpersonateNamedPipeClient, SetNamedPipeHandleState,
        WaitNamedPipeW, PIPE_READMODE_MESSAGE, PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_MESSAGE,
        PIPE_WAIT,
    };
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, OpenProcess, OpenThreadToken, QueryFullProcessImageNameW,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    const MAX_FRAME_BYTES: usize = 1024 * 1024;
    const PIPE_BUFFER_BYTES: u32 = 64 * 1024;
    const PIPE_CONNECT_TIMEOUT_MS: u32 = 2_000;
    const MAX_PIPE_INSTANCES: u32 = 4;

    pub struct IndexServiceClient {
        pipe: HANDLE,
    }

    impl Drop for IndexServiceClient {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.pipe) };
        }
    }

    impl IndexServiceClient {
        pub fn send_lookup_response(
            &mut self,
            response: IndexServiceLookupResponse,
        ) -> Result<(), String> {
            write_frame(self.pipe, &IndexServiceFrame::LookupResponse { response })
        }

        fn send_request(&mut self, request: &IndexServiceRequest) -> Result<(), String> {
            write_frame(self.pipe, request)
        }

        fn read_frame(&mut self) -> Result<IndexServiceFrame, String> {
            let bytes = read_frame(self.pipe)?;
            serde_json::from_slice(&bytes)
                .map_err(|error| format!("index_service_invalid_frame: {error}"))
        }
    }

    pub fn call(request: &IndexServiceRequest) -> Result<IndexServiceResponse, String> {
        validate_request(request)?;
        let mut client = connect()?;
        client.send_request(request)?;
        loop {
            match client.read_frame()? {
                IndexServiceFrame::Response { response } => return Ok(response),
                IndexServiceFrame::Event { .. } => continue,
                IndexServiceFrame::LookupResponse { .. } => {
                    return Err("index_service_unexpected_lookup_response".to_string());
                }
            }
        }
    }

    pub fn call_stream<F>(
        request: &IndexServiceRequest,
        mut on_event: F,
    ) -> Result<IndexServiceResponse, String>
    where
        F: FnMut(&mut IndexServiceClient, IndexServiceEvent) -> Result<(), String>,
    {
        validate_request(request)?;
        let mut client = connect()?;
        client.send_request(request)?;
        loop {
            match client.read_frame()? {
                IndexServiceFrame::Response { response } => return Ok(response),
                IndexServiceFrame::Event { event, .. } => on_event(&mut client, event)?,
                IndexServiceFrame::LookupResponse { .. } => {
                    return Err("index_service_unexpected_lookup_response".to_string());
                }
            }
        }
    }

    pub fn wake_service_pipe() {
        let request = IndexServiceRequest::new(super::IndexServiceCommand::Status, None);
        let _ = call(&request);
    }

    pub fn serve_once(
        handler: impl FnOnce(IndexServiceRequest) -> IndexServiceResponse,
    ) -> Result<(), String> {
        let (pipe, security_descriptor) = create_server_pipe()?;
        accept_and_handle(pipe, security_descriptor, |request, connection| {
            let response = handler(request);
            connection.send_response(response)
        })
    }

    pub type ServiceRequestHandler = dyn Fn(IndexServiceRequest, &mut IndexServiceServerConnection) -> Result<(), String>
        + Send
        + Sync
        + 'static;

    pub struct IndexServiceServerConnection {
        pipe: HANDLE,
        request_id: String,
    }

    unsafe impl Send for IndexServiceServerConnection {}

    impl IndexServiceServerConnection {
        pub fn send_event(&mut self, event: IndexServiceEvent) -> Result<(), String> {
            write_frame(
                self.pipe,
                &IndexServiceFrame::Event {
                    request_id: self.request_id.clone(),
                    event,
                },
            )
        }

        pub fn send_response(&mut self, response: IndexServiceResponse) -> Result<(), String> {
            write_frame(self.pipe, &IndexServiceFrame::Response { response })
        }

        pub fn read_lookup_response(
            &mut self,
            expected_lookup_id: &str,
        ) -> Result<IndexServiceLookupResponse, String> {
            let frame = read_frame(self.pipe)?;
            let frame: IndexServiceFrame = serde_json::from_slice(&frame)
                .map_err(|error| format!("index_service_invalid_lookup_frame: {error}"))?;
            let IndexServiceFrame::LookupResponse { response } = frame else {
                return Err("index_service_expected_lookup_response".to_string());
            };
            let lookup_id = match &response {
                IndexServiceLookupResponse::ParentPath { lookup_id, .. }
                | IndexServiceLookupResponse::Entry { lookup_id, .. } => lookup_id,
            };
            if lookup_id != expected_lookup_id {
                return Err("index_service_lookup_id_mismatch".to_string());
            }
            Ok(response)
        }
    }

    pub fn serve_loop(
        stop: Arc<AtomicBool>,
        handler: Arc<ServiceRequestHandler>,
    ) -> Result<(), String> {
        let active = Arc::new(AtomicUsize::new(0));
        while !stop.load(Ordering::Acquire) {
            let (pipe, security_descriptor) = create_server_pipe()?;
            let connection_result = unsafe { ConnectNamedPipe(pipe, ptr::null_mut()) };
            if connection_result == 0 && unsafe { GetLastError() } != ERROR_PIPE_CONNECTED {
                cleanup_pipe(pipe, security_descriptor);
                if stop.load(Ordering::Acquire) {
                    break;
                }
                return Err(format!("index_service_pipe_connect_failed: {}", unsafe {
                    GetLastError()
                }));
            }
            let stop_for_connection = stop.clone();
            let handler = handler.clone();
            let active_for_connection = active.clone();
            let pipe_value = pipe as usize;
            let descriptor_value = security_descriptor as usize;
            active.fetch_add(1, Ordering::AcqRel);
            thread::spawn(move || {
                let _ = handle_connected_pipe(
                    pipe_value as HANDLE,
                    descriptor_value as *mut core::ffi::c_void,
                    stop_for_connection,
                    handler,
                );
                active_for_connection.fetch_sub(1, Ordering::AcqRel);
            });
        }
        for _ in 0..250 {
            if active.load(Ordering::Acquire) == 0 {
                break;
            }
            thread::sleep(std::time::Duration::from_millis(20));
        }
        Ok(())
    }

    fn connect() -> Result<IndexServiceClient, String> {
        let pipe_name = super::super::volumes::to_wide(INDEX_SERVICE_PIPE);
        let waited = unsafe { WaitNamedPipeW(pipe_name.as_ptr(), PIPE_CONNECT_TIMEOUT_MS) };
        if waited == 0 {
            let error = unsafe { GetLastError() };
            if error != ERROR_PIPE_BUSY {
                return Err(format!("index_service_pipe_wait_failed: {error}"));
            }
            return Err("index_service_pipe_busy".to_string());
        }
        let pipe = unsafe {
            CreateFileW(
                pipe_name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                0,
                ptr::null(),
                OPEN_EXISTING,
                0,
                ptr::null_mut(),
            )
        };
        if pipe == INVALID_HANDLE_VALUE {
            return Err(format!("index_service_pipe_open_failed: {}", unsafe {
                GetLastError()
            }));
        }
        let mode = PIPE_READMODE_MESSAGE;
        if unsafe { SetNamedPipeHandleState(pipe, &mode, ptr::null(), ptr::null()) } == 0 {
            let error = unsafe { GetLastError() };
            unsafe { CloseHandle(pipe) };
            return Err(format!("index_service_pipe_mode_failed: {error}"));
        }
        Ok(IndexServiceClient { pipe })
    }

    fn handle_connected_pipe(
        pipe: HANDLE,
        security_descriptor: *mut core::ffi::c_void,
        stop: Arc<AtomicBool>,
        handler: Arc<ServiceRequestHandler>,
    ) -> Result<(), String> {
        let mut request_id = "unknown".to_string();
        let result = (|| {
            let bytes = read_frame(pipe)?;
            validate_pipe_client(pipe)?;
            let request: IndexServiceRequest = serde_json::from_slice(&bytes)
                .map_err(|error| format!("index_service_invalid_request: {error}"))?;
            validate_request(&request)?;
            request_id = request.request_id.clone();
            let mut connection = IndexServiceServerConnection {
                pipe,
                request_id: request_id.clone(),
            };
            handler(request, &mut connection)
        })();
        if result.is_err() && !stop.load(Ordering::Acquire) {
            let response = IndexServiceResponse {
                protocol_version: super::IPC_PROTOCOL_VERSION,
                request_id,
                ok: false,
                error_code: Some("index_service_request_failed".to_string()),
                message: result.as_ref().err().cloned(),
                status: None,
            };
            let _ = write_frame(pipe, &IndexServiceFrame::Response { response });
        }
        unsafe { FlushFileBuffers(pipe) };
        cleanup_pipe(pipe, security_descriptor);
        result
    }

    fn accept_and_handle(
        pipe: HANDLE,
        security_descriptor: *mut core::ffi::c_void,
        handler: impl FnOnce(
            IndexServiceRequest,
            &mut IndexServiceServerConnection,
        ) -> Result<(), String>,
    ) -> Result<(), String> {
        let connection_result = unsafe { ConnectNamedPipe(pipe, ptr::null_mut()) };
        if connection_result == 0 && unsafe { GetLastError() } != ERROR_PIPE_CONNECTED {
            cleanup_pipe(pipe, security_descriptor);
            return Err(format!("index_service_pipe_connect_failed: {}", unsafe {
                GetLastError()
            }));
        }
        let result = (|| {
            let bytes = read_frame(pipe)?;
            validate_pipe_client(pipe)?;
            let request: IndexServiceRequest = serde_json::from_slice(&bytes)
                .map_err(|error| format!("index_service_invalid_request: {error}"))?;
            validate_request(&request)?;
            let request_id = request.request_id.clone();
            let mut connection = IndexServiceServerConnection { pipe, request_id };
            handler(request, &mut connection)
        })();
        unsafe { FlushFileBuffers(pipe) };
        cleanup_pipe(pipe, security_descriptor);
        result
    }

    fn validate_pipe_client(pipe: HANDLE) -> Result<(), String> {
        if unsafe { ImpersonateNamedPipeClient(pipe) } == 0 {
            return Err(format!(
                "index_service_client_impersonation_failed: {}",
                unsafe { GetLastError() }
            ));
        }
        let mut token = ptr::null_mut();
        let token_opened =
            unsafe { OpenThreadToken(GetCurrentThread(), TOKEN_QUERY, 0, &mut token) } != 0;
        let token_error = (!token_opened).then(|| unsafe { GetLastError() });
        if token_opened && !token.is_null() {
            unsafe { CloseHandle(token) };
        }
        let revert_error = if unsafe { RevertToSelf() } == 0 {
            Some(unsafe { GetLastError() })
        } else {
            None
        };
        if let Some(error) = revert_error {
            return Err(format!("index_service_client_revert_failed: {error}"));
        }
        if let Some(error) = token_error {
            return Err(format!("index_service_client_token_failed: {error}"));
        }

        let mut session_id = 0u32;
        if unsafe { GetNamedPipeClientSessionId(pipe, &mut session_id) } == 0 {
            return Err(format!("index_service_client_session_failed: {}", unsafe {
                GetLastError()
            }));
        }
        if session_id == 0 {
            return Err("index_service_client_not_interactive".to_string());
        }

        let mut process_id = 0u32;
        if unsafe { GetNamedPipeClientProcessId(pipe, &mut process_id) } == 0 || process_id == 0 {
            return Err(format!("index_service_client_process_failed: {}", unsafe {
                GetLastError()
            }));
        }
        let client_path = process_image_path(process_id)?;
        let current_path = std::env::current_exe()
            .map_err(|error| format!("index_service_current_exe_failed: {error}"))?;
        if normalize_windows_path(&client_path) != normalize_windows_path(&current_path) {
            return Err("index_service_client_executable_mismatch".to_string());
        }
        Ok(())
    }

    fn process_image_path(process_id: u32) -> Result<PathBuf, String> {
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
        if process.is_null() {
            return Err(format!(
                "index_service_client_process_open_failed: {}",
                unsafe { GetLastError() }
            ));
        }
        let mut buffer = vec![0u16; 32_768];
        let mut size = buffer.len() as u32;
        let ok = unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size) };
        let error = if ok == 0 {
            Some(unsafe { GetLastError() })
        } else {
            None
        };
        unsafe { CloseHandle(process) };
        if let Some(error) = error {
            return Err(format!("index_service_client_image_failed: {error}"));
        }
        buffer.truncate(size as usize);
        Ok(PathBuf::from(String::from_utf16_lossy(&buffer)))
    }

    fn normalize_windows_path(path: &std::path::Path) -> String {
        path.to_string_lossy()
            .replace('/', "\\")
            .trim_start_matches(r"\\?\")
            .to_ascii_lowercase()
    }

    fn create_server_pipe() -> Result<(HANDLE, *mut core::ffi::c_void), String> {
        let name = super::super::volumes::to_wide(INDEX_SERVICE_PIPE);
        let sddl = super::super::volumes::to_wide(
            // LocalSystem owns the service. Built-in administrators and the
            // interactive user receive only generic read/write; the executable
            // and session checks above remain authoritative.
            "D:P(A;;GA;;;SY)(A;;GRGW;;;BA)(A;;GRGW;;;IU)",
        );
        let mut descriptor = ptr::null_mut();
        let mut descriptor_size = 0u32;
        let descriptor_ok = unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                &mut descriptor_size,
            )
        } != 0;
        if !descriptor_ok {
            return Err(format!(
                "index_service_security_descriptor_failed: {}",
                unsafe { GetLastError() }
            ));
        }
        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };
        let pipe = unsafe {
            CreateNamedPipeW(
                name.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                MAX_PIPE_INSTANCES,
                PIPE_BUFFER_BYTES,
                PIPE_BUFFER_BYTES,
                1000,
                &attributes,
            )
        };
        if pipe == INVALID_HANDLE_VALUE {
            unsafe { LocalFree(descriptor) };
            return Err(format!("index_service_pipe_create_failed: {}", unsafe {
                GetLastError()
            }));
        }
        Ok((pipe, descriptor))
    }

    fn cleanup_pipe(pipe: HANDLE, security_descriptor: *mut core::ffi::c_void) {
        unsafe {
            DisconnectNamedPipe(pipe);
            CloseHandle(pipe);
            if !security_descriptor.is_null() {
                LocalFree(security_descriptor);
            }
        }
    }

    fn write_frame<T: serde::Serialize>(pipe: HANDLE, value: &T) -> Result<(), String> {
        let mut frame = serde_json::to_vec(value)
            .map_err(|error| format!("index_service_encode_failed: {error}"))?;
        frame.push(b'\n');
        if frame.is_empty() || frame.len() > MAX_FRAME_BYTES {
            return Err("index_service_frame_too_large".to_string());
        }
        let mut written = 0u32;
        let ok = unsafe {
            WriteFile(
                pipe,
                frame.as_ptr(),
                frame.len() as u32,
                &mut written,
                ptr::null_mut(),
            )
        };
        if ok == 0 || written as usize != frame.len() {
            return Err(format!("index_service_pipe_write_failed: {}", unsafe {
                GetLastError()
            }));
        }
        Ok(())
    }

    fn read_frame(pipe: HANDLE) -> Result<Vec<u8>, String> {
        let mut frame = Vec::with_capacity(PIPE_BUFFER_BYTES as usize);
        loop {
            if frame.len() >= MAX_FRAME_BYTES {
                return Err("index_service_invalid_frame_size".to_string());
            }
            let remaining = MAX_FRAME_BYTES - frame.len();
            let chunk_len = remaining.min(PIPE_BUFFER_BYTES as usize);
            let start = frame.len();
            frame.resize(start + chunk_len, 0);
            let mut read = 0u32;
            let ok = unsafe {
                ReadFile(
                    pipe,
                    frame[start..].as_mut_ptr(),
                    chunk_len as u32,
                    &mut read,
                    ptr::null_mut(),
                )
            };
            frame.truncate(start + read as usize);
            if ok != 0 {
                break;
            }
            let error = unsafe { GetLastError() };
            if error != ERROR_MORE_DATA {
                return Err(format!("index_service_pipe_read_failed: {error}"));
            }
        }
        if frame.last() == Some(&b'\n') {
            frame.pop();
        }
        if frame.is_empty() || frame.len() > MAX_FRAME_BYTES {
            return Err("index_service_invalid_frame_size".to_string());
        }
        Ok(frame)
    }
}

#[cfg(windows)]
pub use named_pipe::{
    call as call_index_service, call_stream as call_index_service_stream,
    serve_loop as serve_index_service_loop, serve_once as serve_index_service_once,
    wake_service_pipe, IndexServiceClient, IndexServiceServerConnection, ServiceRequestHandler,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_protocol_and_shutdown_over_ipc() {
        let request = IndexServiceRequest {
            protocol_version: IPC_PROTOCOL_VERSION + 1,
            request_id: "request".to_string(),
            command: IndexServiceCommand::Status,
            source: None,
        };
        assert_eq!(
            validate_request(&request),
            Err("unsupported_index_service_protocol".to_string())
        );

        let shutdown = IndexServiceRequest::new(IndexServiceCommand::Shutdown, None);
        assert_eq!(
            validate_request(&shutdown),
            Err("index_service_shutdown_via_scm_only".to_string())
        );
    }

    #[test]
    fn index_commands_require_a_bounded_source_snapshot() {
        let request = IndexServiceRequest::new(
            IndexServiceCommand::Rebuild {
                source_id: "volume".to_string(),
            },
            None,
        );
        assert_eq!(
            validate_request(&request),
            Err("index_service_source_snapshot_required".to_string())
        );
    }
}
