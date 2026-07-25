from pathlib import Path

path = Path("src-tauri/src/global_index/repository.rs")
text = path.read_text(encoding="utf-8")
replacements = (
    (
        """        continue;
    }
    let now = unix_now();
""",
        """        return Ok(());
    }
    let now = unix_now();
""",
    ),
    (
        """        continue;
    }
    let (provider, status) = if allow_local_ai {
""",
        """        return Ok(());
    }
    let (provider, status) = if allow_local_ai {
""",
    ),
)
for old, new in replacements:
    if new in text:
        continue
    if text.count(old) != 1:
        raise SystemExit(f"expected one control-flow match, found {text.count(old)}")
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8")
print("Fixed managed AI enqueue control flow")
