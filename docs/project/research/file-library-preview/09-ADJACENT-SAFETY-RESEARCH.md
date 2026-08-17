# Adjacent Safety Research — Boundary Note

> **Provenance:** this is a reconstructed boundary note, not a complete or verbatim archive of the earlier filesystem-mutation safety research. The exact original external-source revisions for that separate safety work are not preserved in this File Library / Preview evidence layer. The current Zen safety/remediation contracts — not this note — remain authoritative.

The File Library 2.0 / Preview research overlapped conceptually with a separate line of work on destructive filesystem mutation correctness and pathname race safety.

Surviving project context associates that adjacent work with reference classes such as:

- protected-path / endpoint-security models including Google's Santa;
- capability-oriented filesystem APIs such as `cap-std`;
- ordinary file-manager / trash / move implementations used to compare what typical pathname-based mutation guarantees do and do not provide.

This file intentionally does not claim exact source versions or reconstruct the full safety research from memory. If those historical details matter to a future mutation initiative, they should be independently re-researched and pinned there.

The durable conclusion relevant to File Library / Preview is narrow:

> A richer `Entry` / `Location` / content identity model improves product identity, cache identity and stale-result detection, but it must not be mistaken for proof that a pathname-based destructive mutation is race-free.

Zen therefore preserves its existing filesystem-safety, physical-identity revalidation, Operation Preview/journal, Safe Trash and Restore authorities rather than letting File Library 2.0 or Preview invent a replacement mutation path.

This directory does **not** duplicate the full mutation-correctness research because that work belongs to the existing mutation/security remediation evidence and production safety contracts. The File Library/Preview program consumes those authorities as fixed dependencies.

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