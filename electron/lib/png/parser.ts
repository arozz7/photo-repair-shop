import { crc32 } from 'zlib'; // Node's zlib actually doesn't have crc32 directly exposed in a simple way for buffers natively, I'll use a custom one or just check if zlib exports it. Wait, npm has `buffer-crc32` or similar, but let me just implement a quick CRC32 table or skip strict CRC if not available, OR check if the app has a CRC lib. Let's just write a small CRC32 function.

function calculateCrc32(buffer: Buffer): number {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[i] = c;
}

export interface PngParseResult {
    hasValidSignature: boolean;
    missingIhdr: boolean;
    missingIend: boolean;
    brokenIdat: boolean;
    crcMismatchCount: number;
    chunks: Array<{
        type: string;
        length: number;
        offset: number;
        validCrc: boolean;
    }>;
}

export function parsePngChunks(buffer: Buffer): PngParseResult {
    const result: PngParseResult = {
        hasValidSignature: false,
        missingIhdr: true,
        missingIend: true,
        brokenIdat: false,
        crcMismatchCount: 0,
        chunks: []
    };

    if (buffer.length < 8) return result;

    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    result.hasValidSignature = buffer.subarray(0, 8).equals(signature);

    if (!result.hasValidSignature) {
        // We might still try to parse if it's forced, but usually we'd abort or assume missing header
    }

    let offset = 8;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        
        if (offset + 12 + length > buffer.length) {
            // Truncated chunk
            if (type === 'IDAT') result.brokenIdat = true;
            break;
        }

        const chunkDataObj = buffer.subarray(offset + 4, offset + 8 + length);
        const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
        const calculatedCrc = calculateCrc32(chunkDataObj);
        
        const validCrc = expectedCrc === calculatedCrc;
        if (!validCrc) {
            result.crcMismatchCount++;
            if (type === 'IDAT') result.brokenIdat = true;
        }

        result.chunks.push({
            type,
            length,
            offset,
            validCrc
        });

        if (type === 'IHDR') result.missingIhdr = false;
        if (type === 'IEND') result.missingIend = false;

        offset += 12 + length;
    }

    return result;
}
