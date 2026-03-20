# Change Log: Phase 03 HEIC / ISOBMFF Support
## Epic: Multi-Format Support

### Diff Narrative
**Files Created/Modified:**
- `electron/lib/heic/parser.ts` & `parser.test.ts`
- `engine/strategies/heic_box_recovery.py`
- `engine/main.py` (registered new strategy + `.heic` output extension)
- `electron/services/FileAnalyzer.ts` (HEIC analysis branch)
- `src/components/RepairWizard/steps/StrategyStep.tsx` (HEIC + TIFF icons pre-added)

**Behavior Changes:**
- The app now reads the first 2MB of `.heic` / `.heif` files and walks their ISOBMFF box tree to detect missing `ftyp`, `meta`, or `mdat` containers.
- A missing or invalid `ftyp` marks the file as corrupted with `heic_missing_meta`.
- A missing `mdat` marks the file as corrupted with `heic_broken_mdat`.
- `heic_box_recovery.py` supports two repair modes:
  - **Transplant** (preferred): Extracts the `mdat` payload from the corrupted file and injects it into a reference HEIC shot from the same iOS device, preserving all the item location tables.
  - **Minimal container** (fallback): Wraps the raw `mdat` payload in a minimum viable `ftyp + mdat` shell without a reference file.
- `engine/main.py` now dispatches `.heic` output extension for this strategy.

**Tests Added:**
- TDD tests for `parseHeicBoxes()` verifying: valid `ftyp` detection, `heic` brand recognition, missing `mdat` detection, `mdatOffset` and `mdatSize` accuracy.

**Assumptions Made & Risks Identified:**
- The transplant strategy does NOT rewrite iOS `iloc` (item location) byte offsets, which may cause some strict viewers to fail. Phase 4 TIFF work could include proper `iloc` rewriting as an extension.
- Best-effort minimal container may not display in all viewers but preserves the HEVC stream for forensic extraction.
