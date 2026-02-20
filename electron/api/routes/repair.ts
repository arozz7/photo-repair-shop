import { Router } from 'express';
import { z } from 'zod';
import { ServerDependencies } from '../server.js';
import fs from 'fs';
import path from 'path';

const repairSchema = z.object({
    filePath: z.string().min(1),
    strategy: z.enum(['header-grafting', 'preview-extraction', 'marker-sanitization']),
    outputPath: z.string().min(1),
    referenceFilePath: z.string().optional(),
    candidateReferences: z.array(z.string()).optional(),
    autoEnhance: z.boolean().optional(),
    sourcePhotoId: z.number().optional()
});

export function createRepairRouter(deps: ServerDependencies): Router {
    const router = Router();

    router.post('/', async (req, res) => {
        try {
            const body = repairSchema.parse(req.body);

            if (!fs.existsSync(body.filePath)) {
                res.status(404).json({ error: `File not found: ${body.filePath}` });
                return;
            }

            // Validate reference requirement
            if (body.strategy === 'header-grafting') {
                if (!body.referenceFilePath && (!body.candidateReferences || body.candidateReferences.length === 0)) {
                    res.status(400).json({ error: "header-grafting requires either 'referenceFilePath' or 'candidateReferences'." });
                    return;
                }
            }

            // Create a dedicated job ID for the repair execution
            const jobId = `job-rep-${Date.now()}`;

            deps.repository.createJob({
                job_id: jobId,
                original_path: body.filePath,
                strategy: body.strategy,
                reference_path: body.referenceFilePath || (body.candidateReferences ? body.candidateReferences[0] : undefined) // Naive selection for now
            });
            deps.repository.updateJob(jobId, {
                status: 'queued',
                source_photo_id: body.sourcePhotoId,
                repaired_path: body.outputPath
            });

            // Enqueue it to the engine job queue
            deps.jobQueue.enqueue(jobId);

            res.status(202).json({ jobId, status: 'queued' });

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
            } else {
                console.error('[API Repair] Unexpected error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    return router;
}
