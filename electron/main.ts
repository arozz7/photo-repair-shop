import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { FileAnalyzer } from './services/FileAnalyzer.js';
import { initializeDatabase } from './db/database.js';
import { RepairRepository } from './db/RepairRepository.js';
import { JobQueue } from './services/JobQueue.js';
import { PythonEngineService } from './services/PythonEngineService.js';
import { ReferenceManager } from './services/ReferenceManager.js';
import { generateAndPersistToken } from './api/auth.js';
import { createServer } from './api/server.js';
import { SettingsService } from './services/SettingsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
    Menu.setApplicationMenu(null);

    const iconPath = process.env.VITE_DEV_SERVER_URL
        ? path.join(__dirname, '../public/icon.png')
        : path.join(__dirname, '../dist/icon.png');

    const win = new BrowserWindow({
        title: 'Photo Repair Shop',
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Required for some Vite DEV environments to map the context bridge
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    return win;
}

let mainWindow: BrowserWindow | null = null;
const dbDir = path.join(app.getPath('userData'), 'photo-repair-shop-db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'repairs.sqlite');

const db = initializeDatabase(dbPath);
const repository = new RepairRepository(db);
const engineService = new PythonEngineService(path.join(__dirname, '..'));
const refManager = new ReferenceManager(db);

const jobQueue = new JobQueue(repository, async (jobId: string) => {
    const job = repository.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('repair:progress', repository.getJob(jobId));
    }

    try {
        await engineService.executeRepair(
            {
                jobId: job.job_id,
                filePath: job.original_path,
                strategy: job.strategy || 'unknown',
                referencePath: job.reference_path || undefined
            },
            (progress) => {
                const updatePayload: any = {
                    percent: progress.percent,
                    stage: progress.stage,
                    status: progress.status as any,
                    error_message: progress.error_message
                };
                if (progress.status === 'done' && progress.repaired_path) {
                    updatePayload.repaired_path = progress.repaired_path;
                }
                repository.updateJob(jobId, updatePayload);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('repair:progress', repository.getJob(jobId));
                }
            }
        );
    } catch (err: any) {
        console.error(`[JobQueue Handler] Error in executeRepair for job ${jobId}:`, err);
        repository.updateJob(jobId, {
            status: 'failed',
            error_message: err.message || 'Unknown execution error',
            completed_at: new Date().toISOString()
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('repair:progress', repository.getJob(jobId));
        }
        throw err;
    }

    // Finalize the job status just in case the engine script misses the 100% emission
    const finalState = repository.getJob(jobId);
    if (finalState && finalState.status !== 'done' && finalState.status !== 'failed') {
        repository.updateJob(jobId, {
            percent: 100,
            stage: 'Complete.',
            status: 'done',
            completed_at: new Date().toISOString()
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('repair:progress', repository.getJob(jobId));
        }
    }
});

app.whenReady().then(() => {
    // 1. Core API Backend Initialization
    const token = generateAndPersistToken();
    const apiApp = createServer(token, { jobQueue, repository, refManager });

    apiApp.listen(3847, '127.0.0.1', () => {
        console.log(`[API] Server started on http://127.0.0.1:3847`);
        console.log(`[API] Auth token persisted. Ready for SPO connection.`);
    });

    // 2. Window UI Initialization
    mainWindow = createWindow();

    ipcMain.handle('dialog:openFile', async () => {
        if (!mainWindow) return null;
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile']
        });
        if (canceled || filePaths.length === 0) return null;
        return filePaths[0];
    });

    ipcMain.handle('file:analyze', async (_event, filePath: string) => {
        try {
            console.log(`[IPC] Received file:analyze request for: ${filePath}`);
            const result = await FileAnalyzer.analyze('analysis-only', filePath);
            console.log(`[IPC] Analysis successfully returned from FileAnalyzer.`);
            return result;
        } catch (error) {
            console.error('Analysis failed:', error);
            throw error;
        }
    });

    ipcMain.handle('dialog:saveFile', async (_event, jobId: string, defaultPath?: string) => {
        if (!mainWindow) return null;

        const job = repository.getJob(jobId);
        if (!job || !job.repaired_path) {
            console.error(`[IPC] Cannot save output: Job ${jobId} not found or has no repaired_path.`);
            return null;
        }

        let calculatedDefaultPath = defaultPath || 'repaired-photo.jpg';
        if (!defaultPath && job.original_path && job.original_path !== 'unknown') {
            const parsed = path.parse(job.original_path);
            calculatedDefaultPath = path.join(parsed.dir, `${parsed.name}-repaired${parsed.ext}`);
        }

        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: calculatedDefaultPath,
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'jfif', 'png'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) return null;

        try {
            // Copy the hidden reconstructed file to the user's permanent destination
            fs.copyFileSync(job.repaired_path, filePath);
            console.log(`[IPC] Successfully copied repaired output to ${filePath}`);
        } catch (e) {
            console.error(`[IPC] Error copying repaired file:`, e);
            throw e;
        }

        return filePath;
    });

    ipcMain.handle('repair:execute', async (_event, config: any) => {
        const jobId = `job-${Date.now()}`;
        repository.createJob({
            job_id: jobId,
            original_path: config.filePath || 'unknown',
            reference_path: config.referencePath,
            strategy: config.strategy
        });
        jobQueue.enqueue(jobId);
        return jobId;
    });

    ipcMain.handle('reference:autoSearch', async (_event, targetFilePath: string) => {
        try {
            const refDir = path.join(dbDir, 'references');
            if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });

            console.log(`[IPC] Scanning reference folder: ${refDir}`);
            await refManager.scanReferenceFolder(refDir);

            const { ExifToolService } = await import('./lib/exiftool/ExifToolService.js');
            const targetMeta = await ExifToolService.getMetadata(targetFilePath);

            const matches = refManager.findInLibrary(targetMeta);
            if (matches.length > 0) {
                console.log(`[IPC] Found auto-match reference: ${matches[0].filePath}`);
                return matches[0].filePath;
            }
            return null;
        } catch (e) {
            console.error(`[IPC] Reference auto-search failed:`, e);
            return null;
        }
    });

    ipcMain.handle('file:readBase64', async (_event, filePath: string) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) return null;
            const data = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            return `data:${mimeType};base64,${data.toString('base64')}`;
        } catch (e) {
            console.error(`[IPC] Failed to read base64 file for preview: ${filePath}`, e);
            return null;
        }
    });

    ipcMain.handle('job:get', async (_event, jobId: string) => {
        return repository.getJob(jobId);
    });

    ipcMain.handle('history:getAll', async () => {
        return repository.getAllJobs();
    });

    const settingsService = new SettingsService(app.getPath('userData'));

    ipcMain.handle('settings:get', async () => {
        return settingsService.getSettings();
    });

    ipcMain.handle('settings:update', async (_event, partial: any) => {
        return settingsService.updateSettings(partial);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createWindow();
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
});
