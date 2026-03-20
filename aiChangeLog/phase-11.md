# Phase 11: Advanced Engine Work

## Status: ✅ Completed

## Primary Objectives
1. **Reference File Pipeline:** Expand support to handle batch processing seamlessly and accept a wider range of format profiles.
2. **MCU Alignment Detection & Correction:** Implement detection and correction of Minimum Coded Unit shifts in JPEG bitstreams.
3. **Invalid Marker Sanitization:** Auto-detect and fix invalid `FF xx` sequences in JPEG bitstreams.

## Completed Tasks
- [x] Task 11.5: Created `aiChangeLog/phase-11.md`.
- [x] Task 11.2: Expanded Reference File Pipeline to support more profiles and batch execution.
- [x] Task 11.3: Implemented `McuAlignmentStrategy` for patching shifted JPEG chunks using a reference file.
- [x] Task 11.4: Verified `MarkerSanitizationStrategy` for stripping invalid `FF` binary sequences.

## Diff Narrative
- Mapped out Phase 11 focusing on MCU Alignment, Marker Sanitization, and expanding the reference pipeline.
- Modified `ReferenceManager` to use a `validExts` array for validating a wider range of native RAW formats (`.dng`, `.cr3`, etc.).
- Implemented `findBestReference` to seamlessly query the database and rank candidates for a batch of input files.
- Mocked out `better-sqlite3` and `fs` in `ReferenceManager.test.ts` to execute cleanly in Node without dev-server binary locks.
- Implemented `McuAlignmentStrategy.ts` and its test suite to safely graft a healthy initialization byte-block from a reference stream onto a corrupted binary buffer, effectively realigning misaligned Minimum Coded Units.
- Verified that `MarkerSanitizationStrategy` and its test suites correctly sanitize internal bitstreams without breaking existing headers.

