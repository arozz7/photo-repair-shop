import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepairVerifier } from './RepairVerifier';
import { ExifToolService } from '../lib/exiftool/ExifToolService';
import fs from 'fs';
import sharp from 'sharp';

vi.mock('fs');
vi.mock('../lib/exiftool/ExifToolService');

// Properly mock sharp
vi.mock('sharp', () => {
    return {
        default: vi.fn().mockImplementation((path) => {
            if (path.includes('bad-decode')) {
                return { metadata: vi.fn().mockRejectedValue(new Error('Corrupt pixels')) };
            }
            return {
                metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 })
            };
        })
    };
});

describe('RepairVerifier', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from([
            0xFF, 0xD8,                          // SOI
            0xFF, 0xDA, 0x00, 0x08,              // SOS
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // SOS payload
            0x12, 0x34, 0x56, 0x78,              // Fake high entropy
            0xFF, 0xD9                           // EOI
        ]));
    });

    it('should pass a healthy file through all tiers', async () => {
        vi.mocked(ExifToolService.validateFile).mockResolvedValue({ passed: true, errors: [], warnings: [] });

        const result = await RepairVerifier.verify('/good.jpg');

        expect(result.isVerified).toBe(true);
        expect(result.tier).toBe('decode'); // highest tier passed
    });

    it('should fail cleanly if ExifTool validation fails (Tier 1)', async () => {
        vi.mocked(ExifToolService.validateFile).mockResolvedValue({ passed: false, errors: ['Bad Header'], warnings: [] });

        const result = await RepairVerifier.verify('/bad-header.jpg');

        expect(result.isVerified).toBe(false);
        expect(result.tier).toBe('structural');
        expect(result.error).toContain('Bad Header');
    });

    it('should fail cleanly if sharp decode fails (Tier 3)', async () => {
        vi.mocked(ExifToolService.validateFile).mockResolvedValue({ passed: true, errors: [], warnings: [] });

        const result = await RepairVerifier.verify('/bad-decode.jpg');

        expect(result.isVerified).toBe(false);
        expect(result.tier).toBe('decode');
        expect(result.error).toContain('Corrupt pixels');
    });
});
