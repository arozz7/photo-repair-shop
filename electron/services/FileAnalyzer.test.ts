import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileAnalyzer } from './FileAnalyzer';
import fs from 'fs';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { analyzeEntropyMap } from '../lib/jpeg/entropy';
import { ExifToolService } from '../lib/exiftool/ExifToolService';

vi.mock('fs');
vi.mock('../lib/jpeg/parser');
vi.mock('../lib/jpeg/entropy');
vi.mock('../lib/exiftool/ExifToolService');

describe('FileAnalyzer', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as any);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from([]));

        vi.mocked(parseJpegMarkers).mockReturnValue({
            isValid: true,
            hasEoiMarker: true,
            markers: [],
            headerEndOffset: 100,
            bitstreamOffset: 100,
            invalidMarkers: [],
            errors: []
        });

        vi.mocked(analyzeEntropyMap).mockReturnValue({ sectors: [] });
    });

    it('should identify a valid CR2 file', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({ errors: [] });

        const result = await FileAnalyzer.analyze('job1', 'healthy.cr2');
        expect(result.fileType).toBe('cr2');
        expect(result.isCorrupted).toBe(false);
    });

    it('should identify unreadable RAW and suggest extraction', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({ errors: ['Format error'] });

        const result = await FileAnalyzer.analyze('job2', 'broken.nef');
        expect(result.isCorrupted).toBe(true);
        expect(result.corruptionTypes).toContain('raw_unreadable');
        expect(result.suggestedStrategies[0].strategy).toBe('preview-extraction');
    });

    it('should detect invalid markers in JPEG and suggest sanitization', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({});
        vi.mocked(parseJpegMarkers).mockReturnValue({
            isValid: true,
            hasEoiMarker: true,
            markers: [],
            headerEndOffset: 100,
            bitstreamOffset: 100,
            invalidMarkers: [{ offset: 200, marker: 0x9A }],
            errors: []
        });

        const result = await FileAnalyzer.analyze('job3', 'bad-markers.jpg');
        expect(result.isCorrupted).toBe(true);
        expect(result.corruptionTypes).toContain('invalid_markers');

        const strategies = result.suggestedStrategies.map(s => s.strategy);
        expect(strategies).toContain('marker-sanitization');
    });

    it('should detect hollow files when size is too small for resolution', async () => {
        vi.mocked(fs.statSync).mockReturnValue({ size: 30 * 1024 } as any); // 30KB
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({ resolution: '4000x3000' }); // 12 MP

        const result = await FileAnalyzer.analyze('job4', 'hollow.jpg');

        expect(result.isCorrupted).toBe(true);
        expect(result.corruptionTypes).toContain('hollow_header');

        const strategy = result.suggestedStrategies.find(s => s.strategy === 'header-grafting');
        expect(strategy).toBeDefined();
        expect(strategy?.confidence).toBe('high');
        expect(strategy?.reason).toContain('Hollow File detected');
    });
});
