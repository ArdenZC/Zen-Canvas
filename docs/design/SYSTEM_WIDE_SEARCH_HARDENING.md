# System-wide Search Hardening

This note records the release-blocking fixes applied after the initial
system-wide search and Managed AI implementation.

## Search and index integrity

- Global Spotlight queries, open/reveal actions, aggregate counts, last-sync
  timestamps, and reported errors only consider enabled sources.
- One- and two-character queries use bounded prefix search rather than an
  unbounded contains scan across the full global index.
- MFT records are staged on disk and resolved in bounded batches; filesystem
  metadata is completed before a file is admitted to AI processing.
- macOS removed-item notifications use the previously indexed path-to-entry
  identity map when available, avoiding unnecessary full Spotlight rebuilds.

## Managed AI safety

- Existing manual classification entry points enqueue durable Managed AI jobs;
  they no longer bypass queue policy checks.
- Scope, source, provider policy, fingerprint, cancellation, and user-correction
  state are revalidated immediately before and after provider calls.
- The most-specific enabled scope owns a file, preventing overlapping scopes
  from producing duplicate local/cloud requests.
- Provider output must satisfy the typed classification schema before it is
  persisted as a successful result.
- Adding a large Managed Scope records every matching file as managed, but only
  the first 100 existing non-directory files are initially queued for AI. New
  or changed files continue to enter the normal durable queue.

## Native service boundaries

- Windows Named Pipe protocol v3 rejects remote clients, non-interactive
  sessions, executable mismatches, oversized frames, and IPC shutdown.
- Service shutdown remains SCM-only; installer hooks fail closed and roll back
  service registration when startup fails.
- macOS uses the in-process Rust Objective-C/Foundation bridge and wraps all
  external Foundation statics in explicit unsafe boundaries required by Rust.

The remaining release acceptance work is environmental rather than an open
code path: live signed/notarized macOS distribution and an interactive Windows
installer upgrade/uninstall pass.
