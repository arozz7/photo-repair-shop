import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkerSanitizationStrategy } from './MarkerSanitizationStrategy';
import fs from 'fs';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { sanitizeInvalidMarkers } from '../lib/jpeg/sanitizer';

vi.mock('fs');
vi.mock('../lib/jpeg/parser');
vi.mock('../lib/jpeg/sanitizer');

describe('MarkerSanitizationStrategy', () => {
    let strategy: MarkerSanitizationStrategy;

    beforeEach(() => {
        vi.clearAllMocks();
        strategy = new MarkerSanitizationStrategy();

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('CORRUPT_BUFFER'));

        vi.mocked(parseJpegMarkers).mockReturnValue({
            isValid: true,
            hasEoiMarker: true,
            markers: [],
            headerEndOffset: 10,
            bitstreamOffset: 12,
            invalidMarkers: [{ offset: 20, marker: 0x9A }],
            errors: []
        });

        vi.mocked(sanitizeInvalidMarkers).mockReturnValue({
            buffer: Buffer.from('CLEAN_BUFFER'),
            patchCount: 1,
            patches: [{ offset: 20, original: 0x9A, replacement: 0 }]
        });
    });

    it('should sanitize the bitstream using parsed offset', async () => {
        const result = await strategy.repair({
            jobId: '1',
            sourceFilePath: '/src.jpg',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(true);
        expect(result.metrics?.patchCount).toBe(1);
        expect(sanitizeInvalidMarkers).toHaveBeenCalledWith(expect.any(Buffer), 12);
        expect(fs.writeFileSync).toHaveBeenCalledWith('/out.jpg', expect.any(Buffer));
    });

    it('should fail if bitstream offset cannot be found', async () => {
        vi.mocked(parseJpegMarkers).mockReturnValue({
            isValid: false,
            hasEoiMarker: false,
            markers: [],
            headerEndOffset: 0,
            bitstreamOffset: 0,
            invalidMarkers: [],
            errors: []
        });

        const result = await strategy.repair({
            jobId: '2',
            sourceFilePath: '/broken.jpg',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('clear bitstream start offset');
        expect(sanitizeInvalidMarkers).not.toHaveBeenCalled();
    });
});
