# Spacedrive v2 — Research Notes

Official source: https://github.com/spacedriveapp/spacedrive

## Why we studied it

Spacedrive was the strongest architectural reference for the **File Library / object / location** side of the initiative. It is a cross-platform file manager built around a virtual distributed filesystem and a Rust core, so it exposes many of the same questions Zen must answer even though Zen's product scope is deliberately narrower.

The research question was not “should Zen become Spacedrive?” It was:

> How should Zen model a file when the user-facing object, the current pathname and the storage/location context are not the same thing?

## Official-source facts that mattered

Spacedrive describes itself as a cross-platform file manager powered by a virtual distributed filesystem. Its product model explicitly spans multiple devices/locations rather than treating one pathname as the complete identity of an item.

During the original research we also inspected its implementation approach for ordinary filesystem operations and observed that common file-manager operations still ultimately rely on ordinary OS/path-based mutation primitives. That reinforced an important distinction: a useful object/location model improves product and cache identity, but it does not magically solve every destructive-mutation race.

## Main observations

### 1. Logical object identity should not be the pathname

A rename or move changes a path string but often does not represent “a completely different file” from the user's perspective.

Zen therefore adopted the stronger invariant:

```text
File / Entry identity != PhysicalPath
```

Path remains a routing/resolution fact. Durable identity, cache identity and publication rights should prefer a backend-verified identity where one exists.

### 2. Location deserves first-class modeling

A location is not only a string prefix. It carries state and policy such as:

- managed vs ephemeral;
- local vs external/network/provider-backed;
- availability;
- freshness/reconciliation state;
- platform/runtime capability.

This directly influenced Zen's `LocationRef` / `LocationDescriptor` direction.

### 3. Nested or multiple locations are a normal product reality

Users may work with several roots, devices and provider-backed folders. Zen should not assume one monolithic managed root or let “being inside a path” automatically decide durable authority.

### 4. Cross-platform Rust is useful, but platform truth still matters

Spacedrive validated that a large part of the file-domain core can be cross-platform. Zen adopted that idea selectively: shared Rust contracts and service boundaries are desirable, but provider/materialization/native-preview behavior must still remain explicit platform adapters rather than being flattened into fake parity.

## Adopted by Zen

- `Entry` / file identity separated from path.
- `Location` as a first-class domain projection rather than a raw path string.
- identity-preserving rename/move where verified physical/content identity survives.
- shared cross-platform domain contracts with platform-specific capability adapters.
- Library state and location state kept distinct enough that availability cannot be mistaken for deletion.

## Adapted, not copied

Spacedrive's distributed/VDFS ambitions are broader than Zen's.

Zen keeps:

- the user's existing filesystem as the primary reality;
- managed File Library semantics as an optional value layer;
- Ephemeral Browse as a valid mode without prior indexing.

Zen does **not** require users to adopt a distributed-library model before they can browse or preview files.

## Explicitly rejected

- turning Zen into a distributed filesystem or cloud-drive replacement;
- importing Spacedrive persistence/job architecture wholesale;
- assuming a logical object model alone solves destructive filesystem race safety;
- requiring every unmanaged location to become a managed Library location.

## Downstream influence

This research materially influenced:

- W0-B Library/Browse product model;
- W0-C `EntryRef`, `LocationRef`, Browse identity and promotion semantics;
- W1-01 Contract Spine;
- W1-03 Ephemeral Browse Core;
- W1-04 Location Core;
- W1-08 durable thumbnail cache identity;
- W2 File Library 2.0 workspace design.

## Design statement preserved from the research

> Zen should borrow Spacedrive's strongest identity/location lesson without inheriting its product scope: a file is more than its current pathname, but Zen remains a local-first workspace around the user's existing filesystem rather than a new distributed filesystem.