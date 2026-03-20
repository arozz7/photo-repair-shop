export interface HeicParseResult {
    hasValidFtyp: boolean;
    isHeic: boolean;
    hasMeta: boolean;
    hasMdat: boolean;
    mdatOffset: number;
    mdatSize: number;
    missingBoxes: string[];
    boxes: Array<{
        type: string;
        size: number;
        offset: number;
    }>;
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);

export function parseHeicBoxes(buffer: Buffer): HeicParseResult {
    const result: HeicParseResult = {
        hasValidFtyp: false,
        isHeic: false,
        hasMeta: false,
        hasMdat: false,
        mdatOffset: 0,
        mdatSize: 0,
        missingBoxes: [],
        boxes: []
    };

    if (buffer.length < 8) return result;

    let offset = 0;

    while (offset + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(offset);

        // Sanity check: box size must be >= 8 and fit within the remaining buffer
        if (size < 8 || offset + size > buffer.length) break;

        const type = buffer.toString('ascii', offset + 4, offset + 8);

        result.boxes.push({ type, size, offset });

        if (type === 'ftyp') {
            // ftyp layout: [major_brand(4)][minor_version(4)][compatible_brands(4 each)...]
            if (size >= 16) {
                const majorBrand = buffer.toString('ascii', offset + 8, offset + 12).trim();
                result.hasValidFtyp = true;
                result.isHeic = HEIC_BRANDS.has(majorBrand);

                // Also scan compatible brands
                if (!result.isHeic) {
                    for (let brandOffset = offset + 16; brandOffset + 4 <= offset + size; brandOffset += 4) {
                        const compatBrand = buffer.toString('ascii', brandOffset, brandOffset + 4).trim();
                        if (HEIC_BRANDS.has(compatBrand)) {
                            result.isHeic = true;
                            break;
                        }
                    }
                }
            }
        } else if (type === 'meta') {
            result.hasMeta = true;
        } else if (type === 'mdat') {
            result.hasMdat = true;
            result.mdatOffset = offset + 8; // payload starts after the 8-byte header
            result.mdatSize = size - 8;
        }

        offset += size;
    }

    if (!result.hasValidFtyp) result.missingBoxes.push('ftyp');
    if (!result.hasMeta) result.missingBoxes.push('meta');
    if (!result.hasMdat) result.missingBoxes.push('mdat');

    return result;
}
