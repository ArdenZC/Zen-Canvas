from pathlib import Path

path = Path("src-tauri/src/global_index/macos/spotlight.rs")
text = path.read_text(encoding="utf-8")
for key in (
    "NSMetadataQueryUpdateAddedItemsKey",
    "NSMetadataQueryUpdateChangedItemsKey",
    "NSMetadataQueryUpdateRemovedItemsKey",
):
    safe = f"unsafe {{ {key} }}"
    if safe in text:
        continue
    old = f"            {key},"
    if text.count(old) != 1:
        raise SystemExit(f"expected one unwrapped {key}, found {text.count(old)}")
    text = text.replace(old, f"            {safe},")
path.write_text(text, encoding="utf-8")
print("Wrapped Spotlight update notification keys")
