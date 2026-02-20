import { spawn } from 'child_process';
import path from 'path';

export interface EngineConfig {
    jobId: string;
    filePath: string;
    strategy: string;
    referencePath?: string;
}

export interface EngineProgressEvent {
    job_id: string;
    percent: number;
    stage: string;
    status: string;
    error_message?: string;
    repaired_path?: string;
}

export interface IRepairEngine {
    executeRepair(config: EngineConfig, onProgress: (event: EngineProgressEvent) => void): Promise<void>;
}

export class PythonEngineService implements IRepairEngine {
    private pythonPath: string;
    private engineScript: string;

    constructor(projectRoot: string) {
        this.engineScript = path.join(projectRoot, 'engine', 'main.py');

        // Use the virtual environment if it exists
        if (process.platform === 'win32') {
            this.pythonPath = path.join(projectRoot, 'engine', '.venv', 'Scripts', 'python.exe');
        } else {
            this.pythonPath = path.join(projectRoot, 'engine', '.venv', 'bin', 'python');
        }
    }

    async executeRepair(config: EngineConfig, onProgress: (event: EngineProgressEvent) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = [
                this.engineScript,
                '--job-id', config.jobId,
                '--file-path', config.filePath,
                '--strategy', config.strategy
            ];

            if (config.referencePath) {
                args.push('--reference-path', config.referencePath);
            }

            console.log(`[PythonEngineService] Spawning python process: ${this.pythonPath}`);
            console.log(`[PythonEngineService] Args:`, args);

            const proc = spawn(this.pythonPath, args);

            proc.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const event = JSON.parse(line) as EngineProgressEvent;
                            onProgress(event);
                        } catch (e) {
                            console.warn('[PythonEngineService] Failed to parse stdout JSON:', line);
                        }
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const errStr = data.toString();
                console.error(`[PythonEngineService stderr] ${errStr}`);
                // Emit as a progress event so we see it in the UI if possible
                try {
                    onProgress({
                        job_id: config.jobId,
                        percent: 0,
                        stage: 'Engine Error',
                        status: 'running',
                        error_message: errStr
                    });
                } catch (e) { }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Python engine exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }
}
