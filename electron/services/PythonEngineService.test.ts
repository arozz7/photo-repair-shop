import { expect, test, vi } from 'vitest';
import { PythonEngineService } from './PythonEngineService.js';
import { spawn } from 'child_process';
import EventEmitter from 'events';

// Mock child_process
vi.mock('child_process', () => ({
    spawn: vi.fn(),
    default: { spawn: vi.fn() }
}));

test('PythonEngineService parses JSON stdout correctly', async () => {
    const service = new PythonEngineService(process.cwd());

    // Create a mock process with an EventEmitter for stdout/stderr
    const mockProc = new EventEmitter() as any;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockProc);

    const onProgress = vi.fn();

    // Trigger executeRepair (it returns a promise)
    const executePromise = service.executeRepair({
        jobId: 'job-123',
        filePath: 'test.jpg',
        strategy: 'header-grafting'
    }, onProgress);

    // Simulate python writing JSON
    const expectedEvent = {
        job_id: 'job-123',
        percent: 50,
        stage: 'Testing',
        status: 'running'
    };

    mockProc.stdout.emit('data', Buffer.from(JSON.stringify(expectedEvent) + '\n'));

    // Simulate process finish
    mockProc.emit('close', 0);

    await executePromise;

    expect(spawn).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(expectedEvent);
});

import os from 'os';

test('PythonEngineService passes temporary directory as output-dir', async () => {
    const service = new PythonEngineService(process.cwd());

    const mockProc = new EventEmitter() as any;
    mockProc.stdout = new EventEmitter();
    mockProc.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockProc);

    const executePromise = service.executeRepair({
        jobId: 'job-temp-1',
        filePath: 'test-2.jpg',
        strategy: 'marker-sanitization'
    }, vi.fn());

    mockProc.emit('close', 0);
    await executePromise;

    // Check that spawn was called with our new --output-dir argument set to os.tmpdir()
    expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--output-dir', os.tmpdir()])
    );
});
