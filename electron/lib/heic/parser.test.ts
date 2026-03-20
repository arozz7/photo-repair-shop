import { describe, it, expect } from 'vitest';
import { parseHeicBoxes } from './parser';

/**
 * Builds a minimal ISOBMFF box: [4-byte size][4-byte type][data]
 */
function makeBox(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
    const size = 8 + data.length;
    const buf = Buffer.alloc(size);
    buf.writeUInt32BE(size, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    return buf;
}

describe('HEIC / ISOBMFF Box Parser', () => {
    it('should detect a valid ftyp box with heic brand', () => {
        const ftypData = Buffer.concat([
            Buffer.from('heic', 'ascii'), // major brand
            Buffer.alloc(4),              // minor version
            Buffer.from('heic', 'ascii')  // compatible brand
        ]);
        const ftyp = makeBox('ftyp', ftypData);
        const result = parseHeicBoxes(ftyp);
        expect(result.hasValidFtyp).toBe(true);
        expect(result.isHeic).toBe(true);
    });

    it('should flag missing ftyp box', () => {
        const mdat = makeBox('mdat', Buffer.from('fake image data'));
        const result = parseHeicBoxes(mdat);
        expect(result.hasValidFtyp).toBe(false);
    });

    it('should detect missing mdat box', () => {
        const ftypData = Buffer.concat([
            Buffer.from('heic', 'ascii'),
            Buffer.alloc(4),
            Buffer.from('heic', 'ascii')
        ]);
        const ftyp = makeBox('ftyp', ftypData);
        const meta = makeBox('meta', Buffer.alloc(4)); // version+flags for fullbox
        const result = parseHeicBoxes(Buffer.concat([ftyp, meta]));
        expect(result.hasMdat).toBe(false);
        expect(result.hasMeta).toBe(true);
    });

    it('should detect mdat box', () => {
        const ftypData = Buffer.concat([
            Buffer.from('heic', 'ascii'),
            Buffer.alloc(4),
            Buffer.from('heic', 'ascii')
        ]);
        const ftyp = makeBox('ftyp', ftypData);
        const mdat = makeBox('mdat', Buffer.from('hevc bitstream placeholder'));
        const result = parseHeicBoxes(Buffer.concat([ftyp, mdat]));
        expect(result.hasMdat).toBe(true);
        expect(result.mdatOffset).toBeGreaterThan(0);
        expect(result.mdatSize).toBeGreaterThan(0);
    });
});
