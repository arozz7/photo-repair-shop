import { describe, it, expect } from 'vitest';
import { parseTiffIfds } from './parser';

/**
 * Builds a minimal little-endian TIFF header.
 * TIFF structure:
 *   [II or MM] (2 bytes) byte order
 *   [42] (2 bytes) magic
 *   [offset to first IFD] (4 bytes)
 */
function makeTiffHeader(byteOrder: 'LE' | 'BE', ifdOffset: number): Buffer {
    const buf = Buffer.alloc(8);
    if (byteOrder === 'LE') {
        buf.write('II', 0, 'ascii');
        buf.writeUInt16LE(42, 2);
        buf.writeUInt32LE(ifdOffset, 4);
    } else {
        buf.write('MM', 0, 'ascii');
        buf.writeUInt16BE(42, 2);
        buf.writeUInt32BE(ifdOffset, 4);
    }
    return buf;
}

/**
 * Builds a minimal TIFF IFD at the given offset.
 * IFD: [count(2)][entries...][next IFD offset(4)]
 * Each entry: [tag(2)][type(2)][count(4)][value_offset(4)] = 12 bytes
 */
function makeTiffIfd(entries: Array<{ tag: number; type: number; count: number; value: number }>, nextIfd = 0): Buffer {
    const entryBuf = Buffer.alloc(2 + entries.length * 12 + 4);
    entryBuf.writeUInt16LE(entries.length, 0);
    entries.forEach((e, i) => {
        const base = 2 + i * 12;
        entryBuf.writeUInt16LE(e.tag, base);
        entryBuf.writeUInt16LE(e.type, base + 2);
        entryBuf.writeUInt32LE(e.count, base + 4);
        entryBuf.writeUInt32LE(e.value, base + 8);
    });
    entryBuf.writeUInt32LE(nextIfd, entryBuf.length - 4);
    return entryBuf;
}

describe('TIFF / RAW IFD Parser', () => {
    it('should detect valid little-endian TIFF signature', () => {
        const header = makeTiffHeader('LE', 8);
        const ifd = makeTiffIfd([{ tag: 0x0100, type: 3, count: 1, value: 1920 }]);
        const result = parseTiffIfds(Buffer.concat([header, ifd]));
        expect(result.hasValidSignature).toBe(true);
        expect(result.byteOrder).toBe('LE');
    });

    it('should detect valid big-endian TIFF signature', () => {
        const header = makeTiffHeader('BE', 8);
        const ifd = makeTiffIfd([]);
        const result = parseTiffIfds(Buffer.concat([header, ifd]));
        expect(result.hasValidSignature).toBe(true);
        expect(result.byteOrder).toBe('BE');
    });

    it('should detect invalid TIFF signature', () => {
        const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = parseTiffIfds(buf);
        expect(result.hasValidSignature).toBe(false);
    });

    it('should detect IFD offset pointing outside file bounds', () => {
        const header = makeTiffHeader('LE', 99999); // way outside file
        const result = parseTiffIfds(header);
        expect(result.hasValidSignature).toBe(true);
        expect(result.hasInvalidOffsets).toBe(true);
    });

    it('should walk a valid IFD and find entries', () => {
        const ifd = makeTiffIfd([
            { tag: 0x0100, type: 3, count: 1, value: 1920 }, // ImageWidth
            { tag: 0x0101, type: 3, count: 1, value: 1080 }  // ImageLength
        ]);
        const header = makeTiffHeader('LE', 8);
        const result = parseTiffIfds(Buffer.concat([header, ifd]));
        expect(result.ifds.length).toBeGreaterThan(0);
        expect(result.ifds[0].entryCount).toBe(2);
    });
});
