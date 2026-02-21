# Phase 13: Settings & Repair History

## Diff Narrative

**Files Created:**
- `src/components/Sidebar.tsx`: Created a fixed left-hand navigation component using `lucide-react` icons and `framer-motion` for the active indicator.
- `src/components/Settings/Settings.tsx`: Created a preferences view corresponding to backend engine and workflow choices.
- `src/components/History/History.tsx`: Created a data table view rendering jobs directly from the SQLite operations log.
- `electron/services/SettingsService.ts` and `SettingsService.test.ts`: Created a native file I/O service interacting with `app.getPath('userData')/settings.json`.
- `aiChangeLog/phase-13.md`: This changelog.

**Files Modified:**
- `src/App.tsx`: Completely refactored the root layout to leverage a full-screen flex container rendering the `Sidebar` and dynamically routing the main content area between `RepairWizard`, `History`, and `Settings`.
- `electron/db/RepairRepository.ts`: Added `getAllJobs()` to query the log descending by creation date.
- `electron/main.ts`: Injected `history:getAll`, `settings:get`, and `settings:update` IPC channels.
- `electron/preload.ts`: Exposed the new IPC bindings securely to the React renderer API.

## Behavior Changes
1. App now has multi-view routing via a persistent left Sidebar instead of being perfectly modal.
2. A new Job History data table allows viewing the status and target file for all historic repair operations.
3. Users can persist workflow options (e.g. `Default Output Destination`) and engine behavior (e.g. `Max Concurrent Extraction Threads`) across sessions.

## Tests
- Added test suite for `SettingsService.ts` demonstrating partial updates and default value instantiation. Passed perfectly.

## Risks & Assumptions
- We assume `getHistory()` won't crash the IPC bridge passing a massive array if thousands of repairs happen; in the future, SQLite pagination or a `LIMIT 100` might be necessary.
