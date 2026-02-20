# Photo Repair Shop — Project Specification

## Overview
A power-user focused desktop application for diagnosing, repairing, and recovering corrupted digital photos. Built with Electron for cross-platform support (Windows primary).

## Target Audience
- **Primary:** Power users, photographers, forensic hobbyists
- **Secondary:** Everyday users recovering corrupted vacation/family photos
- **Design Philosophy:** Expose technical details (hex views, entropy stats) while providing guided workflows

---

## MVP Feature Set (Option B)

### Core Repair Capabilities

| Feature | Description | Priority |
|---------|-------------|----------|
| **Header Grafting** | Replace corrupted JPEG/RAW headers using a "reference file" from same camera/settings | P0 |
| **Embedded Preview Extraction** | Extract intact JPEG previews from corrupted RAW files (NEF, CR2, ARW) | P0 |
| **MCU Alignment** | Detect and correct Minimum Coded Unit shifts in JPEG bitstreams | P0 |
| **Batch Processing** | Process multiple files using a single reference file | P1 |
| **Invalid Marker Sanitization** | Auto-detect and fix invalid `FF xx` sequences in JPEG bitstreams | P1 |

### Supported File Types (MVP)
- **JPEG:** `.jpg`, `.jpeg`
- **RAW Formats:** Canon (CR2/CR3), Nikon (NEF), Sony (ARW), Adobe DNG

### Deferred to Post-MVP
- File carving from disk images (PhotoRec-style recovery)
- Fragmented file reassembly with fitness functions
- Entropy-based sector analysis

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Photo Repair Shop                           │
├─────────────────┬───────────────────────────────────────────────┤
│  Electron Main  │  Window management, IPC, API server           │
├─────────────────┼───────────────────────────────────────────────┤
│  React Frontend │  Repair wizard, hex viewer, batch manager     │
├─────────────────┼───────────────────────────────────────────────┤
│  Repair Engine  │  TypeScript orchestration layer               │
│  (Node.js)      │  Coordinates native tools and strategies      │
├─────────────────┼───────────────────────────────────────────────┤
│  Native Layer   │  ExifTool CLI | LibRaw (via rawpy) | Custom   │
│                 │  binary parsing (Node.js Buffer API)          │
└─────────────────┴───────────────────────────────────────────────┘
```

### Key Interfaces

```typescript
// IFileAnalyzer - Diagnoses corruption type(s)
interface IFileAnalyzer {
  analyze(filePath: string): Promise<AnalysisResult>;
}

interface AnalysisResult {
  fileType: 'jpeg' | 'raw' | 'unknown';
  isCorrupted: boolean;
  corruptionTypes: CorruptionType[];
  repairStrategies: RepairStrategy[];
  embeddedPreviewAvailable: boolean;
}

// IRepairStrategy - Implements specific repair technique
interface IRepairStrategy {
  readonly name: string;
  readonly requiresReference: boolean;
  canRepair(analysis: AnalysisResult): boolean;
  repair(input: RepairInput): Promise<RepairResult>;
}

// IReferenceManager - Manages donor files for header grafting
interface IReferenceManager {
  findMatchingReferences(targetFile: AnalysisResult): Promise<ReferenceFile[]>;
  validateReference(reference: string, target: string): Promise<CompatibilityResult>;
}
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Desktop Framework** | Electron | Cross-platform, consistent with smart-photo-organizer |
| **Frontend** | React + TypeScript | Familiar stack, component reuse potential |
| **Styling** | Vanilla CSS | Per project standards |
| **Binary Parsing** | Node.js Buffer API | Native performance, no Python dependency for core |
| **RAW Processing** | ExifTool (CLI) | Best metadata/preview extraction; bundled with app |
| **RAW Decoding** | rawpy (Python) or LibRaw Node bindings | For advanced RAW repair scenarios |

> [!IMPORTANT]
> **Frontend Responsiveness:** All heavy processing (binary parsing, repair operations, batch jobs) runs in the Electron main process or worker threads. The renderer process handles UI only. IPC messages stream progress updates to keep the UI responsive.

---

## Integration with Smart-Photo-Organizer

### Strategy: API-First Standalone
Photo Repair Shop runs independently but exposes a local API for integration.

```
┌─────────────────────┐         ┌─────────────────────┐
│ Smart Photo         │  HTTP   │ Photo Repair Shop   │
│ Organizer           │◄───────►│ (Local API :3847)   │
│                     │   or    │                     │
│ "Repair this file"  │   IPC   │ Executes repair     │
└─────────────────────┘         └─────────────────────┘
```

### Integration Points
1. **Detection:** SPO detects corrupt files during scan (EXIF read failure, thumbnail missing)
2. **Handoff:** "Open in Photo Repair Shop" action launches PRS with file path
3. **API Mode:** SPO can call PRS API for automated batch repairs
4. **Results:** Repaired files saved to SPO-monitored folder, auto-imported

---

## UX Design Principles

1. **Non-Destructive:** Never modify original files; always output to new location
2. **Transparent:** Show hex views, entropy stats, corruption zones
3. **Guided:** Wizard flow for common scenarios, advanced mode for power users
4. **Batch-Friendly:** Queue-based processing with progress tracking

### Primary Workflows

#### Workflow 1: Single File Repair
1. Import corrupted file → Auto-analysis
2. Display diagnosis with recommended strategies
3. If header grafting needed → Prompt for reference file with matching guidance
4. Preview repair result (before/after comparison)
5. Save repaired file to chosen location

#### Workflow 2: Batch Repair (Ransomware Recovery)
1. Select folder of corrupted files
2. Provide single reference file
3. Auto-analyze all files, group by repair strategy
4. Process batch with progress UI
5. Generate repair report (success/failure/partial)

---

## Development Phases

### Phase 1: Foundation
- [ ] Project scaffold (Electron + React + TypeScript)
- [ ] JPEG marker parsing utilities
- [ ] Basic file analysis (detect corruption types)
- [ ] ExifTool integration for metadata/preview extraction

### Phase 2: Core Repair Engine
- [ ] Header grafting strategy implementation
- [ ] Reference file matching/validation
- [ ] Embedded preview extraction for RAW files
- [ ] MCU alignment detection and correction

### Phase 3: User Interface
- [ ] Repair wizard workflow
- [ ] Hex viewer component with corruption highlighting
- [ ] Before/after comparison view
- [ ] Batch processing queue

### Phase 4: Polish & Integration
- [ ] Local API server for external integration
- [ ] Settings/preferences
- [ ] Repair history/logging
- [ ] Documentation and user guide

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCU alignment complexity | High | Start with reference-based approach; defer auto-detection |
| RAW format diversity | Medium | Prioritize CR2/NEF/ARW; rely on ExifTool for parsing |
| Large file performance | Medium | Stream processing; avoid loading entire files into memory |
| ExifTool dependency | Low | CLI wrapper; bundle ExifTool with app |

---

## Success Criteria (MVP)
- [ ] Successfully repair header-corrupted JPEG using reference file
- [ ] Extract embedded preview from corrupted CR2/NEF/ARW
- [ ] Correct MCU-shifted JPEG with visible before/after improvement
- [ ] Process 100+ file batch in under 5 minutes
- [ ] Zero data loss (original files never modified)
