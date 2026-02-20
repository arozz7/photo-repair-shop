import { Router } from 'express';
import { z } from 'zod';
import { ServerDependencies } from '../server.js';
import { FileAnalyzer } from '../../services/FileAnalyzer.js';
import fs from 'fs';

const analyzeSchema = z.object({
    filePath: z.string().min(1),
    metadata: z.object({
        cameraModel: z.string().optional(),
        resolution: z.string().optional(),
        fileFormat: z.string().optional()
    }).optional(),
    sourcePhotoId: z.number().optional()
});

export function createAnalyzeRouter(deps: ServerDependencies): Router {
    const router = Router();

    router.post('/', async (req, res) => {
        try {
            const body = analyzeSchema.parse(req.body);

            if (!fs.existsSync(body.filePath)) {
                res.status(404).json({ error: `File not found: ${body.filePath}` });
                return;
            }

            // Generate a job ID to track the background analysis task
            const jobId = `job-${Date.now()}`;

            // Register an initial "analyzing" job state to the repository
            deps.repository.createJob({
                job_id: jobId,
                original_path: body.filePath,
                strategy: 'unknown',
            });
            deps.repository.updateJob(jobId, { status: 'analyzing', stage: 'Extracting metadata', source_photo_id: body.sourcePhotoId });

            // Fire off the analysis asynchronously so we return 202 immediately to SPO
            setTimeout(async () => {
                try {
                    const result = await FileAnalyzer.analyze('analysis-only', body.filePath);

                    // We need a stable recommended strategy; pick the first high-confidence one
                    let bestStrategy = 'unknown';
                    if (result.suggestedStrategies.length > 0) {
                        bestStrategy = result.suggestedStrategies[0].strategy;
                    }

                    // For now we persist the result back to the job record so it can be polled
                    deps.repository.updateJob(jobId, {
                        status: 'done',
                        percent: 100,
                        stage: 'Analysis complete',
                        strategy: bestStrategy,
                        // Package the full analysis result as JSON into warnings_json just to pass it along for now, 
                        // though a cleaner schema update would be better in a future refactor.
                        warnings_json: JSON.stringify(result)
                    });
                } catch (err: any) {
                    deps.repository.updateJob(jobId, { status: 'failed', error_message: err.message });
                }
            }, 0);

            res.status(202).json({ jobId, status: 'queued' });

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
            } else {
                console.error('[API Analyze] Unexpected error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    return router;
}
