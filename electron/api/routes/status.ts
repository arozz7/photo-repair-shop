import { Router } from 'express';
import { z } from 'zod';
import { ServerDependencies } from '../server.js';

const statusParamsSchema = z.object({
    jobId: z.string().min(1)
});

export function createStatusRouter(deps: ServerDependencies): Router {
    const router = Router();

    router.get('/:jobId', (req, res) => {
        try {
            const { jobId } = statusParamsSchema.parse(req.params);

            const job = deps.repository.getJob(jobId);

            if (!job) {
                res.status(404).json({ error: `Job ${jobId} not found` });
                return;
            }

            const responseStatus: any = {
                jobId: job.job_id,
                status: job.status,
                stage: job.stage,
                percent: job.percent,
                sourcePhotoId: job.source_photo_id,
                error: job.error_message
            };

            // Reconstruct the payload SPO expects when status is done
            if (job.status === 'done' && job.repaired_path) {
                responseStatus.result = {
                    repairedFilePath: job.repaired_path,
                    strategy: job.strategy,
                    verificationTier: job.verification_tier || 'basic',
                    isVerified: !!job.is_verified,
                    warnings: job.warnings_json ? JSON.parse(job.warnings_json) : []
                };
            } else if (job.status === 'done' && job.warnings_json && !job.repaired_path) {
                // If it was an analysis job, return the raw analysis json payload
                responseStatus.result = JSON.parse(job.warnings_json);
            }

            res.status(200).json(responseStatus);

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
            } else {
                console.error('[API Status] Unexpected error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    return router;
}
