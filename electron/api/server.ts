import express, { Express } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createAuthMiddleware } from './auth.js';
import { JobQueue } from '../services/JobQueue.js';
import { RepairRepository } from '../db/RepairRepository.js';
import { ReferenceManager } from '../services/ReferenceManager.js';

import { createHealthRouter } from './routes/health.js';
import { createAnalyzeRouter } from './routes/analyze.js';
import { createRepairRouter } from './routes/repair.js';
import { createStatusRouter } from './routes/status.js';
import { createReferencesRouter } from './routes/references.js';

export interface ServerDependencies {
    jobQueue: JobQueue;
    repository: RepairRepository;
    refManager: ReferenceManager;
}

export function createServer(token: string, deps: ServerDependencies): Express {
    const app = express();

    // 1. Basic Middleware
    app.use(cors({ origin: 'app://.' })); // restrict to local electron origin
    app.use(express.json({ limit: '1mb' }));

    // 2. Rate Limiting
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        limit: 100, // Limit each IP to 100 requests per `window` (here, per minute).
        standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    });
    app.use(limiter);

    // 3. Unauthenticated Routes
    app.use('/api/health', createHealthRouter());

    // 4. Authenticated Routes Boundary
    app.use('/api', createAuthMiddleware(token));

    app.use('/api/analyze', createAnalyzeRouter(deps));
    app.use('/api/repair', createRepairRouter(deps));
    app.use('/api/status', createStatusRouter(deps));
    app.use('/api/references', createReferencesRouter(deps));

    return app;
}
