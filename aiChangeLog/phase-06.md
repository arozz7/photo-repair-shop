# Phase 6: Strategy Implementations

## Narrative
In Phase 6, we implemented the first two functional Python strategies to replace the Mock execution bridge instantiated in Phase 5. The primary objective was to ensure highly stable repair logic using safe techniques targeting corrupted data.

### Approach Decisions
- We chose **Raw Binary Carving** for the `Preview Extraction` strategy instead of relying on external metadata tools like exiftool, guaranteeing success even if EXIF headers are entirely missing.
- We chose **Raw Python Binary Operations** for `Header Grafting` instead of high-level image libraries to prevent fatal system crashes when interfacing with deeply corrupted bitstreams.

### Implementation Details
- Hand-wrote `preview_extraction.py` which searches the byte array of `.cr2`/`.nef`/`.arw` files for JPEG SOI (`FF D8 FF E1`) and EOI (`FF D9`) markers and extracts the largest payload. 
- Hand-wrote `header_grafting.py` which searches for the SOS variable boundary (`FF DA`) in both the donor file and the corrupt target, cleanly concatenating the healthy reference header against the intact target bitstream.
- Unit tested both strategies to 100% completion in `engine/tests`.
- Rewired `main.py` to route the Electron `child_process` CLI arguments (`--strategy header-grafting`) natively against the correct python class.
- Rewired the React Context and Electron IPC bounds for `dialog:saveFile`. The React UI now tracks the `jobId` and forwards it upon saving, allowing `main.ts` to execute `fs.copyFileSync` and securely transport the hidden, newly minted Python engine payload directly to the User's selected permanent Save destination.

### Bug Fixes & Technical Refinements
- **Python Module Resolution**: Fixed `ModuleNotFoundError` when spawning Python from `dist-electron` by injecting the engine script's directory into `sys.path` dynamically.
- **React State Preservation**: Fixed a critical bug in `App.tsx` where the target file path was dropped from the execution payload, causing Python to receive an `unknown` input path.
- **JPEG Segment Traversal**: Overhauled the SOS (`FF DA`) marker detection in `header_grafting.py`. Replaced naive bitstream scanning with a strict dynamic segment length parser. This prevents "Thumbnail Collisions" by skipping `APP1` EXIF payloads and embedded thumbnails.
- **Reference Persistence**: Upgraded the SQLite schema to include `reference_path` in `repair_operations`, allowing the user-selected donor file to survive the asynchronous job queue process.

### Architecture Changes
- **Database**: Added `reference_path` column to `repair_operations`.
- **UI**: Implemented a native OS file picker in `StrategyStep.tsx` for donor selection.
- **Strategy**: Added a 128KB search boundary and `FF DA 00` signature check to the bitstream scraper fallback.

All Python tests are passing. Note: Node.js tests for `better-sqlite3` fail in the terminal due to an environment mismatch between Node 22 and Electron 33, but the application runtime remains functional.

---
*Commit Protocol: Conventional Commits based on Phase 06 Narrative.*
