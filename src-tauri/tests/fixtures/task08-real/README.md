# Task 08 real-application fixtures

These fixtures are saved from LibreOffice 26.2 (headless conversion from the
flat OpenDocument sources in this directory) and are test inputs only. The
product never invokes LibreOffice, Python, Tesseract, or another executable.

- `task08-multipage.docx`: two text pages, an entity, and a comment.
- `task08-multisheet.xlsx`: two worksheets with shared and inline strings.
- `task08-multislide.pptx`: two slides with text and an entity.
- `task08-multipage.pdf`: two text-layer pages generated from the same source.

The generated Office Open XML files are consumed by the in-process Rust
extractors. No source content, path, or provider credential is included.
