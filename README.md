# Photo Repair Shop

A power-user focused application for repairing corrupt, truncated, or malformed JPEG and RAW photos via advanced heuristic recovery methods, including **Header Grafting**, **Preview Extraction**, and **Marker Sanitization**.

Designed to be operated independently as a headless backend service, providing robust integration through its local Express API, alongside an Electron+React rich client interface.

## Current Status: Phase 12 (UI Polish & Enhancements) ✅

* **UI Enhancements**: 
  - Generated and integrated a modern custom App Icon for the desktop application.
  - Removed outdated default electron file menus for a cleaner GUI.
* **Explicit Save Pipeline**: 
  - Repairs are strictly constrained to temporary OS-level directories until confirmed.
  - Introduced Before/After real-time evaluation visuals leveraging Base64 data streaming over IPC channels.
  - Requires explicit `Save Output File` prompts guarding final file destination.

See `aiChangeLog/phase-12.md` for a full narrative!
