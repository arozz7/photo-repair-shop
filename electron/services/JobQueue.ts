import { RepairRepository } from '../db/RepairRepository';

export interface JobHandler {
    (jobId: string): Promise<void>;
}

export class JobQueue {
    private queue: string[] = [];
    private activeJobs = new Set<string>();

    constructor(
        private repository: RepairRepository,
        private handler: JobHandler,
        private concurrency: number = 2
    ) { }

    enqueue(jobId: string) {
        this.repository.updateJob(jobId, { status: 'queued' });
        this.queue.push(jobId);
        this.processNext();
    }

    private async processNext() {
        if (this.activeJobs.size >= this.concurrency) return;

        const nextJobId = this.queue.shift();
        if (!nextJobId) return; // Queue empty

        this.activeJobs.add(nextJobId);

        try {
            this.repository.updateJob(nextJobId, { status: 'analyzing' });
            await this.handler(nextJobId);
            // Handler is expected to set final status to 'done' or 'failed'
        } catch (err: any) {
            this.repository.updateJob(nextJobId, {
                status: 'failed',
                error_message: err.message,
                completed_at: new Date().toISOString()
            });
        } finally {
            this.activeJobs.delete(nextJobId);
            this.processNext();
        }
    }

    getStatus(jobId: string) {
        return this.repository.getJob(jobId);
    }

    isRunning(jobId: string) {
        return this.activeJobs.has(jobId);
    }
}
