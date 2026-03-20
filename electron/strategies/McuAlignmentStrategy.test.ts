import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { McuAlignmentStrategy } from './McuAlignmentStrategy';
import * as parser from '../lib/jpeg/parser';
import * as mcuDetector from '../lib/jpeg/mcuDetector';

vi.mock('fs');
vi.mock('../lib/jpeg/parser');
vi.mock('../lib/jpeg/mcuDetector');

describe('McuAlignmentStrategy', () => {
    let strategy: McuAlignmentStrategy;

    beforeEach(() => {
        vi.clearAllMocks();
        strategy = new McuAlignmentStrategy();
    });

    it('should fail if reference file is missing', async () => {
        const result = await strategy.repair({
            jobId: '123',
            sourceFilePath: '/src.jpg',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Reference file is required');
    });

    it('should detect and align MCU blocks using reference', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        // Mock source buffer (simulated corrupted) and reference buffer
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (path === '/src.jpg') return Buffer.from([0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x01, 0x02, 0x00, 0xFF, 0xD0, 0x99, 0xFF, 0xD9]);
            if (path === '/ref.jpg') return Buffer.from([0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x01, 0x02, 0x03, 0xFF, 0xD0, 0x04, 0xFF, 0xD9]);
            return Buffer.from([]);
        });

        // Mock parser
        vi.mocked(parser.parseJpegMarkers).mockReturnValue({
            isValid: true,
            hasEoiMarker: true,
            bitstreamOffset: 4,
            headerEndOffset: 4,
            markers: [],
            invalidMarkers: [],
            errors: []
        });

        // Mock detector
        vi.mocked(mcuDetector.detectMcuMisalignment).mockReturnValue({
            likelyMisaligned: true,
            confidence: 'high',
            evidence: ['Restart markers out of sequence']
        });

        const onProgress = vi.fn();

        const result = await strategy.repair({
            jobId: '123',
            sourceFilePath: '/src.jpg',
            referenceFilePath: '/ref.jpg',
            outputFilePath: '/out.jpg',
            onProgress
        });

        expect(result.success).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledWith(100, 'MCU Alignment complete');
        // We expect it to have patched the file using the reference
        expect(result.metrics?.patchCount).toBeGreaterThan(0);
    });

    it('should skip alignment if no misalignment is detected', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from([]));

        vi.mocked(parser.parseJpegMarkers).mockReturnValue({
            isValid: true,
            hasEoiMarker: true,
            bitstreamOffset: 4,
            headerEndOffset: 4,
            markers: [],
            invalidMarkers: [],
            errors: []
        });

        vi.mocked(mcuDetector.detectMcuMisalignment).mockReturnValue({
            likelyMisaligned: false,
            confidence: 'low',
            evidence: []
        });

        const result = await strategy.repair({
            jobId: '123',
            sourceFilePath: '/src.jpg',
            referenceFilePath: '/ref.jpg',
            outputFilePath: '/out.jpg'
        });

        expect(result.success).toBe(true);
        expect(result.warnings).toContain('No MCU misalignment detected. Copying source as-is.');
    });
});
