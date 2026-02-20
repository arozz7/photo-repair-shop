import { VALID_BITSTREAM_FOLLOWERS } from './markers';

export interface SanitizationResult {
    buffer: Buffer;
    patchCount: number;
    patches: Array<{ offset: number; original: number; replacement: number }>;
}

export function sanitizeInvalidMarkers(buffer: Buffer, bitstreamOffset: number): SanitizationResult {
    const result: SanitizationResult = {
        buffer: Buffer.from(buffer),
        patchCount: 0,
        patches: []
    };

    if (bitstreamOffset <= 0 || bitstreamOffset >= buffer.length) {
        return result;
    }

    let i = bitstreamOffset;

    while (i < result.buffer.length - 1) {
        if (result.buffer[i] === 0xFF) {
            const nextByte = result.buffer[i + 1];

            if (!VALID_BITSTREAM_FOLLOWERS.has(nextByte)) {
                // Invalid marker! Patch it.
                result.patches.push({ offset: i, original: nextByte, replacement: 0x00 });
                result.buffer[i + 1] = 0x00;
                result.patchCount++;
                i += 2; // Jump over the patched sequence
            } else {
                i += 1;
                if (nextByte === 0x00 || nextByte === 0xD9 || (nextByte >= 0xD0 && nextByte <= 0xD7)) {
                    i += 1; // skip the next byte 
                }
            }
        } else {
            i++;
        }
    }

    return result;
}
