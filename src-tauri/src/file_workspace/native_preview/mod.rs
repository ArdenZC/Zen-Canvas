//! W4 request-scoped native Preview bridge primitives.
//!
//! This module owns disposable native presentation/request state only. It does
//! not replace PreviewSession, MaterializationReadGate, provider selection,
//! managed/ephemeral identity, or filesystem mutation/recovery authorities.

pub(crate) mod access;
pub(crate) mod host_provided;
