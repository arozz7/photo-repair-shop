# Change Log: Phase 02 PNG Support
## Epic: Multi-Format Support

### Diff Narrative
**Files Created/Modified:**
- `electron/lib/png/parser.ts` & `parser.test.ts`
- `engine/strategies/png_chunk_rebuilder.py`
- `engine/main.py`
- `src/components/RepairWizard/steps/StrategyStep.tsx`

**Behavior Changes:**
- The application can now parse PNG `IHDR`, `IDAT`, and `IEND` chunks and validate payload integrity via `CRC32`.
- When PNGs are submitted with missing IHDR or corrupt IDATs, the backend python engine can graft healthy headers by matching a provided donor file from the user's filesystem.
- React frontend: The Strategy panel's Donor component is now dynamic (`requiresReference`), rather than hardcoded to `header-grafting`. This allows any strategy, including our new `png-chunk-rebuilder`, to automatically pop up the Donor component when needed.
- `engine/main.py` dynamically selects output extensions (`.png`, `.jpg`, etc.) rather than hard-coding `.jpg`.

**Tests Added:**
- Provided TDD Unit Tests for `parsePngChunks()`, ensuring `IHDR` and missing/broken chunks trace properly inside vitest. Test suite passed.

**Assumptions Made & Risks Identified:**
- CRC calculation in JS is done effectively but could be performance heavy for massive 40MP PNGs.
- `png-chunk-rebuilder` is designed to be forgiving on IDAT payloads, allowing partial renders.
