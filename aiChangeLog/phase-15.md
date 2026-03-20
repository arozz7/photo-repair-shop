# phase-15

## Diff Narrative

**Files Created:**
- \`scripts/deploy/extract-profiles.ts\`: New utility script to extract \`.jpg\` and \`.hdr\` generic profiles from whole images placed in \`assets/donors\`.

**Files Modified:**
- \`src/App.tsx\`: Passed \`handleRestart\` down to \`RepairWizard\`.
- \`src/components/RepairWizard/RepairWizard.tsx\`: Added a "Start Over" button in the wizard header (for steps 1 to 3) that triggers the reset flow.
- \`electron/preload.ts\` & \`electron/main.ts\`: Added \`getGenericProfiles\` IPC endpoint to dynamically list available generic profiles from the bundled \`assets/profiles\` folder.
- \`src/components/RepairWizard/steps/StrategyStep.tsx\`: Formatted the Donor Configuration UI. Exposed the built-in Generic Profiles natively via a dropdown fallback. Updated the "Force strict Exif compatibility check" description to explain "Relaxed Mode" behavior with arbitrary donors or generic profiles.

**Behavior Changes:**
- Flow Reset: Users can now reset the wizard from anywhere in the flow without needing to refresh or finish the wizard.
- Missing Donors: Users don't need a perfectly matching donor; they can use generic profiles or drop arbitrary donors and uncheck the Exif compatibility requirement to force a header graft, understanding the cost of a potential color shift tradeoff.

**Tests Added:**
- N/A. Evaluated existing testing boundaries and behavior integration testing will be conducted via standard regression testing manually in the upcoming cycle since this primarily bridges visual presentation logic and straightforward IPC directory reading.

**Assumptions & Risks:**
- **Assumption:** The generic profiles folder is correctly bundled via vite/electron-builder in packaged builds by referencing \`process.resourcesPath\`.
- **Risk:** Generic headers might misalign with extreme source sizes creating out-of-bounds reads in decoding layers if the header's declared dimensions drastically differ from the bitstream, though the parser usually mitigates basic crashes here.
