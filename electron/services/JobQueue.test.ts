import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueue } from './JobQueue';
import { RepairRepository } from '../db/RepairRepository';

describe('JobQueue', () => {
    let mockRepo: any;
    let mockHandler: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRepo = {
            updateJob: vi.fn(),
            getJob: vi.fn()
        };

        mockHandler = vi.fn().mockResolvedValue(undefined);
    });

    it('should enqueue and process jobs sequentially within concurrency limits', async () => {
        // Concurrency 1
        const queue = new JobQueue(mockRepo as RepairRepository, mockHandler, 1);

        queue.enqueue('job1');
        queue.enqueue('job2');

        // Allow microtasks to execute
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockRepo.updateJob).toHaveBeenCalledWith('job1', { status: 'queued' });
        expect(mockRepo.updateJob).toHaveBeenCalledWith('job1', { status: 'analyzing' });

        expect(mockHandler).toHaveBeenCalledWith('job1');
        expect(mockHandler).toHaveBeenCalledWith('job2');
    });

    it('should catch handler errors and mark job failed', async () => {
        mockHandler.mockRejectedValue(new Error('Handler explosion'));
        const queue = new JobQueue(mockRepo as RepairRepository, mockHandler, 1);

        queue.enqueue('job3');

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockRepo.updateJob).toHaveBeenCalledWith('job3', expect.objectContaining({
            status: 'failed',
            error_message: 'Handler explosion'
        }));
    });
});
