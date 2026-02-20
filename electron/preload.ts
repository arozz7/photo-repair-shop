import { contextBridge, ipcRenderer } from 'electron';
import type { AnalysisResult } from './services/FileAnalyzer.js';
import type { JobStatus } from './services/JobQueue.js';

export interface ElectronAPI {
    showOpenDialog: () => Promise<string | null>;
    analyzeFile: (filePath: string) => Promise<AnalysisResult>;
    executeRepair: (config: any) => Promise<string>;
    onRepairProgress: (callback: (progress: JobStatus) => void) => () => void;
    saveOutput: (jobId: string, defaultPath?: string) => Promise<string | null>;
    referenceAutoSearch: (targetFilePath: string) => Promise<string | null>;
    readBase64: (filePath: string) => Promise<string | null>;
    getJob: (jobId: string) => Promise<any>;
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
    saveOutput: (jobId: string, defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', jobId, defaultPath),
    referenceAutoSearch: (targetFilePath: string) => ipcRenderer.invoke('reference:autoSearch', targetFilePath),
    readBase64: (filePath: string) => ipcRenderer.invoke('file:readBase64', filePath),
    getJob: (jobId: string) => ipcRenderer.invoke('job:get', jobId)
};

console.log("HELLO FROM PRELOAD SCRIPT! INJECTING ELECTRON API...");
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
