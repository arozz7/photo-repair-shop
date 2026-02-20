import { describe, it, expect } from 'vitest';
import { detectMcuMisalignment } from './mcuDetector';
import { JpegParseResult } from './parser';

describe('MCU Misalignment Detector', () => {
    it('should flag high confidence if completely out of sequence', () => {
        const parseRes: JpegParseResult = {
            isValid: true,
            hasEoiMarker: true,
            bitstreamOffset: 10,
            headerEndOffset: 10,
            invalidMarkers: [],
            errors: [],
            markers: [
                { offset: 12, marker: 0xFFD0 }, // RST0
                { offset: 14, marker: 0xFFD5 }, // RST5 (Skipped 1-4)
            ]
        };

        const buffer = Buffer.alloc(100, 255); // Fake random entropy buffer

        const res = detectMcuMisalignment(buffer, parseRes);
        expect(res.likelyMisaligned).toBe(true);
        expect(res.confidence).toBe('high');
        expect(res.evidence[0]).toContain('out of chronological sequence');
    });

    it('should skip detection if the file lacks headers', () => {
        const parseRes: JpegParseResult = {
            isValid: false,
            hasEoiMarker: false,
            bitstreamOffset: 0,
            headerEndOffset: 0,
            invalidMarkers: [],
            errors: [],
            markers: []
        };

        const res = detectMcuMisalignment(Buffer.alloc(10), parseRes);
        expect(res.likelyMisaligned).toBe(false);
    });

    it('should flag low confidence if early entropy drop occurs without EOI', () => {
        const parseRes: JpegParseResult = {
            isValid: true,
            hasEoiMarker: false,
            bitstreamOffset: 10,
            headerEndOffset: 10,
            invalidMarkers: [],
            errors: [],
            markers: []
        };

        // Create a buffer where the first 50 bytes are random (high entropy), the rest are 0x00
        const highEntropy = Buffer.alloc(50);
        for (let i = 0; i < 50; i++) highEntropy[i] = i;

        const buffer = Buffer.concat([
            Buffer.alloc(10), // header
            highEntropy,
            Buffer.alloc(500, 0x00) // low entropy early drop
        ]);

        const res = detectMcuMisalignment(buffer, parseRes);
        expect(res.likelyMisaligned).toBe(true);
        expect(res.confidence).toBe('low');
        expect(res.evidence[0]).toContain('Significant entropy drop');
    });
});
