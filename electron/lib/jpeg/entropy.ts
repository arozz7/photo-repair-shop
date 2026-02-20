export function isHighEntropySector(sector: Buffer, threshold: number = 20): boolean {
    if (sector.length === 0) return false;

    const counts = new Array(256).fill(0);
    for (let i = 0; i < sector.length; i++) {
        counts[sector[i]]++;
    }

    for (let c = 0; c < 256; c++) {
        if (counts[c] > threshold) {
            // Byte repeats too much, low entropy
            return false;
        }
    }

    return true;
}

export interface EntropyMap {
    sectors: Array<{ offset: number; isHighEntropy: boolean }>;
    firstLowEntropySector?: number;
}

export function analyzeEntropyMap(buffer: Buffer, bitstreamOffset: number, sectorSize = 512, threshold = 20): EntropyMap {
    const map: EntropyMap = { sectors: [] };

    if (bitstreamOffset <= 0 || bitstreamOffset >= buffer.length) return map;

    for (let offset = bitstreamOffset; offset < buffer.length; offset += sectorSize) {
        const end = Math.min(offset + sectorSize, buffer.length);
        const sector = buffer.subarray(offset, end);
        const isHigh = isHighEntropySector(sector, threshold);

        map.sectors.push({ offset, isHighEntropy: isHigh });

        if (!isHigh && map.firstLowEntropySector === undefined) {
            map.firstLowEntropySector = offset;
        }
    }

    return map;
}
