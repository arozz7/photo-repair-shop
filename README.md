# Photo Repair Shop

A power-user focused application for repairing corrupt, truncated, or malformed JPEG and RAW photos via advanced heuristic recovery methods, including **Header Grafting**, **Preview Extraction**, and **Marker Sanitization**.

Designed to be operated independently as a headless backend service, providing robust integration through its local Express API, alongside an Electron+React rich client interface.

## Current Status: Phase 1 (Foundation Setup) ✅

* **Scaffolded**: Electron, React, TypeScript, and Vite.
* **Database**: Embedded SQLite leveraging `better-sqlite3` w/ WAL mode.
* **Security**: API endpoints guarded by dynamic Token Authentication generating to `~/.photo-repair-shop/api-token`.
* **Utilities**: 
  - `FileAnalyzer`: Analyzes JPEGs for missing SOIs, SOS markers, and corrupted headers.
  - `ExifToolService`: Handles binary previews and structural layout diagnosis.
* **Test Coverage**: TDD verification implemented (20/20 test suites passing!).

See `aiChangeLog/phase-01.md` for a full narrative!
