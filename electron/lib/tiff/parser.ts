export type TiffByteOrder = 'LE' | 'BE' | 'unknown';

export interface TiffIfdEntry {
    tag: number;
    type: number;
    count: number;
    valueOrOffset: number;
}

export interface TiffIfd {
    offset: number;
    entryCount: number;
    entries: TiffIfdEntry[];
    nextIfdOffset: number;
}

export interface TiffParseResult {
    hasValidSignature: boolean;
    byteOrder: TiffByteOrder;
    firstIfdOffset: number;
    hasInvalidOffsets: boolean;
    hasCyclicIfd: boolean;
    ifds: TiffIfd[];
    suspiciousOffsets: number[];
}

export function parseTiffIfds(buffer: Buffer): TiffParseResult {
    const result: TiffParseResult = {
        hasValidSignature: false,
        byteOrder: 'unknown',
        firstIfdOffset: 0,
        hasInvalidOffsets: false,
        hasCyclicIfd: false,
        ifds: [],
        suspiciousOffsets: []
    };

    if (buffer.length < 8) return result;

    // Detect byte order from magic bytes
    const orderMark = buffer.toString('ascii', 0, 2);
    if (orderMark === 'II') {
        result.byteOrder = 'LE';
    } else if (orderMark === 'MM') {
        result.byteOrder = 'BE';
    } else {
        return result; // Not a TIFF
    }

    const readU16 = (offset: number) =>
        result.byteOrder === 'LE' ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
    const readU32 = (offset: number) =>
        result.byteOrder === 'LE' ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);

    // Validate magic number (42 for TIFF, 43 for BigTIFF)
    const magic = readU16(2);
    if (magic !== 42 && magic !== 43) return result;

    result.hasValidSignature = true;
    result.firstIfdOffset = readU32(4);

    // Guard: does the first IFD offset actually fit in the file?
    if (result.firstIfdOffset + 2 > buffer.length) {
        result.hasInvalidOffsets = true;
        return result;
    }

    // Walk IFD chain. Track visited offsets to detect cycles.
    const visitedOffsets = new Set<number>();
    let nextOffset = result.firstIfdOffset;
    const MAX_IFD_DEPTH = 32;
    let depth = 0;

    while (nextOffset !== 0 && depth < MAX_IFD_DEPTH) {
        if (visitedOffsets.has(nextOffset)) {
            result.hasCyclicIfd = true;
            break;
        }
        if (nextOffset + 2 > buffer.length) {
            result.hasInvalidOffsets = true;
            break;
        }

        visitedOffsets.add(nextOffset);

        const entryCount = readU16(nextOffset);
        const ifd: TiffIfd = {
            offset: nextOffset,
            entryCount,
            entries: [],
            nextIfdOffset: 0
        };

        const entriesEndOffset = nextOffset + 2 + entryCount * 12;
        if (entriesEndOffset + 4 > buffer.length) {
            result.hasInvalidOffsets = true;
            break;
        }

        for (let i = 0; i < entryCount; i++) {
            const base = nextOffset + 2 + i * 12;
            const tag = readU16(base);
            const type = readU16(base + 2);
            const count = readU32(base + 4);
            const valueOrOffset = readU32(base + 8);

            // If the value is an offset (type + count > 4 bytes), validate it
            const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] ?? 1;
            const totalSize = typeSize * count;
            if (totalSize > 4 && valueOrOffset + totalSize > buffer.length) {
                result.suspiciousOffsets.push(valueOrOffset);
                result.hasInvalidOffsets = true;
            }

            ifd.entries.push({ tag, type, count, valueOrOffset });
        }

        ifd.nextIfdOffset = readU32(entriesEndOffset);
        result.ifds.push(ifd);

        nextOffset = ifd.nextIfdOffset;
        depth++;
    }

    return result;
}
