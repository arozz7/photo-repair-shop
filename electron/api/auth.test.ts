import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAndPersistToken, createAuthMiddleware, getTokenPath } from './auth';
import fs from 'fs';

vi.mock('fs');

describe('Security Module (auth.ts)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateAndPersistToken', () => {
        it('should generate a valid UUID token and save it to disk', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const token = generateAndPersistToken();
            expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                getTokenPath(),
                token,
                { mode: 0o600 }
            );
        });
    });

    describe('createAuthMiddleware', () => {
        it('should pass if token matches', () => {
            const middleware = createAuthMiddleware('test-token');
            const req = { headers: { authorization: 'Bearer test-token' } } as any;
            const res = {} as any;
            const next = vi.fn();

            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should return 401 if token is missing or wrong', () => {
            const middleware = createAuthMiddleware('test-token');
            const req = { headers: { authorization: 'Bearer WRONG' } } as any;
            const jsonMock = vi.fn();
            const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock } as any;
            const next = vi.fn();

            middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });
    });
});
