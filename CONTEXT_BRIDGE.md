# Context Bridge: Photo Repair Shop

## Current State
We are building a local-first, modular electron application designed to forensically repair corrupted JPEG imagery using structural heuristics and test-time verification. We have successfully completed Phase 1 (Core Foundation setup with TypeScript, Vite, and absolute strict linting) and Phase 2 (Building the complex Python backend engine including the Header Grafting and Marker Sanitization strategies). We just finished Phase 3, successfully implementing a gorgeous dark-mode Tailwind V4 React frontend that simulates the "Repair Wizard" flow with an interactive Hex Viewer and animated console execution streams.

## Technical Details
- **Architecture**: Enforced strict separation of concerns (Enterprise Mode). The React frontend is completely disjointed from the core Python repair engine, mandated to communicate exclusively through the Electron IPC `contextBridge`.
- **Frameworks**: 
  - Frontend: React 18, Vite, TailwindCSS V4 (using native CSS variables `@theme`), Framer Motion (for UI transitions), Lucide-React (icons).
  - Backend: Electron (TypeScript API routing), Python 3.12 (core processing, ExifTool, OpenCV, deep structural byte arrays).
- **Tooling Constraints**: Windows PowerShell is the enforced execution environment. Direct API imports (like OpenAI/Langchain) are forbidden; all externalities must route through internal Provider abstractions (e.g., `PythonAIProvider.ts`).
- **Testing**: TDD is heavily enforced. Vitest is configured to mock external systems (like the SQLite DB and Python subprocesses) for rapid CI/CD assurance.
- **Git Strategy**: We are tracking project progression aggressively using the `aiChangeLog` system, generating granular commit messages matching conventional-commits standards.

## Next Steps
1. **Phase 4.1 - IPC Bridge Routing**: Connect the mock UI buttons in `App.tsx` (like "Analyze File" and "Execute Repair") directly to the pre-built Electron handlers located in `electron/services/`.
2. **Phase 4.2 - Job Queue Processing**: Finalize the event streaming logic so that the Python Engine's `stdout` can be piped directly into the React UI's `<ExecutionStep />` animated console block.
3. **Phase 4.3 - E2E Testing**: Spin up the full application natively (bypassing the dev server) and perform an End-to-End test of a genuinely corrupt file flowing from the UI, through the bridge, into the Python engine, and back out onto disk.
4. **Phase 5 - Artifact Production**: Compile the Electron application into a distributable executable for the user.

## Opening Instruction
*Copy and paste the following line into your next chat to instantly prime the AI:*

> Please review the `CONTEXT_BRIDGE.md` file in the root directory and the latest entry in `aiChangeLog/` to understand the current state of the Photo Repair Shop; our immediate goal is to begin Phase 4 by wiring the React UI's IPC events directly into the Electron backend services.
