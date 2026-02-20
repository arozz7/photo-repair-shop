import { JpegParseResult } from './parser';
import { analyzeEntropyMap } from './entropy';

export interface McuDetectionResult {
    likelyMisaligned: boolean;
    confidence: 'high' | 'low';
    evidence: string[];
}

export function detectMcuMisalignment(buffer: Buffer, parseResult: JpegParseResult): McuDetectionResult {
    const evidence: string[] = [];
    let likelyMisaligned = false;
    let confidence: 'high' | 'low' = 'low';

    if (!parseResult.isValid || parseResult.bitstreamOffset === 0) {
        return { likelyMisaligned: false, confidence: 'low', evidence: ['Cannot detect MCU misalignment without a valid bitstream header'] };
    }

    // 1. Check Restart Marker Sequences (RST0..RST7)
    const rstMarkers = parseResult.markers.filter(m => m.marker >= 0xFFD0 && m.marker <= 0xFFD7);
    let outOfSequence = false;

    if (rstMarkers.length > 0) {
        let expectedNav = 0; // Starts at D0
        for (const m of rstMarkers) {
            const currentNav = m.marker - 0xFFD0;
            if (currentNav !== expectedNav) {
                outOfSequence = true;
                break;
            }
            expectedNav = (expectedNav + 1) % 8; // Loops back to D0 after D7
        }

        if (outOfSequence) {
            evidence.push('Restart markers (RSTm) are out of chronological sequence.');
            likelyMisaligned = true;
            confidence = 'high';
        }
    }

    // 2. Check early entropy drop
    const entropyInfo = analyzeEntropyMap(buffer, parseResult.bitstreamOffset);
    if (entropyInfo.firstLowEntropySector !== undefined) {
        // If the entropy drops significantly *before* the EOI marker, we may have a desync
        // We roughly check if the drop happens before the last 5% of the file
        const fileLength = buffer.length;
        const thresholdOffset = fileLength * 0.95;

        if (entropyInfo.firstLowEntropySector < thresholdOffset && !parseResult.hasEoiMarker) {
            evidence.push(`Significant entropy drop detected early at offset ${entropyInfo.firstLowEntropySector}.`);
            likelyMisaligned = true;
            // If we already detected out-of-sequence markers, confidence remains high. Else, it's a 'low' heuristic.
        }
    }

    // 3. Known Invalid Markers inside bitstream (often caused by MCU shifting)
    if (parseResult.invalidMarkers.length > 0) {
        evidence.push(`${parseResult.invalidMarkers.length} invalid bitstream markers detected.`);
        likelyMisaligned = true;
    }

    return { likelyMisaligned, confidence, evidence };
}
