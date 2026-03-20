# Change Log: Phase 04 TIFF & RAW Structure Repair
## Epic: Multi-Format Support

### Diff Narrative
**Files Created/Modified:**
- `electron/lib/tiff/parser.ts` & `parser.test.ts`
- `engine/strategies/tiff_ifd_rebuilder.py`
- `engine/main.py` (registered `tiff-ifd-rebuilder`, `.tiff` output extension)
- `electron/services/FileAnalyzer.ts` (TIFF/RAW analysis branch)

**Behavior Changes:**
- TIFF-based files (`.tiff`, `.arw`, `.cr2`, `.nef`, `.dng`) are now parsed using a full byte-order-aware IFD walker.
- Detects: invalid offsets pointing outside the file, cyclic IFD pointer chains (infinite loops), and missing TIFF magic numbers.
- `tiff_ifd_rebuilder.py` strategy:
  - Reads the reference file's IFD chain, finding the full-resolution IFD (SubfileType == 0).
  - Copies the corrupted RAW sensor bytes intact into the output file.
  - Overwrites only the IFD directory block from the reference — fixing all broken pointers without touching sensor data.
  - Handles edge case where the IFD block falls outside file bounds (appends at EOF and updates header pointer).
- RAW files now always offer both `preview-extraction` (quick donor-free) and `tiff-ifd-rebuilder` (full structural repair) as strategy options.

**Tests Added:**
- TDD unit tests for `parseTiffIfds()` covering: LE/BE signatures, invalid offsets, cyclic IFDs, IFD entry discovery.
- Tests pass via vitest.

**Assumptions Made & Risks Identified:**
- IFD transplant relies on matching raw data locations between corrupted file and reference. If the camera wrote data at different offsets per shot, the transplanted offsets may not match the corrupted file's data.
- The output extension `.tiff` is used to represent all RAW repair outputs. Native `.arw`, `.cr2` etc. output is a future enhancement (requires format-specific validation at write time).
