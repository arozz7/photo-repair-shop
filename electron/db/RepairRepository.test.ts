import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from './database';
import { RepairRepository } from './RepairRepository';

describe('RepairRepository', () => {
    let db: Database.Database;
    let repo: RepairRepository;

    beforeEach(() => {
        db = initializeDatabase(':memory:');
        repo = new RepairRepository(db);
    });

    afterEach(() => {
        db.close();
    });

    it('should create a job and retrieve it', () => {
        const job = repo.createJob({
            job_id: 'test-uuid-1',
            original_path: '/corrupt.jpg',
            strategy: 'header-grafting'
        });

        expect(job).toBeDefined();
        expect(job.job_id).toBe('test-uuid-1');
        expect(job.status).toBe('queued');
        expect(job.original_path).toBe('/corrupt.jpg');

        // Auto-defaults
        expect(job.source_app).toBe('manual');
        expect(job.percent).toBe(0);
        expect(job.auto_enhance).toBe(false);
    });

    it('should update job status and progress', () => {
        repo.createJob({
            job_id: 'test-uuid-2',
            original_path: '/file.cr2',
            strategy: 'preview-extraction'
        });

        repo.updateJob('test-uuid-2', { status: 'repairing', percent: 50 });

        const job = repo.getJob('test-uuid-2');
        expect(job?.status).toBe('repairing');
        expect(job?.percent).toBe(50);
    });

    it('should retrieve only active jobs', () => {
        repo.createJob({ job_id: 'active-1', original_path: '/a.jpg', strategy: 'header-grafting' });
        repo.createJob({ job_id: 'active-2', original_path: '/b.jpg', strategy: 'header-grafting' });

        repo.updateJob('active-1', { status: 'done' }); // Should be filtered out

        const active = repo.getActiveJobs();
        expect(active.length).toBe(1);
        expect(active[0].job_id).toBe('active-2');
    });
});
