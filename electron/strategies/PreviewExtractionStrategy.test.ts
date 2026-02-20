import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewExtractionStrategy } from './PreviewExtractionStrategy';
import fs from 'fs';
import { ExifToolService } from '../lib/exiftool/ExifToolService';

vi.mock('fs');
vi.mock('../lib/exiftool/ExifToolService');

describe('PreviewExtractionStrategy', () => {
    let strategy: PreviewExtractionStrategy;

    beforeEach(() => {
        vi.clearAllMocks();
        strategy = new PreviewExtractionStrategy();

        vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('should extract preview successfully', async () => {
        vi.mocked(ExifToolService.extractPreview).mockResolvedValue(true);

        const result = await strategy.repair({
            jobId: '1',
            sourceFilePath: '/src.cr2',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(true);
        expect(result.repairedFilePath).toBe('/out.jpg');
        expect(ExifToolService.extractPreview).toHaveBeenCalledWith('/src.cr2', '/out.jpg');
    });

    it('should fail if extractPreview returns false', async () => {
        vi.mocked(ExifToolService.extractPreview).mockResolvedValue(false);

        const result = await strategy.repair({
            jobId: '2',
            sourceFilePath: '/broken.cr2',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to extract');
    });
});
