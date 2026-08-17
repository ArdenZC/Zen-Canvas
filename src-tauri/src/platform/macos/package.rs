//! macOS package classification.
//!
//! `NSURLIsPackageKey` is the primary classifier on macOS. Known package
//! suffixes remain a conservative safety fallback even when Foundation
//! explicitly reports `false`: a package-shaped directory must not be opened
//! recursively merely because a synthetic or third-party package is not
//! registered with Launch Services. This classifier never grants mutation
//! access.

use std::path::Path;

const KNOWN_PACKAGE_SUFFIXES: &[&str] = &[
    ".app",
    ".bundle",
    ".framework",
    ".plugin",
    ".kext",
    ".xcodeproj",
    ".xcworkspace",
    ".playground",
    ".rtfd",
    ".pages",
    ".numbers",
    ".key",
    ".photoslibrary",
];

/// Returns whether a path should be treated as one logical package entity.
pub fn is_package(path: &Path) -> bool {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return false;
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return false;
    }

    #[cfg(target_os = "macos")]
    if let Some(is_package) = foundation_is_package(path) {
        return is_package || is_known_package_suffix(path);
    }

    is_known_package_suffix(path)
}

/// Pure fallback classifier used by the native adapter and its large mixed
/// corpus regression test.
pub fn is_known_package_suffix(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let name = name.to_ascii_lowercase();
    KNOWN_PACKAGE_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix))
}

#[cfg(target_os = "macos")]
fn foundation_is_package(path: &Path) -> Option<bool> {
    use objc2::rc::autoreleasepool;
    use objc2_foundation::{NSArray, NSNumber, NSString, NSURLIsPackageKey, NSURL};

    autoreleasepool(|_| {
        let path = path.to_str()?;
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));
        let key = unsafe { NSURLIsPackageKey };
        let keys = NSArray::from_slice(&[key]);
        let values = url.resourceValuesForKeys_error(&keys).ok()?;
        values
            .objectForKey(key)
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .map(|value| value.as_bool())
    })
}

#[cfg(test)]
mod tests {
    use super::{is_known_package_suffix, KNOWN_PACKAGE_SUFFIXES};
    use std::path::Path;

    #[test]
    fn fallback_classifier_covers_known_package_suffixes_case_insensitively() {
        for suffix in KNOWN_PACKAGE_SUFFIXES {
            let path = Path::new("/tmp/Example").join(format!("Fixture{suffix}"));
            assert!(is_known_package_suffix(&path), "suffix {suffix}");
            let upper = suffix.to_ascii_uppercase();
            let path = Path::new("/tmp/Example").join(format!("Fixture{upper}"));
            assert!(is_known_package_suffix(&path), "suffix {upper}");
        }
        assert!(!is_known_package_suffix(Path::new("/tmp/report.txt")));
    }

    #[test]
    fn mixed_package_corpus_classifies_ten_thousand_entries_without_recursing() {
        let mut package_count = 0;
        for index in 0..10_000 {
            let path = if index % 2 == 0 {
                Path::new("/tmp").join(format!("fixture-{index}.app"))
            } else {
                Path::new("/tmp").join(format!("fixture-{index}.txt"))
            };
            if is_known_package_suffix(&path) {
                package_count += 1;
            }
        }
        assert_eq!(package_count, 5_000);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_classifier_keeps_directories_atomic_and_rejects_package_symlinks() {
        use super::is_package;
        use std::fs;

        let root =
            std::env::temp_dir().join(format!("zen-canvas-package-{}", uuid::Uuid::new_v4()));
        let ordinary = root.join("ordinary");
        let package = root.join("Fixture.app");
        let nested = package.join("Contents/Resources/Nested.bundle");
        let package_link = root.join("Fixture-link.app");
        fs::create_dir_all(&nested).expect("create package fixture");
        fs::create_dir_all(&ordinary).expect("create ordinary fixture");
        std::os::unix::fs::symlink(&package, &package_link).expect("create package symlink");

        assert!(!is_package(&ordinary));
        assert!(is_package(&package));
        assert!(is_package(&nested));
        assert!(!is_package(&package_link));

        fs::remove_dir_all(root).expect("remove package fixture");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_classifier_real_mixed_filesystem_corpus_is_atomic() {
        use super::is_package;
        use std::fs::{self, File};
        use std::io::Write;
        use std::time::Instant;

        let root = std::env::temp_dir().join(format!(
            "zen-canvas-package-corpus-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("create package corpus root");
        let mut fixtures = Vec::with_capacity(10_000);
        let mut expected_packages = 0usize;

        for index in 0..10_000 {
            let (name, is_package, is_file) = match index % 10 {
                0 => (format!("Fixture-{index}.app"), true, false),
                1 => (format!("Fixture-{index}.bundle"), true, false),
                2 => (format!("Fixture-{index}.framework"), true, false),
                3 => (format!("Fixture-{index}.pages"), true, false),
                4..=7 => (format!("ordinary-{index}"), false, false),
                _ => (format!("mixed-{index}.txt"), false, true),
            };
            let path = root.join(name);
            if is_file {
                let mut file = File::create(&path).expect("create mixed file");
                file.write_all(b"fixture").expect("write mixed file");
            } else if is_package {
                // A nested child makes the atomicity requirement observable:
                // the classifier must inspect the package directory itself,
                // not recursively traverse its contents.
                fs::create_dir_all(path.join("Contents/Resources/Nested.bundle"))
                    .expect("create package contents");
                expected_packages += 1;
            } else {
                fs::create_dir(&path).expect("create ordinary directory");
            }
            fixtures.push((path, is_package));
        }

        let started = Instant::now();
        let package_count = fixtures
            .iter()
            .filter(|(path, expected)| {
                let actual = is_package(path);
                assert_eq!(
                    actual,
                    *expected,
                    "package classification for {}",
                    path.display()
                );
                actual
            })
            .count();
        let elapsed = started.elapsed();
        println!(
            "macos_package_native_corpus entries={} packages={} elapsed_ms={}",
            fixtures.len(),
            package_count,
            elapsed.as_secs_f64() * 1000.0
        );
        assert_eq!(package_count, expected_packages);

        fs::remove_dir_all(root).expect("remove package corpus");
    }
}
