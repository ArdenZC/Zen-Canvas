use super::volumes::{to_wide, volume_device_path};
use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexSink};
use crate::global_index::models::{
    GlobalEntryInput, GlobalSourceDescriptor, PROVIDER_WINDOWS_MFT_USN,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::ptr;
use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_HANDLE_EOF, GENERIC_READ, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    OPEN_EXISTING,
};
use windows_sys::Win32::System::Ioctl::{
    FSCTL_ENUM_USN_DATA, FSCTL_QUERY_USN_JOURNAL, MFT_ENUM_DATA_V0, USN_JOURNAL_DATA_V0,
    USN_RECORD_COMMON_HEADER, USN_RECORD_V2, USN_RECORD_V3,
};
use windows_sys::Win32::System::IO::DeviceIoControl;

const FILETIME_UNIX_EPOCH: i64 = 116_444_736_000_000_000;
const ENUM_BUFFER_SIZE: usize = 1024 * 1024;

#[derive(Debug, Clone)]
pub(crate) struct MftRecord {
    pub(crate) file_reference: String,
    pub(crate) parent_reference: String,
    pub(crate) name: String,
    pub(crate) timestamp: Option<i64>,
    pub(crate) reason: u32,
    pub(crate) attributes: u32,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub(crate) struct MftJournalState {
    pub(crate) journal_id: u64,
    pub(crate) next_usn: i64,
}

pub(crate) fn enumerate_volume(
    source: &GlobalSourceDescriptor,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<MftJournalState, GlobalIndexError> {
    let handle = open_volume(&source.volume.mount_path)?;
    let result = enumerate_with_handle(source, handle, sink, cancel);
    unsafe {
        CloseHandle(handle);
    }
    result
}

fn enumerate_with_handle(
    source: &GlobalSourceDescriptor,
    handle: HANDLE,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<MftJournalState, GlobalIndexError> {
    let journal = query_journal(handle)?;
    let records = enumerate_mft_records(handle, journal.NextUsn, cancel)?;
    let paths = reconstruct_paths(&source.volume.mount_path, &records);
    let mut batch = Vec::with_capacity(512);
    for record in records {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        if record.name.is_empty() {
            continue;
        }
        let path = paths
            .get(&record_key(&record))
            .cloned()
            .unwrap_or_else(|| fallback_orphan_path(&source.volume.mount_path, &record.name));
        let is_directory = record.attributes & FILE_ATTRIBUTE_DIRECTORY != 0;
        let extension = if is_directory {
            String::new()
        } else {
            PathBuf::from(&record.name)
                .extension()
                .map(|value| value.to_string_lossy().to_lowercase())
                .unwrap_or_default()
        };
        batch.push(GlobalEntryInput {
            volume_id: source.volume.id.clone(),
            platform_file_id: record.file_reference.clone(),
            parent_platform_file_id: record.parent_reference.clone(),
            name: record.name,
            path,
            extension,
            is_directory,
            size: 0,
            created_at_fs: record.timestamp,
            modified_at_fs: record.timestamp,
            file_attributes: i64::from(record.attributes),
            is_hidden: record.attributes & FILE_ATTRIBUTE_HIDDEN != 0,
            is_system: record.attributes & FILE_ATTRIBUTE_SYSTEM != 0,
            source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
            last_seen_at: crate::global_index::models::unix_now(),
        });
        if batch.len() >= 512 {
            sink.write_batch(&batch)?;
            batch.clear();
        }
    }
    if !batch.is_empty() {
        sink.write_batch(&batch)?;
    }
    sink.checkpoint(
        &source.volume.id,
        Some(&journal.UsnJournalID.to_string()),
        Some(&journal.NextUsn.to_string()),
    )?;
    Ok(MftJournalState {
        journal_id: journal.UsnJournalID,
        next_usn: journal.NextUsn,
    })
}

pub(crate) fn parse_mft_page(buffer: &[u8]) -> Result<(u64, Vec<MftRecord>), GlobalIndexError> {
    if buffer.len() < 8 {
        return Err(mft_integrity_error(
            "MFT page is shorter than the continuation cursor",
        ));
    }
    let next_start = u64::from_ne_bytes(
        buffer[..8]
            .try_into()
            .map_err(|_| mft_integrity_error("invalid MFT cursor"))?,
    );
    let mut offset = 8usize;
    let mut records = Vec::new();
    let header_size = std::mem::size_of::<USN_RECORD_COMMON_HEADER>();
    while offset < buffer.len() {
        if buffer.len() - offset < header_size {
            if buffer[offset..].iter().any(|byte| *byte != 0) {
                return Err(mft_integrity_error(
                    "MFT page has a non-zero truncated record header",
                ));
            }
            break;
        }
        let header = unsafe {
            ptr::read_unaligned(buffer.as_ptr().add(offset) as *const USN_RECORD_COMMON_HEADER)
        };
        let record_length = header.RecordLength as usize;
        if record_length == 0 {
            if buffer[offset..].iter().any(|byte| *byte != 0) {
                return Err(mft_integrity_error(
                    "MFT page has data after a zero-length record",
                ));
            }
            break;
        }
        let end = offset
            .checked_add(record_length)
            .ok_or_else(|| mft_integrity_error("MFT record length overflow"))?;
        if end > buffer.len() || record_length < 8 {
            return Err(mft_integrity_error("MFT record extends past page boundary"));
        }
        let record = match header.MajorVersion {
            2 => parse_v2(&buffer[offset..end])?,
            3 => parse_v3(&buffer[offset..end])?,
            major => {
                return Err(mft_integrity_error(format!(
                    "unsupported USN record version {major}"
                )))
            }
        };
        records.push(record);
        offset = end;
    }
    Ok((next_start, records))
}

fn parse_v2(bytes: &[u8]) -> Result<MftRecord, GlobalIndexError> {
    if bytes.len() < std::mem::size_of::<USN_RECORD_V2>() {
        return Err(mft_integrity_error("USN_RECORD_V2 is truncated"));
    }
    let record = unsafe { ptr::read_unaligned(bytes.as_ptr() as *const USN_RECORD_V2) };
    parse_name(
        bytes,
        record.FileNameOffset as usize,
        record.FileNameLength as usize,
    )
    .map(|name| MftRecord {
        file_reference: format!("{:016x}", record.FileReferenceNumber),
        parent_reference: format!("{:016x}", record.ParentFileReferenceNumber),
        name,
        timestamp: windows_filetime_to_unix(record.TimeStamp),
        reason: record.Reason,
        attributes: record.FileAttributes,
    })
}

fn parse_v3(bytes: &[u8]) -> Result<MftRecord, GlobalIndexError> {
    if bytes.len() < std::mem::size_of::<USN_RECORD_V3>() {
        return Err(mft_integrity_error("USN_RECORD_V3 is truncated"));
    }
    let record = unsafe { ptr::read_unaligned(bytes.as_ptr() as *const USN_RECORD_V3) };
    parse_name(
        bytes,
        record.FileNameOffset as usize,
        record.FileNameLength as usize,
    )
    .map(|name| MftRecord {
        file_reference: hex_id(&record.FileReferenceNumber.Identifier),
        parent_reference: hex_id(&record.ParentFileReferenceNumber.Identifier),
        name,
        timestamp: windows_filetime_to_unix(record.TimeStamp),
        reason: record.Reason,
        attributes: record.FileAttributes,
    })
}

fn parse_name(bytes: &[u8], offset: usize, length: usize) -> Result<String, GlobalIndexError> {
    let Some(end) = offset.checked_add(length) else {
        return Err(mft_integrity_error("USN file name range overflows"));
    };
    if !length.is_multiple_of(2) || offset > bytes.len() || end > bytes.len() {
        return Err(mft_integrity_error("USN file name range is invalid"));
    }
    let utf16 = bytes[offset..end]
        .chunks_exact(2)
        .map(|chunk| u16::from_ne_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    Ok(String::from_utf16_lossy(&utf16))
}

pub(crate) fn mft_integrity_error(message: impl Into<String>) -> GlobalIndexError {
    GlobalIndexError::Provider(format!("mft_integrity: {}", message.into()))
}

pub(crate) fn is_integrity_error(error: &GlobalIndexError) -> bool {
    error.to_string().contains("mft_integrity:")
}

pub(crate) fn reconstruct_paths(root: &str, records: &[MftRecord]) -> HashMap<String, String> {
    // Keep one owned record per MFT page and let the parent graph borrow it;
    // cloning every record into a second full map is prohibitive on large
    // volumes. The path cache stores only resolved strings.
    let mut by_id = HashMap::<String, &MftRecord>::new();
    for record in records {
        by_id.entry(record.file_reference.clone()).or_insert(record);
    }
    let mut cache = HashMap::new();
    for record in records {
        let mut visiting = HashSet::new();
        let path = resolve_path(root, record, &by_id, &mut cache, &mut visiting);
        cache.insert(record_key(record), path);
    }
    cache
}

fn resolve_path(
    root: &str,
    record: &MftRecord,
    by_id: &HashMap<String, &MftRecord>,
    cache: &mut HashMap<String, String>,
    visiting: &mut HashSet<String>,
) -> String {
    let key = record_key(record);
    if let Some(cached) = cache.get(&key) {
        return cached.clone();
    }
    if !visiting.insert(key.clone()) {
        return fallback_orphan_path(root, &record.name);
    }
    let path = if record.name == "." || record.parent_reference == record.file_reference {
        root.to_string()
    } else if let Some(parent) = by_id.get(&record.parent_reference) {
        let parent_path = resolve_path(root, parent, by_id, cache, visiting);
        join_windows_path(&parent_path, &record.name)
    } else {
        fallback_orphan_path(root, &record.name)
    };
    visiting.remove(&key);
    cache.insert(key, path.clone());
    path
}

fn join_windows_path(parent: &str, name: &str) -> String {
    if parent.ends_with(['\\', '/']) {
        format!("{parent}{name}")
    } else {
        format!(r"{parent}\{name}")
    }
}

fn fallback_orphan_path(root: &str, name: &str) -> String {
    join_windows_path(root, name)
}

fn record_key(record: &MftRecord) -> String {
    format!(
        "{}\0{}\0{}",
        record.file_reference, record.parent_reference, record.name
    )
}

pub(crate) fn open_volume(mount_path: &str) -> Result<HANDLE, GlobalIndexError> {
    let path = volume_device_path(mount_path);
    let wide = to_wide(&path);
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(GlobalIndexError::Provider(format!(
            "cannot open volume {mount_path} (Win32 error {})",
            unsafe { GetLastError() }
        )));
    }
    Ok(handle)
}

pub(crate) fn query_journal(handle: HANDLE) -> Result<USN_JOURNAL_DATA_V0, GlobalIndexError> {
    let mut output = USN_JOURNAL_DATA_V0::default();
    let output_bytes = unsafe {
        std::slice::from_raw_parts_mut(
            (&mut output as *mut USN_JOURNAL_DATA_V0).cast::<u8>(),
            std::mem::size_of::<USN_JOURNAL_DATA_V0>(),
        )
    };
    device_io_control(handle, FSCTL_QUERY_USN_JOURNAL, &[], output_bytes)?;
    Ok(output)
}

fn enumerate_mft_records(
    handle: HANDLE,
    high_usn: i64,
    cancel: &AtomicBool,
) -> Result<Vec<MftRecord>, GlobalIndexError> {
    let mut cursor = 0u64;
    let mut records = Vec::new();
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let input = MFT_ENUM_DATA_V0 {
            StartFileReferenceNumber: cursor,
            LowUsn: 0,
            HighUsn: high_usn,
        };
        let mut output = vec![0u8; ENUM_BUFFER_SIZE];
        let input_bytes = unsafe {
            std::slice::from_raw_parts(
                (&input as *const MFT_ENUM_DATA_V0).cast::<u8>(),
                std::mem::size_of::<MFT_ENUM_DATA_V0>(),
            )
        };
        let bytes = match unsafe {
            device_io_control_bytes(handle, FSCTL_ENUM_USN_DATA, input_bytes, &mut output)
        } {
            Ok(bytes) => bytes,
            Err(error) if is_win32_error(&error, ERROR_HANDLE_EOF) => break,
            Err(error) => return Err(error),
        };
        if bytes < 8 {
            return Err(mft_integrity_error(
                "MFT enumeration page is shorter than the continuation cursor",
            ));
        }
        let (next_cursor, mut page_records) = parse_mft_page(&output[..bytes])?;
        records.append(&mut page_records);
        if next_cursor == cursor {
            return Err(mft_integrity_error(
                "MFT enumeration cursor did not advance",
            ));
        }
        cursor = next_cursor;
    }
    Ok(records)
}

pub(crate) fn is_win32_error(error: &GlobalIndexError, code: u32) -> bool {
    error.to_string().contains(&format!("Win32 error {code}"))
}

pub(crate) unsafe fn device_io_control_bytes(
    handle: HANDLE,
    code: u32,
    input: &[u8],
    output: &mut [u8],
) -> Result<usize, GlobalIndexError> {
    let mut returned = 0u32;
    let ok = DeviceIoControl(
        handle,
        code,
        input.as_ptr().cast(),
        input.len() as u32,
        output.as_mut_ptr().cast(),
        output.len() as u32,
        &mut returned,
        ptr::null_mut(),
    );
    if ok == 0 {
        return Err(GlobalIndexError::Provider(format!(
            "DeviceIoControl 0x{code:08x} failed (Win32 error {})",
            GetLastError()
        )));
    }
    Ok(returned as usize)
}

fn device_io_control(
    handle: HANDLE,
    code: u32,
    input: &[u8],
    output: &mut [u8],
) -> Result<usize, GlobalIndexError> {
    unsafe { device_io_control_bytes(handle, code, input, output) }
}

fn windows_filetime_to_unix(value: i64) -> Option<i64> {
    if value <= FILETIME_UNIX_EPOCH {
        return None;
    }
    Some((value - FILETIME_UNIX_EPOCH) / 10_000_000)
}

fn hex_id(value: &[u8; 16]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows_sys::Win32::Storage::FileSystem::FILE_ID_128;

    fn fixture_record(major: u16, name: &str) -> Vec<u8> {
        let name_bytes = name.encode_utf16().collect::<Vec<_>>();
        let record_size = std::mem::size_of::<USN_RECORD_V2>() - 2 + name_bytes.len() * 2;
        let record_size = (record_size + 7) & !7;
        let mut bytes = vec![0u8; 8 + record_size];
        bytes[0..8].copy_from_slice(&42u64.to_ne_bytes());
        let record = USN_RECORD_V2 {
            RecordLength: record_size as u32,
            MajorVersion: major,
            FileReferenceNumber: 10,
            ParentFileReferenceNumber: 5,
            FileNameOffset: (std::mem::size_of::<USN_RECORD_V2>() - 2) as u16,
            FileNameLength: (name_bytes.len() * 2) as u16,
            ..Default::default()
        };
        unsafe {
            ptr::copy_nonoverlapping(
                (&record as *const USN_RECORD_V2).cast::<u8>(),
                bytes[8..].as_mut_ptr(),
                std::mem::size_of::<USN_RECORD_V2>() - 2,
            );
        }
        for (index, value) in name_bytes.iter().enumerate() {
            bytes[8 + record.FileNameOffset as usize + index * 2
                ..8 + record.FileNameOffset as usize + index * 2 + 2]
                .copy_from_slice(&value.to_ne_bytes());
        }
        bytes
    }

    fn fixture_record_v3(name: &str) -> Vec<u8> {
        let name_bytes = name.encode_utf16().collect::<Vec<_>>();
        let record_size = std::mem::size_of::<USN_RECORD_V3>() - 2 + name_bytes.len() * 2;
        let record_size = (record_size + 7) & !7;
        let mut bytes = vec![0u8; 8 + record_size];
        bytes[0..8].copy_from_slice(&84u64.to_ne_bytes());
        let record = USN_RECORD_V3 {
            RecordLength: record_size as u32,
            MajorVersion: 3,
            MinorVersion: 0,
            FileReferenceNumber: FILE_ID_128 {
                Identifier: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            },
            ParentFileReferenceNumber: FILE_ID_128 {
                Identifier: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
            },
            FileNameOffset: (std::mem::size_of::<USN_RECORD_V3>() - 2) as u16,
            FileNameLength: (name_bytes.len() * 2) as u16,
            ..Default::default()
        };
        unsafe {
            ptr::copy_nonoverlapping(
                (&record as *const USN_RECORD_V3).cast::<u8>(),
                bytes[8..].as_mut_ptr(),
                std::mem::size_of::<USN_RECORD_V3>() - 2,
            );
        }
        for (index, value) in name_bytes.iter().enumerate() {
            bytes[8 + record.FileNameOffset as usize + index * 2
                ..8 + record.FileNameOffset as usize + index * 2 + 2]
                .copy_from_slice(&value.to_ne_bytes());
        }
        bytes
    }

    #[test]
    fn parses_usn_record_v2_fixture() {
        let page = fixture_record(2, "报告.txt");
        let (cursor, records) = parse_mft_page(&page).expect("parse fixture");
        assert_eq!(cursor, 42);
        assert_eq!(records[0].file_reference, "000000000000000a");
        assert_eq!(records[0].parent_reference, "0000000000000005");
        assert_eq!(records[0].name, "报告.txt");
    }

    #[test]
    fn parses_usn_record_v3_fixture() {
        let page = fixture_record_v3("résumé.pdf");
        let (cursor, records) = parse_mft_page(&page).expect("parse v3 fixture");
        assert_eq!(cursor, 84);
        assert_eq!(
            records[0].file_reference,
            "0102030405060708090a0b0c0d0e0f10"
        );
        assert_eq!(
            records[0].parent_reference,
            "100f0e0d0c0b0a090807060504030201"
        );
        assert_eq!(records[0].name, "résumé.pdf");
    }

    #[test]
    fn reconstructs_parent_late_and_orphan_records_without_looping() {
        let records = vec![
            MftRecord {
                file_reference: "2".to_string(),
                parent_reference: "1".to_string(),
                name: "child.txt".to_string(),
                timestamp: None,
                reason: 0,
                attributes: 0,
            },
            MftRecord {
                file_reference: "1".to_string(),
                parent_reference: "1".to_string(),
                name: ".".to_string(),
                timestamp: None,
                reason: 0,
                attributes: FILE_ATTRIBUTE_DIRECTORY,
            },
            MftRecord {
                file_reference: "3".to_string(),
                parent_reference: "3".to_string(),
                name: "loop".to_string(),
                timestamp: None,
                reason: 0,
                attributes: FILE_ATTRIBUTE_DIRECTORY,
            },
        ];
        let paths = reconstruct_paths("C:\\", &records);
        assert_eq!(
            paths.get("2\u{0}1\u{0}child.txt"),
            Some(&"C:\\child.txt".to_string())
        );
        assert!(paths.contains_key("3\u{0}3\u{0}loop"));
    }

    #[test]
    fn preserves_multiple_directory_entries_for_a_hard_linked_file() {
        let records = vec![
            MftRecord {
                file_reference: "7".to_string(),
                parent_reference: "1".to_string(),
                name: "left.txt".to_string(),
                timestamp: None,
                reason: 0,
                attributes: 0,
            },
            MftRecord {
                file_reference: "7".to_string(),
                parent_reference: "1".to_string(),
                name: "right.txt".to_string(),
                timestamp: None,
                reason: 0,
                attributes: 0,
            },
            MftRecord {
                file_reference: "1".to_string(),
                parent_reference: "1".to_string(),
                name: ".".to_string(),
                timestamp: None,
                reason: 0,
                attributes: FILE_ATTRIBUTE_DIRECTORY,
            },
        ];
        let paths = reconstruct_paths("C:\\", &records);
        assert_eq!(
            paths.get("7\u{0}1\u{0}left.txt"),
            Some(&"C:\\left.txt".to_string())
        );
        assert_eq!(
            paths.get("7\u{0}1\u{0}right.txt"),
            Some(&"C:\\right.txt".to_string())
        );
    }

    #[test]
    fn malformed_mft_pages_are_integrity_errors() {
        let error = parse_mft_page(&[1, 2, 3]).expect_err("short page must fail closed");
        assert!(is_integrity_error(&error));

        let error = parse_mft_page(&[0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3])
            .expect_err("non-zero truncated tail must fail closed");
        assert!(is_integrity_error(&error));
    }
}
