# Phase 8: API Server & SPO Integration

## Narrative
This phase established the foundations of the standalone Photo Repair Shop Background Server. Because PRS is designed to act both as an isolated desktop wizard and as a local API backend for Smart Photo Organizer (SPO), we needed a reliable way for SPO to seamlessly feed it background diagnostic and repair tasks.

Using Express.js, we bound a fast local server running securely over `127.0.0.1:3847`. Security is guaranteed via a cryptographically random UUID Auth Bearer token rotating on every PRS app launch. 

We bridged the existing frontend `JobQueue` and `RepairRepository` structures to expose four primary endpoints matching the SPO design spec:
1. `POST /api/analyze`: Non-blocking endpoint that kicks off background ExifTool discovery and corruption diagnostics.
2. `POST /api/repair`: Non-blocking endpoint tying execution pipelines (like Header Grafting) directly to dynamic background `python` process spawns.
3. `GET /api/status/:jobId`: Polling anchor returning execution progression and structurally mapping `warnings_json` dumps into SPO-certified `result` objects.
4. `GET /api/references`: Bridge allowing SPO to ping the local SQLite database for confirmed donor references based on its own camera models and resolutions.

## Completed Tasks
- [x] **API Security:** Implemented UUID generation, persisted to `~/.photo-repair-shop/api-token` utilizing secure 0o600 permissions. Built Express authentication middleware.
- [x] **API Foundation:** Created Express Application factory mapping `cors` restricted to `app://` schema alongside 100/req-per-min sliding rate limiters.
- [x] **IPC/Node Linkage:** Modified `main.ts` startup logic to boot the server bound strictly to localhost, preventing LAN-based attacks.
- [x] **Routing Infrastructure:** Implemented and integrated `Zod` validation schemas into endpoints spanning analysis generation, active repair tracking, and repository queries.
- [x] **Test Bedding:** Wrote robust `.test.ts` fixtures checking auth lifecycles and middleware rejections. Set up live server scripts verifying local payload parsing and success mappings over Powershell.

## Diff Narrative
*   **Added** `electron/api/auth.ts` && `electron/api/auth.test.ts` to manage token persistence and validation.
*   **Added** `electron/api/server.ts` Express mapping and integration boundaries.
*   **Added** `electron/api/routes/*` defining precise schema interfaces.
*   **Modified** `electron/main.ts` establishing the boot lifecycle alongside IPC boundaries.
*   **Modified** `package.json` to introduce `express`, `cors`, `express-rate-limit`, `uuid`, and `zod`.

## Associated Risks & Assumptions
*   **Risk:** Token collisions or persistence failures if user lacks home directory permissions on non-standard Windows installations.
    * *Assumption:* `fs.mkdirSync` with `recursive: true` and homedir mappings provide a standard fallback approach that works in vast majorities of deployments.
*   **Risk:** `POST /api/analyze` might block or hang waiting on ExifTool.
    * *Assumption:* We wrapped the analyzer within a `setTimeout(, 0)` microtask block that immediately yields a 202 `queued` state back to the connection socket before executing the heavy blocking code.
