import { describe, it, expect } from 'vitest';
import { parseJpegMarkers, extractBitstream } from './parser';
import { sanitizeInvalidMarkers } from './sanitizer';
import { analyzeEntropyMap, isHighEntropySector } from './entropy';

describe('JPEG Utilities', () => {
    describe('JPEG Parser', () => {
        it('should fail on empty or non-JPEG buffer', () => {
            const result = parseJpegMarkers(Buffer.from([0x00, 0x01]));
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should parse a healthy fake JPEG', () => {
            // SOI (FF D8), APP0 (FF E0 00 10 ...), SOS (FF DA 00 08 ...), Bitstream, EOI (FF D9)
            const fakeJpeg = Buffer.from([
                0xFF, 0xD8,                          // SOI
                0xFF, 0xE0, 0x00, 0x10,              // APP0 (length 16)
                ...new Array(14).fill(0),            // APP0 payload
                0xFF, 0xDA, 0x00, 0x08,              // SOS (length 8)
                ...new Array(6).fill(0),             // SOS payload
                0x12, 0x34, 0x56, 0x78,              // Bitstream data
                0xFF, 0x00,                          // Stuffed FF
                0xFF, 0xD9                           // EOI
            ]);

            const result = parseJpegMarkers(fakeJpeg);
            expect(result.isValid).toBe(true);
            expect(result.hasEoiMarker).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.invalidMarkers).toHaveLength(0);
            expect(result.headerEndOffset).toBe(20);

            const sosMarker = result.markers.find(m => m.marker === 0xFFDA);
            expect(sosMarker).toBeDefined();

            const bitstream = extractBitstream(fakeJpeg);
            expect(bitstream.length).toBe(8); // 12 34 56 78 FF 00 FF D9
        });
    });

    describe('JPEG Sanitizer', () => {
        it('should patch invalid markers inside the bitstream', () => {
            const buffer = Buffer.from([
                0xFF, 0xDA, 0x00, 0x08,              // SOS
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // SOS payload
                0x12, 0xFF, 0x9A, 0x34,              // FF 9A is invalid
                0xFF, 0xD0,                          // FF D0 is valid (RST0)
                0xFF, 0x00,                          // FF 00 is valid (stuffed)
                0xFF, 0xD9                           // EOI
            ]);

            const bitstreamOffset = 10;
            const result = sanitizeInvalidMarkers(buffer, bitstreamOffset);

            expect(result.patchCount).toBe(1);
            expect(result.patches[0].original).toBe(0x9A);
            // The patched buffer should have 00 in place of 9A
            expect(result.buffer[12]).toBe(0x00);
        });
    });

    describe('Entropy Analyzer', () => {
        it('should identify high and low entropy sectors', () => {
            // Create a low entropy sector (repeated values)
            const lowEntropy = Buffer.alloc(200, 0x00);
            // Create a high entropy sector (random values 0-255)
            const highEntropy = Buffer.alloc(200);
            for (let i = 0; i < 200; i++) highEntropy[i] = i % 256;

            expect(isHighEntropySector(lowEntropy, 20)).toBe(false);
            expect(isHighEntropySector(highEntropy, 20)).toBe(true);

            const combined = Buffer.concat([Buffer.alloc(10), highEntropy, lowEntropy]);
            const map = analyzeEntropyMap(combined, 10, 200, 20);

            expect(map.sectors[0].isHighEntropy).toBe(true); // 10 to 210
            expect(map.sectors[1].isHighEntropy).toBe(false); // 210 to 410
            expect(map.firstLowEntropySector).toBe(210);
        });
    });
});
