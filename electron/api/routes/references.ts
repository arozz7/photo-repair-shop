import { Router } from 'express';
import { z } from 'zod';
import { ServerDependencies } from '../server.js';
import { ExifMetadata } from '../../lib/exiftool/ExifToolService.js';

const referencesQuerySchema = z.object({
    cameraModel: z.string().optional(),
    resolution: z.string().optional(),
    format: z.string().optional()
});

export function createReferencesRouter(deps: ServerDependencies): Router {
    const router = Router();

    router.get('/', (req, res) => {
        try {
            const query = referencesQuerySchema.parse(req.query);

            // The ReferenceManager.findInLibrary expects a partial ExifMetadata object minimum
            const mockMetadata: Partial<ExifMetadata> = {};
            if (query.cameraModel) mockMetadata.cameraModel = query.cameraModel;
            if (query.resolution) mockMetadata.resolution = query.resolution;

            const matches = deps.refManager.findInLibrary(mockMetadata as ExifMetadata);

            // Map the output to match what SPO expects from the API spec
            const mappedReferences = matches.map(match => ({
                filePath: match.filePath,
                cameraModel: match.cameraModel,
                resolution: match.resolution,
                compatibilityScore: 0.95 // Hardcoded for MVP, actual scoring happens on validation
            }));

            res.status(200).json({ references: mappedReferences });

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
            } else {
                console.error('[API References] Unexpected error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    return router;
}
