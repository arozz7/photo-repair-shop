# Context Bridge: SPO ↔ PRS Integration (Complete)

## Current State
The SPO ↔ PRS integration has been fully implemented across all four phases (API client, IPC
handlers, ReferenceRepository, UI/Config) in `J:/Projects/smart-photo-organizer`. All 36 new
tests pass (29 backend, 7 frontend). The implementation is code-complete and ready for manual
QA — no further code changes are required unless bugs are found during testing.

## Technical Details
- **Node / test runner:** `/c/Users/arozz/AppData/Local/nvm/v22.15.0/node.exe ./node_modules/vitest/vitest.mjs run`
- **New files (SPO):**
  - `electron/lib/prs/PrsTokenReader.ts` — reads `~/.photo-repair-shop/api-token`
  - `electron/lib/prs/PrsClient.ts` — REST client (native fetch, Electron 28+), `PrsApiError`
  - `electron/lib/prs/PrsLauncher.ts` — `ensurePrsRunning()` via `shell.openPath` + health poll
  - `electron/ipc/prsHandlers.ts` — 5 channels: `prs:checkAvailability`, `prs:analyzeFile`, `prs:pollStatus`, `prs:submitRepair`, `prs:completeRepair`
  - `electron/data/repositories/ReferenceRepository.ts` — healthy-photo lookup by camera model + resolution
  - `src/types/prs.ts` — `RepairStatus`, `RepairState`, `PrsJobResult` types
  - `src/hooks/useRepairJob.ts` — 2s polling hook, calls `onDone`/`onError` on terminal states
- **Modified files (SPO):**
  - `electron/main.ts` — added `registerPrsHandlers()` call in `app.whenReady()`
  - `electron/db.ts` — added `is_unrepairable BOOLEAN DEFAULT 0` migration to `scan_errors`
  - `electron/data/repositories/PhotoRepository.ts` — added `deletePhotoById`, `markUnrepairable`
  - `electron/core/services/ConfigService.ts` — added `prsExecutablePath?: string` to `AppConfig`
  - `electron/ipc/settingsHandlers.ts` — added `settings:get` and `settings:update` channels (were missing)
  - `electron/ipc/fileHandlers.ts` — added `dialog:openFile` channel (was missing)
  - `src/components/ScanWarningsModal.tsx` — full repair UI: per-row `RepairState` map, repair flow, progress bar, unrepairable badge
  - `src/views/Settings.tsx` — added "Integrations" section with PRS path + Browse button
- **Pre-existing test failures:** 13 failing test files in full SPO suite (FaceRepository, Scanner, SmartIgnorePanel) — **unrelated to PRS work**, were failing before this implementation
- **Vitest 4 gotcha:** Constructor mocking under `vi.useFakeTimers()` requires `vi.hoisted()` + a real `class` mock (arrow function mocks are not newable)
- **Path separator:** Windows `path.join` uses `\`; test assertions must use `path.join()` not hardcoded `/` paths

## Next Steps (prioritized)
1. **Manual QA — happy path:** Start PRS → open SPO → Settings → Scan Warnings → verify "🔧 Repair" button appears with a "PRS ready" indicator
2. **Manual QA — PRS unavailable:** Stop PRS → verify button is disabled with tooltip "Photo Repair Shop is not running"
3. **Manual QA — repair flow:** Click Repair on a corrupt file → confirm progress bar updates every 2s → row removed on success
4. **Manual QA — verification failure:** Force a bad output file → confirm row stays with "Unrepairable" badge and `scan_errors.is_unrepairable = 1` in DB
5. **Manual QA — Settings:** Configure PRS path via Settings → Integrations → Browse → confirm path persists after restart
6. **Write `aiChangeLog/phase-15.md`** (or whichever phase this maps to) documenting all changes
7. **Investigate pre-existing failures** (FaceRepository, Scanner) if desired — they are unrelated to this work

## Opening Instruction
> "We completed the SPO ↔ PRS integration (all 36 new tests pass). The working directory should be `J:/Projects/smart-photo-organizer`. Read `CONTEXT_BRIDGE.md` in the photo-repair-shop project for full details, then help me run manual QA or write the aiChangeLog for this phase."
