import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeaderGraftingStrategy } from './HeaderGraftingStrategy';
import fs from 'fs';
import { extractHeader, extractBitstream, parseJpegMarkers } from '../lib/jpeg/parser';
import { sanitizeInvalidMarkers } from '../lib/jpeg/sanitizer';

vi.mock('fs');
vi.mock('../lib/jpeg/parser');
vi.mock('../lib/jpeg/sanitizer');

describe('HeaderGraftingStrategy', () => {
    let strategy: HeaderGraftingStrategy;

    beforeEach(() => {
        vi.clearAllMocks();
        strategy = new HeaderGraftingStrategy();

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (path.toString().includes('ref')) return Buffer.from('REF_HEADER_AND_STUFF');
            return Buffer.from('CORRUPT_STUFF');
        });

        vi.mocked(extractHeader).mockReturnValue(Buffer.from('VALID_HEADER'));
        vi.mocked(extractBitstream).mockReturnValue(Buffer.from('VALID_BITSTREAM'));

        vi.mocked(sanitizeInvalidMarkers).mockReturnValue({
            buffer: Buffer.from('VALID_HEADERVALID_BITSTREAM'),
            patchCount: 2,
            patches: []
        });
    });

    it('should complain if no reference file is provided', async () => {
        const result = await strategy.repair({
            jobId: '1',
            sourceFilePath: '/src.jpg',
            outputFilePath: '/out.jpg'
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Reference file is required');
    });

    it('should successfully stitch header and bitstream', async () => {
        const writeFileSyncMock = vi.mocked(fs.writeFileSync);

        const result = await strategy.repair({
            jobId: '1',
            sourceFilePath: '/src.jpg',
            outputFilePath: '/out.jpg',
            referenceFilePath: '/ref.jpg'
        });

        expect(result.success).toBe(true);
        expect(result.repairedFilePath).toBe('/out.jpg');
        expect(result.metrics?.patchCount).toBe(2);

        expect(extractHeader).toHaveBeenCalled();
        expect(extractBitstream).toHaveBeenCalled();
        expect(sanitizeInvalidMarkers).toHaveBeenCalled();
        expect(writeFileSyncMock).toHaveBeenCalledWith('/out.jpg', expect.any(Buffer));
    });

    it('should handle completely missing header gracefully', async () => {
        // Force extractBitstream to fail
        vi.mocked(extractBitstream).mockReturnValue(Buffer.from([]));

        vi.mocked(parseJpegMarkers).mockReturnValue({
            isValid: false,
            markers: [],
            headerEndOffset: 0,
            bitstreamOffset: 0,
            hasEoiMarker: true,
            invalidMarkers: [],
            errors: []
        });

        const result = await strategy.repair({
            jobId: '1',
            sourceFilePath: '/src.jpg',
            outputFilePath: '/out.jpg',
            referenceFilePath: '/ref.jpg'
        });

        expect(result.success).toBe(true);
        // The sanitize step should have been called with the raw corrupt stuff
        expect(sanitizeInvalidMarkers).toHaveBeenCalled();
    });
});
