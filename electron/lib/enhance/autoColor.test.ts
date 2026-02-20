import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeHistogram } from './autoColor';
import fs from 'fs';
import sharp from 'sharp';

vi.mock('fs');
vi.mock('sharp', () => {
    return {
        default: vi.fn().mockImplementation((path) => {
            if (path.includes('bad')) {
                return {
                    normalize: vi.fn().mockReturnThis(),
                    toFile: vi.fn().mockRejectedValue(new Error('Sharp processing error'))
                };
            }
            return {
                normalize: vi.fn().mockReturnThis(),
                toFile: vi.fn().mockResolvedValue({})
            };
        })
    };
});

describe('AutoColor Enhancer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockImplementation((path) => {
            return !path.toString().includes('missing');
        });
    });

    it('should successfully normalize an image histogram', async () => {
        await expect(normalizeHistogram('/good.jpg', '/out.jpg')).resolves.not.toThrow();
        expect(sharp).toHaveBeenCalledWith('/good.jpg');
    });

    it('should throw an error if file is missing', async () => {
        await expect(normalizeHistogram('/missing.jpg', '/out.jpg')).rejects.toThrow('Input file not found');
    });

    it('should map sharp errors properly', async () => {
        await expect(normalizeHistogram('/bad.jpg', '/out.jpg')).rejects.toThrow('Sharp processing error');
    });
});
