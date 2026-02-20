# Phase 7: Advanced Detection & Sanitization

## Narrative
This phase focused on increasing the overall resilience of the photo repair pipeline. We introduced a new frontend detection heuristic specifically designed to catch files that report an adequate file size but are structurally "hollow" because the actual high-resolution JPEG bitstream is missing or has been overwritten by an embedded thumbnail payload.

Concurrently, we ported our core TypeScript JPEG marker sanitization logic into the Python engine (`marker_sanitization.py`). This allows the system to forcefully remove invalid entropy-coded markers, preventing decoders from failing prematurely. It represents a key "fail-safe" baseline recovery mechanism inside the engine.

Finally, we improved the user experience for our Header Grafting strategy by connecting the `ReferenceManager` to the execution queue via a new IPC channel `reference:autoSearch`. Now, when a corrupted file is analyzed and Header Grafting is determined to be the ideal fallback, the frontend immediately scans the library of healthy references to secure a matching donor automatically.

## Completed Tasks
- [x] **Hollow File Detection:** Added `'hollow_header'` to `CorruptionType`. Updated `FileAnalyzer.ts` to flag files with sizes `< 50KB` and resolutions implying `> 1MP`. Added corresponding Unit Tests.
- [x] **Marker Sanitization Engine Strategy:** Developed and registered `MarkerSanitizationStrategy` inside the python engine (`main.py`, `strategies/marker_sanitization.py`). Includes pytest automated fixtures checking specific bit repairs.
- [x] **Reference Manager Auto-search Mechanism:** Created `scanReferenceFolder` method in `ReferenceManager.ts`. Linked an IPC resolver up to `main.ts` and triggered it via a React `useEffect` inside `StrategyStep.tsx`.
- [x] **Detailed Execution Transparency:** Captured process `stderr` emissions via `PythonEngineService.ts` and connected it to an expandable `ExecutionStep.tsx` terminal window for deep level diagnostic tracking.

## Diff Narrative
*   **Added** `engine/strategies/marker_sanitization.py` to handle targeted bit-patching logic.
*   **Added** `engine/tests/test_marker_sanitization.py` to assert the byte-level edits were executing securely.
*   **Modified** `electron/services/FileAnalyzer.ts` logic to detect and confidently suggest strategies for thumbnail-only files.
*   **Modified** `electron/services/ReferenceManager.ts` by importing `fs` alongside a newly architected library injection pattern.
*   **Modified** `electron/main.ts` & `electron/preload.ts` to manage and safely expose the API bridge to the frontend.
*   **Modified** `src/components/RepairWizard/steps/StrategyStep.tsx` & `ExecutionStep.tsx` to handle auto-loaded fields and dynamic data rendering.

## Associated Risks & Assumptions
*   **Risk:** `fs.readdirSync` in `scanReferenceFolder` is a synchronous block on the IPC thread. 
    * *Assumption:* It won't freeze the application since the references directory is expected to maintain a relatively small (< 1,000 count) scope.
*   **Risk:** `stderr` logging might flood the UI memory.
    * *Assumption:* We explicitly sliced the incoming state buffer to 50 lines representing standard diagnostic throughput without performance penalties.
