# Change Log: Phase 01 Architecture
## Epic: Multi-Format Support

### Diff Narrative
**Files Modified:**
- `electron/services/FileAnalyzer.ts`

**Behavior Changes:**
- Expanded the `CorruptionType` union to include markers for PNG, HEIC, and TIFF specific errors (e.g. `png_missing_ihdr`).
- Expanded the `fileType` union and `getFileType` helper to correctly identify `.png`, `.heic`, `.heif`, `.tif`, and `.tiff` structures.
- Added strategy bindings: `'png-chunk-rebuilder'`, `'heic-box-recovery'`, and `'tiff-ifd-rebuilder'`.

**Tests Added:**
- Updated the base generic types; no unit tests added purely for union types, but will be covered in API route schemas if necessary.

**Assumptions Made & Risks Identified:**
- Python engine is expected to receive `--strategy tiff-ifd-rebuilder`, etc., which will be supported in upcoming phases.
- We must ensure Zod schema validates the API layer to permit these new strategies.
