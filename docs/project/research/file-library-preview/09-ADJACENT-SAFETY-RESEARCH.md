# Adjacent Safety Research — Boundary Note

The File Library 2.0 / Preview research overlapped with a separate line of work on destructive filesystem mutation correctness and pathname race safety.

That adjacent research included references such as:

- Google's Santa / Endpoint Security protected-path model;
- capability-oriented filesystem APIs such as `cap-std`;
- ordinary file-manager / trash / move implementations (including Spacedrive and other native/open-source tools) used to compare what typical pathname-based mutation guarantees do and do not provide.

The durable conclusion relevant to File Library / Preview is narrow:

> A richer `Entry` / `Location` / content identity model improves product identity, cache identity and stale-result detection, but it must not be mistaken for proof that a pathname-based destructive mutation is race-free.

Zen therefore preserves its existing filesystem-safety, physical-identity revalidation, operation preview/journal, Safe Trash and Restore authorities rather than letting File Library 2.0 or Preview invent a replacement mutation path.

This directory does **not** duplicate the full mutation-correctness research because that work belongs to the existing macOS mutation/security remediation evidence and production safety contracts. The File Library/Preview program consumes those authorities as fixed dependencies.

## Adopted by the File Library / Preview program

- identity and path are separate concepts;
- source identity/version is revalidated at sensitive publication/read boundaries;
- Quick Preview remains read-only;
- Thumbnail/Preview never gain mutation authority merely because they resolved a file;
- W1/W2/W3 must not rewrite filesystem mutation/recovery systems.

## Explicitly rejected

- treating a durable Library/file ID as automatic authorization to mutate whatever currently exists at an old path;
- building a second move/delete/trash implementation inside Browse/Preview;
- using external reference projects' ordinary pathname mutation behavior as evidence that Zen's stronger safety contracts can be relaxed.

If future work needs to change destructive mutation correctness, open or extend the dedicated safety/remediation initiative rather than expanding File Library / Preview scope.