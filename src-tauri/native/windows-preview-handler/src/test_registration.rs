//! Deterministic registration seam for lower-level tests.
//!
//! This intentionally does not touch HKCU/HKLM or production Explorer
//! registration. It models the class-registration lifetime in-process so a
//! harness can prove register/unregister cleanup without leaving machine state.

use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
};
use windows::core::GUID;

fn registered_classes() -> &'static Mutex<HashSet<GUID>> {
    static CLASSES: OnceLock<Mutex<HashSet<GUID>>> = OnceLock::new();
    CLASSES.get_or_init(|| Mutex::new(HashSet::new()))
}

pub struct TestRegistrationScope {
    clsid: GUID,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TestRegistrationError {
    AlreadyRegistered,
}

impl TestRegistrationScope {
    pub fn register(clsid: GUID) -> Result<Self, TestRegistrationError> {
        let mut classes = registered_classes()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if !classes.insert(clsid) {
            return Err(TestRegistrationError::AlreadyRegistered);
        }
        Ok(Self { clsid })
    }

    pub fn is_registered(clsid: GUID) -> bool {
        registered_classes()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .contains(&clsid)
    }
}

impl Drop for TestRegistrationScope {
    fn drop(&mut self) {
        registered_classes()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(&self.clsid);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PREVIEW_HANDLER_CLSID;

    #[test]
    fn registration_scope_is_idempotence_checked_and_cleans_up() {
        assert!(!TestRegistrationScope::is_registered(PREVIEW_HANDLER_CLSID));
        let scope = TestRegistrationScope::register(PREVIEW_HANDLER_CLSID).unwrap();
        assert!(TestRegistrationScope::is_registered(PREVIEW_HANDLER_CLSID));
        assert!(TestRegistrationScope::register(PREVIEW_HANDLER_CLSID).is_err());
        drop(scope);
        assert!(!TestRegistrationScope::is_registered(PREVIEW_HANDLER_CLSID));
    }
}
