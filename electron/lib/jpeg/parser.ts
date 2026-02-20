import { JPEG_MARKERS } from './markers';

export interface MarkerInfo {
    offset: number;
    marker: number;
    length?: number;
}

export interface InvalidMarkerInfo {
    offset: number;
    marker: number;
}

export interface ParseError {
    offset: number;
    message: string;
}

export interface JpegParseResult {
    isValid: boolean;
    markers: MarkerInfo[];
    headerEndOffset: number;
    bitstreamOffset: number;
    hasEoiMarker: boolean;
    invalidMarkers: InvalidMarkerInfo[];
    errors: ParseError[];
    embeddedThumbnailRange?: { start: number; end: number };
}

export function parseJpegMarkers(buffer: Buffer): JpegParseResult {
    const result: JpegParseResult = {
        isValid: false,
        markers: [],
        headerEndOffset: 0,
        bitstreamOffset: 0,
        hasEoiMarker: false,
        invalidMarkers: [],
        errors: []
    };

    if (buffer.length < 2 || buffer.readUInt16BE(0) !== JPEG_MARKERS.SOI) {
        result.errors.push({ offset: 0, message: 'Missing SOI marker' });
        return result;
    }

    result.isValid = true;
    result.markers.push({ offset: 0, marker: JPEG_MARKERS.SOI });

    let offset = 2;
    let lastSosOffset = 0;

    while (offset < buffer.length - 1) {
        if (buffer[offset] === 0xFF) {
            if (buffer[offset + 1] === 0xFF) {
                offset++;
                continue;
            }

            if (buffer[offset + 1] === 0x00) {
                // Bitstream stuffed byte, not a marker
                offset += 2;
                continue;
            }

            const marker = buffer.readUInt16BE(offset);

            if (marker === JPEG_MARKERS.EOI) {
                result.hasEoiMarker = true;
                result.markers.push({ offset, marker });
                break;
            }

            if (marker === JPEG_MARKERS.SOS) {
                lastSosOffset = offset;
                const length = buffer.readUInt16BE(offset + 2);
                result.markers.push({ offset, marker, length });
                offset += length + 2; // Jump over SOS header to start of bitstream

                // Don't break, keep looking for the *last* SOS (in case of thumbnails)
                continue;
            }

            // Other markers that have a length
            if ((marker >= 0xFFC0 && marker <= 0xFFFE) && marker !== JPEG_MARKERS.EOI) {
                if (offset + 3 < buffer.length) {
                    const length = buffer.readUInt16BE(offset + 2);
                    result.markers.push({ offset, marker, length });
                    offset += length + 2;
                } else {
                    result.errors.push({ offset, message: 'Truncated marker length' });
                    break;
                }
            } else {
                // If we are past the last observed SOS, this might be an invalid bitstream marker
                if (lastSosOffset > 0) {
                    result.invalidMarkers.push({ offset, marker });
                } else {
                    result.markers.push({ offset, marker });
                }
                offset += 2;
            }
        } else {
            offset++;
        }
    }

    if (lastSosOffset > 0) {
        const sosMarker = result.markers.find(m => m.offset === lastSosOffset);
        if (sosMarker && sosMarker.length) {
            result.headerEndOffset = lastSosOffset;
            result.bitstreamOffset = lastSosOffset + 2 + sosMarker.length;
        }
    }

    return result;
}

export function findLastSosOffset(buffer: Buffer): number {
    const result = parseJpegMarkers(buffer);
    return result.headerEndOffset;
}

export function extractHeader(buffer: Buffer): Buffer {
    const lastSosOffset = findLastSosOffset(buffer);
    if (lastSosOffset > 0) {
        // include the SOS marker header itself, but stop right before the bitstream
        const sosLengthIndex = lastSosOffset + 2;
        if (sosLengthIndex + 1 < buffer.length) {
            const length = buffer.readUInt16BE(sosLengthIndex);
            return buffer.subarray(0, lastSosOffset + 2 + length);
        }
    }
    return buffer; // Fallback
}

export function extractBitstream(buffer: Buffer): Buffer {
    const parseResult = parseJpegMarkers(buffer);
    if (parseResult.bitstreamOffset > 0) {
        return buffer.subarray(parseResult.bitstreamOffset);
    }
    return buffer.subarray(0, 0); // empty
}
