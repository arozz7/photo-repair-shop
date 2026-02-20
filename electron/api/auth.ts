import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { RequestHandler } from 'express';

export function getTokenPath(): string {
    return path.join(os.homedir(), '.photo-repair-shop', 'api-token');
}

export function generateAndPersistToken(): string {
    const token = randomUUID();
    const tokenPath = getTokenPath();

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });

    // Write token with owner read-only mode for security
    fs.writeFileSync(tokenPath, token, { mode: 0o600 });

    return token;
}

export function createAuthMiddleware(token: string): RequestHandler {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (authHeader !== `Bearer ${token}`) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        next();
    };
}
