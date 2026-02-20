import { contextBridge, ipcRenderer } from 'electron';
import type { AnalysisResult } from './services/FileAnalyzer.js';
import type { JobStatus } from './services/JobQueue.js';

export interface ElectronAPI {
    showOpenDialog: () => Promise<string | null>;
    analyzeFile: (filePath: string) => Promise<AnalysisResult>;
    executeRepair: (config: any) => Promise<string>;
    onRepairProgress: (callback: (progress: JobStatus) => void) => () => void;
    saveOutput: (defaultPath?: string) => Promise<string | null>;
}

const electronAPI: ElectronAPI = {
    showOpenDialog: () => ipcRenderer.invoke('dialog:openFile'),
    analyzeFile: (filePath: string) => ipcRenderer.invoke('file:analyze', filePath),
    executeRepair: (config: any) => ipcRenderer.invoke('repair:execute', config),
    onRepairProgress: (callback: (progress: JobStatus) => void) => {
        const subscription = (_event: any, value: JobStatus) => callback(value);
        ipcRenderer.on('repair:progress', subscription);
        return () => ipcRenderer.off('repair:progress', subscription);
    },
    saveOutput: (defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath)
};

console.log("HELLO FROM PRELOAD SCRIPT! INJECTING ELECTRON API...");
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
