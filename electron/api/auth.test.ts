import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateAndPersistToken, createAuthMiddleware, getTokenPath } from './auth.js';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

describe('Auth Module', () => {
    beforeEach(() => {
        // Clear any existing token before testing
        const tokenPath = getTokenPath();
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
        }
    });

    afterEach(() => {
        // Cleanup after testing
        const tokenPath = getTokenPath();
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
        }
    });

    it('generates a unique token and persists it to disk', () => {
        const token = generateAndPersistToken();
        const tokenPath = getTokenPath();

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        // Assert file exists and contains the token
        expect(fs.existsSync(tokenPath)).toBe(true);
        const persistedToken = fs.readFileSync(tokenPath, 'utf8');
        expect(persistedToken).toBe(token);
    });

    describe('Auth Middleware', () => {
        const testToken = 'test-token-1234';
        const middleware = createAuthMiddleware(testToken);

        const mockResponse = () => {
            const res: Partial<Response> = {};
            res.status = (code) => {
                res.statusCode = code;
                return res as Response;
            };
            res.json = (data) => {
                res.body = data;
                return res as Response;
            };
            return res as Response & { statusCode?: number; body?: any };
        };

        it('allows request with correct token', () => {
            const req = { headers: { authorization: `Bearer ${testToken}` } } as Request;
            const res = mockResponse();
            let nextCalled = false;
            const next: NextFunction = () => { nextCalled = true; };

            middleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(res.statusCode).toBeUndefined(); // Should not have set an error status
        });

        it('rejects request with missing token', () => {
            const req = { headers: {} } as Request;
            const res = mockResponse();
            let nextCalled = false;
            const next: NextFunction = () => { nextCalled = true; };

            middleware(req, res, next);

            expect(nextCalled).toBe(false);
            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ error: 'Unauthorized' });
        });

        it('rejects request with incorrect token', () => {
            const req = { headers: { authorization: 'Bearer WRONG-TOKEN' } } as Request;
            const res = mockResponse();
            let nextCalled = false;
            const next: NextFunction = () => { nextCalled = true; };

            middleware(req, res, next);

            expect(nextCalled).toBe(false);
            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ error: 'Unauthorized' });
        });
    });
});
