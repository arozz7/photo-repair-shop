/// <reference types="vite/client" />

interface ElectronAPI {
    showOpenDialog: () => Promise<string | null>;
    analyzeFile: (filePath: string) => Promise<any>;
    executeRepair: (config: any) => Promise<string>;
    onRepairProgress: (callback: (progress: any) => void) => () => void;
    saveOutput: (defaultPath?: string) => Promise<string | null>;
}

interface Window {
    electronAPI: ElectronAPI;
}
