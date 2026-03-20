import { describe, it, expect } from 'vitest';
import { parsePngChunks } from './parser';

function createChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    
    // Calculate CRC (mocked for simplicity in test creation, let's just use the actual function or a dummy)
    // Actually, to test CRC mismatch, we can just put a dummy CRC. 
    // Wait, the parser checks CRC. I need to make sure the test has valid CRC if I want validCrc=true.
    // For now, let's test a known valid PNG chunk pattern or just let CRC fail and expect crcMismatchCount > 0.
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(0xBADC0DE, 0); // Invalid CRC
    return Buffer.concat([length, typeBuf, data, crc]);
}

describe('PNG Parser', () => {
    it('should detect valid PNG signatures', () => {
        const validSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const result = parsePngChunks(validSignature);
        expect(result.hasValidSignature).toBe(true);
    });

    it('should identify missing IHDR chunk', () => {
        const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const chunk = createChunk('IDAT', Buffer.from([0x01, 0x02]));
        const buf = Buffer.concat([sig, chunk]);
        const result = parsePngChunks(buf);
        expect(result.missingIhdr).toBe(true);
        expect(result.missingIend).toBe(true);
        expect(result.crcMismatchCount).toBe(1); // Because BADC0DE
        expect(result.chunks.length).toBe(1);
    });

    it('should find IHDR and IEND chunks', () => {
        const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const ihdr = createChunk('IHDR', Buffer.alloc(13));
        const iend = createChunk('IEND', Buffer.alloc(0));
        const buf = Buffer.concat([sig, ihdr, iend]);
        const result = parsePngChunks(buf);
        expect(result.missingIhdr).toBe(false);
        expect(result.missingIend).toBe(false);
        expect(result.chunks[0].type).toBe('IHDR');
        expect(result.chunks[1].type).toBe('IEND');
    });
});
