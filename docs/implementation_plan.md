# Photo Repair Shop — Implementation Plan (v2)

## Goal
Build a power-user focused photo repair application using Electron + React + TypeScript,
implementing header grafting, preview extraction, MCU alignment detection, batch processing,
and a secure local API for integration with Smart Photo Organizer.

---

## Cross-Cutting Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ExifTool integration | `exiftool-vendored` npm package | Matches SPO, handles binary path/process pooling automatically |
| Image processing | `sharp` (pin to `0.34.x`) | Matches SPO version, faster than Jimp, native bindings |
| API framework | `express` with `express-rate-limit` | Lightweight, well-understood, easy to test |
| Database | `better-sqlite3` | Matches SPO, synchronous API, fast |
| MCU Alignment (MVP) | Detection-only | Full Huffman pseudo-decoding is post-MVP; header grafting resolves most MCU issues |
| SPO polling model | SPO polls `GET /api/status/:jobId` | Simplest integration; no callback server needed on SPO side |

---

## Security Model

### Threat Surface
Both apps run on the same machine. The API binds to `127.0.0.1` only (no LAN exposure).
The attack surface is local processes, not network. Still: no unauthenticated endpoints.

### Token-Based Auth
1. On PRS startup, generate a cryptographically random UUID token (`crypto.randomUUID()`)
2. Write to `~/.photo-repair-shop/api-token` (home dir, not userData — predictable path for SPO)
3. SPO reads this file before making any API call; includes it as `Authorization: Bearer <token>`
4. PRS validates on every request via Express middleware; reject with `401` if missing or wrong
5. Token regenerates on every PRS restart (short-lived)

```typescript
// electron/api/auth.ts
export function generateAndPersistToken(): string {
  const token = crypto.randomUUID();
  const tokenPath = path.join(os.homedir(), '.photo-repair-shop', 'api-token');
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, token, { mode: 0o600 }); // owner read-only
  return token;
}

export function createAuthMiddleware(token: string): RequestHandler {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}
```

### Server Hardening
- Bind to `127.0.0.1` only — never `0.0.0.0`
- CORS: allow only `app://` (Electron renderer origin)
- Body size limit: `1mb` (file paths only — never file contents over HTTP)
- Rate limit: `express-rate-limit` — 100 requests/min per IP
- All inputs validated with **Zod** at request boundary
- No PII, no token values in logs

---

## Full API Contract

### Base URL: `http://127.0.0.1:3847/api`
All endpoints require `Authorization: Bearer <token>` header.

---

### `GET /api/health`
No auth required (used for availability check before token is read).

**Response 200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 42.5
}
```

---

### `POST /api/analyze`
Analyze a file and detect corruption type(s).

**Request body:**
```typescript
{
  filePath: string;           // Absolute path to corrupt file
  metadata?: {
    cameraModel?: string;     // From SPO's metadata_json (helps reference matching)
    resolution?: string;      // e.g. "6000x4000"
    fileFormat?: string;      // e.g. "CR2", "JPEG"
  };
  sourcePhotoId?: number;     // SPO photo ID (echoed back in status/result)
}
```

**Response 202:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Response 400:** Zod validation failure
**Response 404:** `filePath` does not exist on disk

---

### `POST /api/repair`
Execute a repair strategy on an analyzed file.

**Request body:**
```typescript
{
  filePath: string;
  strategy: 'header-grafting' | 'preview-extraction' | 'marker-sanitization';
  outputPath: string;                  // Where to write repaired file
  referenceFilePath?: string;          // Required for header-grafting
  candidateReferences?: string[];      // Ordered list from SPO; PRS validates & picks best
  autoEnhance?: boolean;               // Apply histogram normalization post-repair (default: false)
  sourcePhotoId?: number;              // Echoed back in result
}
```

**Response 202:**
```json
{
  "jobId": "550e8400-...",
  "status": "queued"
}
```

**Response 400:** Invalid strategy or missing required reference
**Response 409:** Job already in progress for this file

---

### `POST /api/batch`
Queue a batch repair job.

**Request body:**
```typescript
{
  filePaths: string[];                 // All must exist
  strategy: 'header-grafting' | 'preview-extraction' | 'marker-sanitization';
  outputDir: string;                   // Output directory (must exist)
  referenceFilePath?: string;
  candidateReferences?: string[];
  autoEnhance?: boolean;
}
```

**Response 202:**
```json
{
  "jobId": "550e8400-...",
  "status": "queued",
  "fileCount": 47
}
```

---

### `GET /api/status/:jobId`
Poll for job progress. SPO calls this every 2 seconds until `status` is `done` or `failed`.

**Response 200:**
```typescript
{
  jobId: string;
  status: 'queued' | 'analyzing' | 'repairing' | 'verifying' | 'done' | 'failed';
  stage?: string;            // Human-readable sub-stage description
  percent?: number;          // 0–100
  sourcePhotoId?: number;    // Echoed from original request
  result?: {                 // Present when status === 'done'
    repairedFilePath: string;
    strategy: string;
    verificationTier: 'structural' | 'entropy' | 'decode' | 'thumbnail';
    isVerified: boolean;
    warnings: string[];
  };
  batchProgress?: {          // Present for batch jobs
    processedCount: number;
    totalCount: number;
    failedCount: number;
    results: BatchFileResult[];
  };
  error?: string;            // Present when status === 'failed'
}
```

**Response 404:** Unknown jobId (expired or never existed)

---

### `GET /api/references`
Find compatible reference files from PRS's own reference library (user-managed).
SPO also has its own reference discovery on its side.

**Query params:**
```
?cameraModel=Canon+EOS+R5&resolution=6000x4000&format=CR2
```

**Response 200:**
```json
{
  "references": [
    {
      "filePath": "/path/to/reference.CR2",
      "cameraModel": "Canon EOS R5",
      "resolution": "6000x4000",
      "compatibilityScore": 0.95
    }
  ]
}
```

---

## Phase 1: Foundation

### Project Scaffold

#### [NEW] `package.json`
```json
{
  "dependencies": {
    "electron": "^33.x",
    "react": "^18.x",
    "typescript": "^5.x",
    "express": "^4.x",
    "express-rate-limit": "^7.x",
    "cors": "^2.x",
    "zod": "^3.x",
    "better-sqlite3": "^9.x",
    "exiftool-vendored": "^34.0.0",
    "sharp": "^0.34.x",
    "uuid": "^9.x"
  },
  "devDependencies": {
    "vitest": "^2.x",
    "vite": "^5.x",
    "@types/express": "^4.x",
    "@types/better-sqlite3": "^7.x",
    "@types/cors": "^2.x"
  },
  "scripts": {
    "dev": "...",
    "build": "...",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  }
}
```

#### [NEW] `electron/main.ts`
- Electron main process entry point
- Window creation, IPC handler registration
- On startup: call `generateAndPersistToken()`, then start API server with that token

#### [NEW] `src/App.tsx`
- React app shell with routing

#### [NEW] `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`

---

### Database Setup

#### [NEW] `electron/db/database.ts`
```typescript
// Initialize SQLite with better-sqlite3
// Create all tables on first run

CREATE TABLE IF NOT EXISTS repair_operations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id           TEXT UNIQUE NOT NULL,
  source_photo_id  INTEGER,           -- SPO photo ID (nullable)
  source_app       TEXT DEFAULT 'manual', -- 'spo' | 'manual'
  original_path    TEXT NOT NULL,
  repaired_path    TEXT,
  strategy         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued',
    -- queued | analyzing | repairing | verifying | done | failed
  stage            TEXT,
  percent          INTEGER DEFAULT 0,
  error_message    TEXT,
  warnings_json    TEXT,              -- JSON array of warning strings
  verification_tier TEXT,
  is_verified      INTEGER DEFAULT 0, -- BOOLEAN
  auto_enhance     INTEGER DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_repair_ops_status ON repair_operations(status);
CREATE INDEX IF NOT EXISTS idx_repair_ops_job_id ON repair_operations(job_id);

CREATE TABLE IF NOT EXISTS reference_library (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path       TEXT UNIQUE NOT NULL,
  camera_model    TEXT,
  resolution      TEXT,
  file_format     TEXT,
  added_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### [NEW] `electron/db/RepairRepository.ts`
```typescript
interface IRepairRepository {
  createJob(job: CreateJobInput): RepairOperation;
  updateJob(jobId: string, updates: Partial<RepairOperation>): void;
  getJob(jobId: string): RepairOperation | null;
  getActiveJobs(): RepairOperation[];
}
```

#### [NEW] `electron/db/RepairRepository.test.ts`
- Unit tests with in-memory SQLite (`:memory:`)
- Test create, update, status transitions, query by jobId

---

### Security Module

#### [NEW] `electron/api/auth.ts`
- `generateAndPersistToken(): string`
- `createAuthMiddleware(token: string): RequestHandler`
- `getTokenPath(): string` — `path.join(os.homedir(), '.photo-repair-shop', 'api-token')`

#### [NEW] `electron/api/auth.test.ts`
- Test token generation (uniqueness, length)
- Test middleware rejects missing/wrong tokens
- Test middleware passes correct token

---

### JPEG Binary Utilities

#### [NEW] `electron/lib/jpeg/markers.ts`
```typescript
export const JPEG_MARKERS = {
  SOI:  0xFFD8,   // Start of Image
  EOI:  0xFFD9,   // End of Image
  SOS:  0xFFDA,   // Start of Scan
  DQT:  0xFFDB,   // Quantization Table
  DHT:  0xFFC4,   // Huffman Table
  SOF0: 0xFFC0,   // Start of Frame (Baseline DCT)
  SOF2: 0xFFC2,   // Start of Frame (Progressive DCT)
  APP0: 0xFFE0,   // JFIF
  APP1: 0xFFE1,   // EXIF
  RST0: 0xFFD0,   // Restart Markers RST0–RST7
} as const;

export const VALID_BITSTREAM_FOLLOWERS = new Set([
  0x00,                           // Byte stuffing
  0xD9,                           // EOI
  0xD0, 0xD1, 0xD2, 0xD3,        // RST0–RST3
  0xD4, 0xD5, 0xD6, 0xD7,        // RST4–RST7
]);
```

#### [NEW] `electron/lib/jpeg/parser.ts`
```typescript
interface JpegParseResult {
  isValid: boolean;
  markers: MarkerInfo[];
  headerEndOffset: number;       // Byte offset of last SOS marker start
  bitstreamOffset: number;       // Byte offset where image data begins (after SOS header)
  hasEoiMarker: boolean;
  invalidMarkers: InvalidMarkerInfo[];
  errors: ParseError[];
  embeddedThumbnailRange?: { start: number; end: number };
}

export function parseJpegMarkers(buffer: Buffer): JpegParseResult;
export function findLastSosOffset(buffer: Buffer): number;
export function extractHeader(buffer: Buffer): Buffer;     // SOI → last SOS (inclusive)
export function extractBitstream(buffer: Buffer): Buffer;  // After last SOS → EOI
export function findEoiOffset(buffer: Buffer): number;
```

#### [NEW] `electron/lib/jpeg/sanitizer.ts`
```typescript
interface SanitizationResult {
  buffer: Buffer;
  patchCount: number;
  patches: Array<{ offset: number; original: number; replacement: number }>;
}

// Scans bitstream after sosOffset. For each FF xx where xx not in VALID_BITSTREAM_FOLLOWERS,
// replaces xx with 0x00. Stops at EOI.
export function sanitizeInvalidMarkers(buffer: Buffer, sosOffset: number): SanitizationResult;
export function findInvalidMarkers(buffer: Buffer, sosOffset: number): InvalidMarkerInfo[];
```

#### [NEW] `electron/lib/jpeg/entropy.ts`
```typescript
// Byte-frequency heuristic (ENTROPY_FACTOR from research)
// Returns false if any single byte value count exceeds threshold in a 512-byte sector
export function isHighEntropySector(sector: Buffer, threshold?: number): boolean;
export function analyzeEntropyMap(buffer: Buffer, sosOffset: number): EntropyMap;

interface EntropyMap {
  sectors: Array<{ offset: number; isHighEntropy: boolean; dominantByte?: number }>;
  firstLowEntropySector?: number;  // Offset of first suspect sector (fragmentation point)
}
```

#### [NEW] `electron/lib/jpeg/parser.test.ts`
- Valid JPEG: all markers found, no errors
- Truncated JPEG: no EOI, detected
- Missing SOI: `isValid: false`
- Invalid markers in bitstream: detected and reported
- Embedded thumbnail: `findLastSosOffset` returns main image SOS, not thumbnail SOS
- Entropy: high-entropy section returns true, zero-padded section returns false

---

### File Analysis Service

#### [NEW] `electron/services/FileAnalyzer.ts`
```typescript
type CorruptionType =
  | 'missing_soi'          // File doesn't start with FF D8
  | 'missing_header'       // SOI present but header is truncated/corrupt
  | 'invalid_markers'      // FF xx sequences in bitstream
  | 'truncated'            // Missing or premature EOI
  | 'mcu_misalignment'     // Heuristic: restart markers out of sequence
  | 'metadata_corrupt'     // ExifTool reports errors
  | 'raw_unreadable';      // ExifTool can't parse, preview extraction may recover

interface AnalysisResult {
  jobId: string;
  filePath: string;
  fileType: 'jpeg' | 'cr2' | 'nef' | 'arw' | 'dng' | 'unknown';
  fileSize: number;
  isCorrupted: boolean;
  corruptionTypes: CorruptionType[];
  suggestedStrategies: Array<{
    strategy: 'header-grafting' | 'preview-extraction' | 'marker-sanitization';
    requiresReference: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  metadata: {
    cameraModel?: string;
    resolution?: string;
    orientation?: number;
  } | null;
  embeddedPreviewAvailable: boolean;
  entropyMap?: EntropyMap;
}
```

#### [NEW] `electron/services/FileAnalyzer.test.ts`
- Mock ExifTool; test each corruption type detected correctly
- Test strategy recommendation logic

---

### ExifTool Integration

#### [NEW] `electron/lib/exiftool/ExifToolService.ts`
```typescript
// Wraps exiftool-vendored (NOT a CLI wrapper)
// Singleton pattern — one ExifTool instance per app lifetime

import { ExifTool } from 'exiftool-vendored';

export class ExifToolService {
  private static instance: ExifTool | null = null;

  static getInstance(): ExifTool {
    if (!this.instance) {
      this.instance = new ExifTool({ taskTimeoutMillis: 10000, maxProcs: 2 });
    }
    return this.instance;
  }

  static async getMetadata(filePath: string): Promise<ExifMetadata>;
  static async extractPreview(filePath: string, outputPath: string): Promise<boolean>;
  static async validateFile(filePath: string): Promise<ValidationResult>;
  static async shutdown(): Promise<void>;  // Called on app quit
}
```

> **Note:** No `ExifToolWrapper.ts` CLI approach. Use `exiftool-vendored` directly — it manages
> the binary, process pooling, and error handling. Call `ExifToolService.shutdown()` on `app.quit`.

#### [NEW] `electron/lib/exiftool/ExifToolService.test.ts`
- Integration tests: metadata read, preview extraction, validation
- Mock ExifTool process for unit tests

---

### Test Asset Generator

#### [NEW] `scripts/generate-test-assets.ts`
```typescript
// Generates synthetic corrupt files for testing without needing real camera images
// Run with: npx ts-node scripts/generate-test-assets.ts

// Creates:
// test-assets/valid/valid-baseline.jpg          — Minimal valid JPEG
// test-assets/corrupt/missing-soi.jpg           — No FF D8 at start
// test-assets/corrupt/truncated.jpg             — Missing FF D9 at end
// test-assets/corrupt/invalid-markers.jpg       — FF 9A in bitstream
// test-assets/corrupt/corrupt-header.jpg        — Zeroed-out header
// test-assets/reference/reference.jpg           — Valid JPEG for grafting tests
// test-assets/expected/grafted.jpg              — Expected output after header graft
```

---

## Phase 2: Core Repair Engine

### Repair Strategy Interface

#### [NEW] `electron/strategies/IRepairStrategy.ts`
```typescript
interface RepairInput {
  filePath: string;
  outputPath: string;
  analysis: AnalysisResult;
  referenceFilePath?: string;
  autoEnhance?: boolean;
  onProgress?: (event: RepairProgressEvent) => void;
}

interface RepairResult {
  success: boolean;
  repairedFilePath?: string;
  strategy: string;
  patchCount?: number;
  warnings: string[];
  error?: string;
}

interface RepairProgressEvent {
  stage: 'reading' | 'grafting' | 'sanitizing' | 'verifying' | 'enhancing' | 'done';
  percent: number;
  message: string;
}

interface IRepairStrategy {
  readonly name: string;
  readonly requiresReference: boolean;
  canRepair(analysis: AnalysisResult): boolean;
  repair(input: RepairInput): Promise<RepairResult>;
}
```

---

### Header Grafting Strategy

#### [NEW] `electron/strategies/HeaderGraftingStrategy.ts`
```typescript
export class HeaderGraftingStrategy implements IRepairStrategy {
  name = 'header-grafting';
  requiresReference = true;

  async repair(input: RepairInput): Promise<RepairResult> {
    // 1. Parse reference file → extract header (SOI to last SOS inclusive)
    // 2. Parse corrupt file → find last SOS, extract bitstream (SOS data → EOI)
    // 3. Concatenate: [reference header] + [corrupt bitstream]
    // 4. Run sanitizeInvalidMarkers() on the combined buffer
    // 5. Write to outputPath
    // 6. Run RepairVerifier (at least Tier 1 + Tier 3)
  }
}
```

#### [NEW] `electron/strategies/HeaderGraftingStrategy.test.ts`
- Test with synthetic valid reference + corrupt (zeroed header) pair
- Verify output starts with FF D8, ends with FF D9
- Verify output passes ExifTool validation (mock)

---

### Preview Extraction Strategy (RAW Files)

#### [NEW] `electron/strategies/PreviewExtractionStrategy.ts`
```typescript
export class PreviewExtractionStrategy implements IRepairStrategy {
  name = 'preview-extraction';
  requiresReference = false;

  async repair(input: RepairInput): Promise<RepairResult> {
    // Uses ExifToolService to extract: JpgFromRaw → PreviewImage → ThumbnailImage
    // Tries each in order until one succeeds
    // Copies extracted JPEG to outputPath
  }
}
```

---

### Invalid Marker Sanitization Strategy

#### [NEW] `electron/strategies/MarkerSanitizationStrategy.ts`
```typescript
export class MarkerSanitizationStrategy implements IRepairStrategy {
  name = 'marker-sanitization';
  requiresReference = false;

  async repair(input: RepairInput): Promise<RepairResult> {
    // 1. Parse JPEG, find bitstream start
    // 2. Run sanitizeInvalidMarkers()
    // 3. Write patched buffer to outputPath
    // 4. Report patchCount
  }
}
```

---

### MCU Alignment — Detection Only (MVP)

MCU alignment correction requires a Huffman pseudo-decoder. This is deferred post-MVP.
For MVP: detect MCU misalignment heuristically and recommend header grafting as the fix.

#### [NEW] `electron/lib/jpeg/mcuDetector.ts`
```typescript
interface McuDetectionResult {
  likelyMisaligned: boolean;
  confidence: 'high' | 'low';
  // Detection heuristics:
  // - Restart markers out-of-sequence (RST0→RST1→RST2 pattern broken)
  // - Restart marker count doesn't match header's expected interval
  // - Entropy drops mid-file before expected image end
  evidence: string[];
}

export function detectMcuMisalignment(buffer: Buffer, parseResult: JpegParseResult): McuDetectionResult;
```

> **Post-MVP:** Full correction via Huffman pseudo-decoding + byte stuffing.
> Reference: JPEG-Repair-Tool (Python/PyQt6 on GitHub) for algorithm reference.

---

### Repair Verifier

#### [NEW] `electron/services/RepairVerifier.ts`
```typescript
export class RepairVerifier {
  // Tier 1: ExifTool -validate structural check
  async validateStructure(filePath: string): Promise<{ passed: boolean; errors: string[] }>;

  // Tier 2: Entropy — detect low-entropy zones before EOI
  analyzeEntropy(buffer: Buffer, sosOffset: number): { passed: boolean; firstLowEntropySector?: number };

  // Tier 3: Full decode via sharp — valid dimensions, no exception
  async attemptDecode(filePath: string): Promise<{ passed: boolean; width?: number; height?: number }>;

  // Tier 4: Thumbnail similarity — for fragmented file scenarios (post-MVP primary use)
  async compareThumbnail(repairedPath: string, thumbnailBuffer: Buffer): Promise<{ passed: boolean; score: number }>;

  // Run all tiers in order, stop at first failure
  async verify(filePath: string, thumbnailBuffer?: Buffer): Promise<VerificationResult>;
}
```

---

### Reference Manager

#### [NEW] `electron/services/ReferenceManager.ts`
```typescript
export class ReferenceManager {
  // Validate a candidate reference file against a target file's metadata
  async validateCompatibility(referencePath: string, targetMetadata: ExifMetadata): Promise<CompatibilityResult>;

  // Rank multiple candidates from SPO, return the best match
  async rankCandidates(candidates: string[], targetMetadata: ExifMetadata): Promise<RankedReference[]>;

  // Manage PRS's own reference library
  async addToLibrary(filePath: string): Promise<void>;
  async findInLibrary(metadata: ExifMetadata): Promise<ReferenceFile[]>;
}

interface CompatibilityResult {
  isCompatible: boolean;
  score: number;   // 0–1
  matchDetails: {
    cameraModel: 'match' | 'mismatch' | 'unknown';
    resolution:  'match' | 'mismatch' | 'unknown';
    orientation: 'match' | 'mismatch' | 'unknown';
  };
  warnings: string[];
}
```

---

### Auto-Color Enhancement

#### [NEW] `electron/lib/enhance/autoColor.ts`
```typescript
// Uses sharp for histogram normalization — fixes washed-out colors post-repair
// Applied when RepairInput.autoEnhance === true

export async function normalizeHistogram(inputPath: string, outputPath: string): Promise<void>;
// Uses sharp().normalize() — stretches histogram to full tonal range
```

---

### Job Queue

#### [NEW] `electron/services/JobQueue.ts`
```typescript
// Manages concurrent repair jobs
// Max concurrency: 2 (configurable)
// Jobs persist to RepairRepository so status survives between polls

export class JobQueue {
  enqueue(jobId: string, task: () => Promise<void>): void;
  getStatus(jobId: string): JobStatus | null;
  isRunning(jobId: string): boolean;
}
```

---

## Phase 3: User Interface

### Repair Wizard

#### [NEW] `src/components/RepairWizard/`
- `RepairWizard.tsx` — Wizard container, step routing
- `FileImportStep.tsx` — Drag-drop import, shows file info
- `AnalysisStep.tsx` — Displays corruption types, suggested strategies, entropy map
- `ReferenceStep.tsx` — Reference file picker with compatibility score display
- `RepairStep.tsx` — Progress bar using polling, stage labels
- `ResultStep.tsx` — Before/after comparison, save location, re-run option

### Hex Viewer

#### [NEW] `src/components/HexViewer/`
- `HexViewer.tsx` — Virtualized hex display (react-virtual or similar)
- Entropy color coding: green = high entropy (valid data), red = low entropy (suspect)
- Marker overlays: highlight SOI, SOS, EOI, invalid markers

### Batch Processor

#### [NEW] `src/components/BatchProcessor/`
- `BatchQueue.tsx` — File list with per-file status
- `BatchSettings.tsx` — Reference file, output folder, strategy override
- `BatchReport.tsx` — Summary table: success / failed / warnings per file

---

## Phase 4: API Server + Integration

### API Server

#### [NEW] `electron/api/server.ts`
```typescript
// Express server started from electron/main.ts after token generation
// Bound to 127.0.0.1:3847 only

export function createServer(token: string, deps: { jobQueue: JobQueue; db: Database }): Express;
// Registers: cors, rateLimit, bodyParser (limit: '1mb'), authMiddleware, all route handlers
```

#### [NEW] `electron/api/routes/health.ts`
- `GET /api/health` — No auth required

#### [NEW] `electron/api/routes/analyze.ts`
- `POST /api/analyze` — Zod validation → enqueue analysis job → return jobId

#### [NEW] `electron/api/routes/repair.ts`
- `POST /api/repair` — Zod validation → validate strategy + reference → enqueue repair job
- `POST /api/batch` — Zod validation → validate all paths exist → enqueue batch job

#### [NEW] `electron/api/routes/status.ts`
- `GET /api/status/:jobId` — Read from RepairRepository → return full status object

#### [NEW] `electron/api/routes/references.ts`
- `GET /api/references` — Query ReferenceManager's internal library

### IPC Handlers (for PRS's own UI)

#### [NEW] `electron/ipc/repairHandlers.ts`
- `repair:analyze` — Trigger analysis, return jobId
- `repair:execute` — Trigger repair, return jobId
- `repair:batch` — Trigger batch, return jobId
- `repair:status` — Get job status by jobId
- `repair:addReference` — Add file to reference library

---

## Verification Plan

### Test Framework: Vitest

```powershell
npm test                                               # All tests
npm run test:watch                                     # Watch mode
npx vitest run electron/lib/jpeg/parser.test.ts        # Single file
```

### Phase 1 Test Coverage

| Component | Test File | Verifies |
|-----------|-----------|---------|
| JPEG Parser | `parser.test.ts` | Marker detection, SOS/EOI finding, thumbnail skip |
| Sanitizer | `sanitizer.test.ts` | Patch count, invalid marker replacement |
| Entropy Analyzer | `entropy.test.ts` | High vs low entropy sectors |
| Auth Middleware | `auth.test.ts` | Token validation, 401 on failure |
| RepairRepository | `RepairRepository.test.ts` | CRUD on in-memory SQLite |
| ExifToolService | `ExifToolService.test.ts` | Metadata parse, preview extraction |

### Phase 2 Test Coverage

| Component | Test File | Verifies |
|-----------|-----------|---------|
| HeaderGraftingStrategy | `HeaderGraftingStrategy.test.ts` | Valid output from synthetic files |
| MarkerSanitizationStrategy | `MarkerSanitizationStrategy.test.ts` | Patch applied, file opens |
| RepairVerifier | `RepairVerifier.test.ts` | Each tier mocked, correct pass/fail |
| ReferenceManager | `ReferenceManager.test.ts` | Compatibility scoring logic |

### 4-Tier Repair Verification

| Tier | Method | Pass | Fail |
|------|--------|------|------|
| 1 | ExifTool `-validate` | No errors | Any error |
| 2 | Entropy analysis | High entropy until EOI | Low entropy mid-file |
| 3 | `sharp` decode | Valid width/height, no throw | Exception or dims === 0 |
| 4 | Thumbnail comparison | Pixel similarity > 0.9 | Mismatch > 1/16 pixels |

### Test Assets Location
```
test-assets/
  valid/        — Known-good synthetic JPEGs and placeholder RAW stubs
  corrupt/      — Programmatically corrupted variants
  reference/    — Valid reference files for grafting tests
  expected/     — Expected binary outputs for regression tests
```

---

## Change Log Location
All changes logged to: `aiChangeLog/phase-0X.md`

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| `exiftool-vendored` over CLI wrapper | Matches SPO, handles binary lifecycle automatically |
| `sharp` over Jimp | Matches SPO v0.34.x, faster, better format support |
| `express` over Fastify | Simpler, sufficient for localhost-only API |
| MCU correction deferred | Requires Huffman pseudo-decoder; detection + header graft covers 80% of cases |
| SPO polls PRS (`GET /api/status/:jobId`) | No callback server needed on SPO side; simpler |
| Token in `~/.photo-repair-shop/api-token` | Predictable path both apps can agree on |
| `127.0.0.1` binding only | Prevents LAN exposure; no real cost |
| Zod for all API inputs | Matches SPO standard; fail closed on invalid input |
