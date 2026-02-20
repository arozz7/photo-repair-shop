import { Router } from 'express';

export function createHealthRouter(): Router {
    const router = Router();

    router.get('/', (req, res) => {
        res.status(200).json({
            status: 'ok',
            version: '1.0.0', // Could read from package.json
            uptime: process.uptime()
        });
    });

    return router;
}
