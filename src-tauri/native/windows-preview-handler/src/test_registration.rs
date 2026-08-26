//! Isolated identifiers for manual Windows Preview Handler evidence.
//!
//! This module describes the test-only registration surface; it does not
//! modify HKCU/HKLM. The harness owns any temporary registry writes and cleans
//! them through its RAII registration guard.

use windows_core::GUID;

pub const TEST_CLSID: GUID = GUID::from_u128(0x5b6e7f80_91a2_43b4_c5d6_e7f8091a2b3c);
pub const TEST_EXTENSION: &str = ".zcv2preview";
pub const TEST_PROGID: &str = "ZenCanvas.W4_03_V2.Test";
pub const PREVIEW_HANDLER_SHELLEX_CLSID: GUID =
    GUID::from_u128(0x8895b1c6_b41f_4c1c_a562_0d564250836f);

pub fn clsid_string() -> String {
    format!("{{{TEST_CLSID:?}}}")
}
