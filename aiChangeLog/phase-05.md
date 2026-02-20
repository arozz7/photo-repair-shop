# Phase 5: Python Core Engine Integration

## Completed Tasks
- Epic 1: Python Engine Scaffolding
  - Created `engine/requirements.txt` (Pillow).
  - Created `scripts/setup_env.ps1` to initialize a local virtual environment in `engine/.venv`.
  - Created `engine/main.py` CLI interface to handle inputs and print JSON stdout progress.
  - Setup basic strategy interface in `engine/strategies/base.py`.
- [x] Epic 2: Node.js Backend Integration
  - Created `electron/services/PythonEngineService.ts` to spawn `.venv` python processes and parse JSON stdout events.
  - Added unit test coverage for the JSON parsing logic.
  - Modifed `electron/main.ts` to initialize `PythonEngineService` and wire it up to `JobQueue` execution loop, replacing the mock delays.

## Diff Narrative
- **`scripts/setup_env.ps1`**: [NEW] Script to setup isolated Python `.venv` and install dependencies.
- **`engine/requirements.txt`**: [NEW] Basic Python requirements.
- **`engine/main.py`**: [NEW] Entry point for Python side of the App. Captures sys args and mimics job completion via `time.sleep`, piping JSON back on stdout.
- **`engine/strategies/__init__.py` & `base.py`**: [NEW] Interface for strategies.
- **`electron/services/PythonEngineService.ts`**: [NEW] Wraps Python engine `child_process.spawn()`.
- **`electron/services/PythonEngineService.test.ts`**: [NEW] Validate JSON stdout event parsing.
- **`electron/main.ts`**: [MODIFY] Wired up `JobQueue` handler to `PythonEngineService.executeRepair`.

## Assumptions & Risks
- Assuming user's system has a globally available `python` executable to create the initial `.venv`.
- Currently using `Pillow` as the baseline image library, other specific libraries like `rawpy` or `opencv` can be added as strategies are implemented.
