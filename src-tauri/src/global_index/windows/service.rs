//! Versioned IPC contract for the optional Windows index service.
//!
//! The UI process never runs as administrator.  The service endpoint is
//! intentionally narrow: it accepts only discovery/index lifecycle commands,
//! never arbitrary paths or file-operation commands.  Direct mode remains the
//! development fallback when the installed service is unavailable.

use serde::{Deserialize, Serialize};

pub const IPC_PROTOCOL_VERSION: u16 = 1;
pub const INDEX_SERVICE_PIPE: &str = r"\\.\pipe\ZenCanvas.GlobalIndex.v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IndexServiceCommand {
    DiscoverSources,
    StartInitialIndex { source_id: String },
    ResumeIncrementalSync { source_id: String },
    Pause,
    Status,
    Rebuild { source_id: String },
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexServiceRequest {
    pub protocol_version: u16,
    pub request_id: String,
    pub command: IndexServiceCommand,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexServiceResponse {
    pub protocol_version: u16,
    pub request_id: String,
    pub ok: bool,
    pub error_code: Option<String>,
    pub message: Option<String>,
}

pub fn validate_request(request: &IndexServiceRequest) -> Result<(), String> {
    if request.protocol_version != IPC_PROTOCOL_VERSION {
        return Err("unsupported_index_service_protocol".to_string());
    }
    if request.request_id.trim().is_empty() {
        return Err("missing_index_service_request_id".to_string());
    }
    match &request.command {
        IndexServiceCommand::StartInitialIndex { source_id }
        | IndexServiceCommand::ResumeIncrementalSync { source_id }
        | IndexServiceCommand::Rebuild { source_id }
            if source_id.trim().is_empty() =>
        {
            Err("missing_index_service_source_id".to_string())
        }
        _ => Ok(()),
    }
}

pub fn direct_mode_reason() -> &'static str {
    "The Windows index service is unavailable; using the in-process least-privilege fallback."
}

#[cfg(windows)]
mod named_pipe {
    use super::{validate_request, IndexServiceRequest, IndexServiceResponse, INDEX_SERVICE_PIPE};
    use std::ptr;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, LocalFree, ERROR_PIPE_CONNECTED, GENERIC_READ, GENERIC_WRITE,
        HANDLE, INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FlushFileBuffers, ReadFile, WriteFile, FILE_FLAG_FIRST_PIPE_INSTANCE,
        FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_READMODE_MESSAGE,
        PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_MESSAGE, PIPE_WAIT,
    };

    const MAX_FRAME_BYTES: usize = 1024 * 1024;
    const PIPE_BUFFER_BYTES: u32 = 64 * 1024;

    pub fn serve_once(
        handler: impl FnOnce(IndexServiceRequest) -> IndexServiceResponse,
    ) -> Result<(), String> {
        let (pipe, security_descriptor) = create_server_pipe()?;
        let connection_result = unsafe { ConnectNamedPipe(pipe, ptr::null_mut()) };
        if connection_result == 0 && unsafe { GetLastError() } != ERROR_PIPE_CONNECTED {
            unsafe {
                CloseHandle(pipe);
                if !security_descriptor.is_null() {
                    LocalFree(security_descriptor);
                }
            }
            return Err(format!("index_service_pipe_connect_failed: {}", unsafe {
                GetLastError()
            }));
        }
        let result = (|| {
            let request = read_frame(pipe)?;
            let request: IndexServiceRequest = serde_json::from_slice(&request)
                .map_err(|error| format!("index_service_invalid_request: {error}"))?;
            validate_request(&request)?;
            let response = handler(request);
            write_frame(pipe, &response)
        })();
        unsafe {
            FlushFileBuffers(pipe);
            DisconnectNamedPipe(pipe);
            CloseHandle(pipe);
            if !security_descriptor.is_null() {
                LocalFree(security_descriptor);
            }
        }
        result
    }

    pub fn call(request: &IndexServiceRequest) -> Result<IndexServiceResponse, String> {
        validate_request(request)?;
        let pipe_name = super::super::volumes::to_wide(INDEX_SERVICE_PIPE);
        let pipe = unsafe {
            CreateFileW(
                pipe_name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                ptr::null(),
                OPEN_EXISTING,
                0,
                0 as HANDLE,
            )
        };
        if pipe == INVALID_HANDLE_VALUE {
            return Err(format!("index_service_pipe_open_failed: {}", unsafe {
                GetLastError()
            }));
        }
        let result = (|| {
            write_frame(pipe, request)?;
            let bytes = read_frame(pipe)?;
            serde_json::from_slice(&bytes)
                .map_err(|error| format!("index_service_invalid_response: {error}"))
        })();
        unsafe { CloseHandle(pipe) };
        result
    }

    fn create_server_pipe() -> Result<(HANDLE, *mut core::ffi::c_void), String> {
        let name = super::super::volumes::to_wide(INDEX_SERVICE_PIPE);
        let sddl = super::super::volumes::to_wide(
            // Local interactive users only; remote clients are rejected below.
            "D:P(A;;GA;;;IU)",
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
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                1,
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

    fn write_frame<T: serde::Serialize>(pipe: HANDLE, value: &T) -> Result<(), String> {
        let mut frame = serde_json::to_vec(value)
            .map_err(|error| format!("index_service_encode_failed: {error}"))?;
        frame.push(b'\n');
        if frame.len() > MAX_FRAME_BYTES {
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
        let mut buffer = vec![0u8; MAX_FRAME_BYTES];
        let mut read = 0u32;
        let ok = unsafe {
            ReadFile(
                pipe,
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                &mut read,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(format!("index_service_pipe_read_failed: {}", unsafe {
                GetLastError()
            }));
        }
        buffer.truncate(read as usize);
        if buffer.last() == Some(&b'\n') {
            buffer.pop();
        }
        if buffer.is_empty() || buffer.len() > MAX_FRAME_BYTES {
            return Err("index_service_invalid_frame_size".to_string());
        }
        Ok(buffer)
    }
}

#[cfg(windows)]
pub use named_pipe::{call as call_index_service, serve_once as serve_index_service_once};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_protocol_and_arbitrary_empty_source() {
        let request = IndexServiceRequest {
            protocol_version: IPC_PROTOCOL_VERSION + 1,
            request_id: "request".to_string(),
            command: IndexServiceCommand::Status,
        };
        assert_eq!(
            validate_request(&request),
            Err("unsupported_index_service_protocol".to_string())
        );
        let request = IndexServiceRequest {
            protocol_version: IPC_PROTOCOL_VERSION,
            request_id: "request".to_string(),
            command: IndexServiceCommand::Rebuild {
                source_id: String::new(),
            },
        };
        assert_eq!(
            validate_request(&request),
            Err("missing_index_service_source_id".to_string())
        );
    }
}
