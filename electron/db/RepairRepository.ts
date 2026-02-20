import Database from 'better-sqlite3';

export interface RepairOperation {
    id: number;
    job_id: string;
    source_photo_id: number | null;
    source_app: string;
    original_path: string;
    repaired_path: string | null;
    strategy: string;
    status: 'queued' | 'analyzing' | 'repairing' | 'verifying' | 'done' | 'failed';
    stage: string | null;
    percent: number;
    error_message: string | null;
    warnings_json: string | null;
    verification_tier: string | null;
    is_verified: boolean;
    auto_enhance: boolean;
    created_at: string;
    completed_at: string | null;
}

export interface CreateJobInput {
    job_id: string;
    original_path: string;
    strategy: string;
    source_photo_id?: number;
    source_app?: string;
    auto_enhance?: boolean;
}

export class RepairRepository {
    constructor(private db: Database.Database) { }

    createJob(job: CreateJobInput): RepairOperation {
        const stmt = this.db.prepare(`
      INSERT INTO repair_operations (
        job_id, source_photo_id, source_app, original_path, strategy, auto_enhance
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            job.job_id,
            job.source_photo_id ?? null,
            job.source_app ?? 'manual',
            job.original_path,
            job.strategy,
            job.auto_enhance ? 1 : 0
        );

        return this.getJob(job.job_id)!;
    }

    updateJob(jobId: string, updates: Partial<RepairOperation>): void {
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => {
            const val = (updates as any)[k];
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val;
        });

        const stmt = this.db.prepare(`UPDATE repair_operations SET ${setClause} WHERE job_id = ?`);
        stmt.run(...values, jobId);
    }

    getJob(jobId: string): RepairOperation | null {
        const stmt = this.db.prepare(`SELECT * FROM repair_operations WHERE job_id = ?`);
        const row = stmt.get(jobId) as any;
        if (!row) return null;

        return {
            ...row,
            is_verified: row.is_verified === 1,
            auto_enhance: row.auto_enhance === 1
        };
    }

    getActiveJobs(): RepairOperation[] {
        const stmt = this.db.prepare(`SELECT * FROM repair_operations WHERE status NOT IN ('done', 'failed')`);
        return stmt.all().map((row: any) => ({
            ...row,
            is_verified: row.is_verified === 1,
            auto_enhance: row.auto_enhance === 1
        }));
    }
}
