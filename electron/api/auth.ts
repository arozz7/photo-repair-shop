import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { RequestHandler } from 'express';

export function getTokenPath(): string {
    return path.join(os.homedir(), '.photo-repair-shop', 'api-token');
}

export function generateAndPersistToken(): string {
    const token = crypto.randomUUID();
    const tokenPath = getTokenPath();

    if (!fs.existsSync(path.dirname(tokenPath))) {
        fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    }

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
