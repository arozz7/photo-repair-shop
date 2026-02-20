import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { FileAnalyzer } from './services/FileAnalyzer.js';
import { initializeDatabase } from './db/database.js';
import { RepairRepository } from './db/RepairRepository.js';
import { JobQueue } from './services/JobQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
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

const jobQueue = new JobQueue(repository, async (jobId: string) => {
    // Mock handler for now; we'll plug the real Engine in later.
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('repair:progress', repository.getJob(jobId));
    }

    await new Promise(r => setTimeout(r, 1000));
    repository.updateJob(jobId, { percent: 25, stage: 'Parsing headers...' });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('repair:progress', repository.getJob(jobId));

    await new Promise(r => setTimeout(r, 1000));
    repository.updateJob(jobId, { percent: 75, stage: 'Applying strategy...' });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('repair:progress', repository.getJob(jobId));

    await new Promise(r => setTimeout(r, 1000));
    repository.updateJob(jobId, { percent: 100, stage: 'Complete.', status: 'done', completed_at: new Date().toISOString() });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('repair:progress', repository.getJob(jobId));

});

app.whenReady().then(() => {
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

    ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
        if (!mainWindow) return null;
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultPath || 'repaired-photo.jpg',
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'jfif', 'png'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) return null;

        // MOCK: Write an empty file to satisfy the OS and demo the interaction loop
        fs.writeFileSync(filePath, Buffer.from([]));

        return filePath;
    });

    ipcMain.handle('repair:execute', async (_event, config: any) => {
        const jobId = `job-${Date.now()}`;
        repository.createJob({
            job_id: jobId,
            original_path: config.filePath || 'unknown',
            strategy: config.strategy
        });
        jobQueue.enqueue(jobId);
        return jobId;
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
