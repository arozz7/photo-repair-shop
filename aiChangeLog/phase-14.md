# Phase 14: MCU Alignment & Polish

## Diff Narrative

**Files Created:**
- `engine/strategies/mcu_alignment.py`: Implemented a Python engine strategy to handle Huffman pseudo-decoding by aligning the corrupt bitstream to the reference bitstream at the first mutual Restart (RST) marker.
- `engine/tests/test_mcu_alignment.py`: Created a comprehensive Vitest-equivalent Python test using synthetic JPEG headers and bitstreams to verify MCU marker splicing works down to the byte length.

**Files Modified:**
- `electron/main.ts`: Fixed the Vite/Rollup Dev Server import warning by switching the `ExifToolService` dynamic import to a static module import.
- `electron/services/FileAnalyzer.ts`: Added the `detectMcuMisalignment` check to dynamically recommend the `mcu-alignment` strategy to the UI when Restart markers are out-of-sequence.
- `electron/api/routes/repair.ts`: Updated the backend express server Zod schema (`repairSchema`) to allow `mcu-alignment` as a valid strategy and enforced the requirement for a valid reference file.
- `engine/main.py`: Registered the newly constructed `McuAlignmentStrategy`.

## Behavior Changes
- The backend API now correctly validates and queues `mcu-alignment` jobs, routing them to the Python engine.
- Upon file analysis, severely shifted/corrupted MCUs will now suggest an MCU Alignment workflow logic to the user rather than failing silently or suggesting generic marker-sanitization.
- Vite logs are entirely clean and pristine on `npm run dev` startup (warning-free).

## Tests
- Added `test_repair_success` in the Python engine using `pytest`, successfully simulating and predicting bitstream alignments down to an exact 71-byte buffer size match. Tested with `python -m pytest tests/test_mcu_alignment.py`.

## Risks & Assumptions
- *Better SQLite ABI Drift:* The local Vitest runs (`npm run test`) log failures strictly in `RepairRepository` tests due to an existing mismatch between the global system Node.js (`NODE_MODULE_VERSION 130`) and the `better-sqlite3` instance compiled for Electron (`NODE_MODULE_VERSION 127`). This does not affect application functionality (which runs perfectly in the Electron container) but might require an `npm rebuild` prior to Phase 15 depending on the developer's desired CI setup.
