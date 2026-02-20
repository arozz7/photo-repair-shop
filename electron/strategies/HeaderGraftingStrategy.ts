import fs from 'fs';
import { IRepairStrategy, RepairInput, RepairResult } from './IRepairStrategy';
import { extractHeader, extractBitstream, parseJpegMarkers } from '../lib/jpeg/parser';
import { sanitizeInvalidMarkers } from '../lib/jpeg/sanitizer';

export class HeaderGraftingStrategy implements IRepairStrategy {
    name = 'header-grafting';
    requiresReference = true;

    async repair(input: RepairInput): Promise<RepairResult> {
        if (!input.referenceFilePath) {
            return { success: false, error: 'Reference file is required for header grafting' };
        }

        try {
            input.onProgress?.(10, 'Parsing reference file');
            if (!fs.existsSync(input.referenceFilePath)) {
                return { success: false, error: 'Reference file not found' };
            }
            const refBuffer = fs.readFileSync(input.referenceFilePath);
            const refHeader = extractHeader(refBuffer);

            if (refHeader.length === 0 || refHeader.length === refBuffer.length) {
                return { success: false, error: 'Could not extract valid header from reference file' };
            }

            input.onProgress?.(30, 'Parsing corrupted file');
            if (!fs.existsSync(input.sourceFilePath)) {
                return { success: false, error: 'Source file not found' };
            }
            const corruptBuffer = fs.readFileSync(input.sourceFilePath);
            let bitstream = extractBitstream(corruptBuffer);

            // If bitstream extraction yields empty, try treating the whole file as bitstream.
            // E.g. A completely missing header scenario.
            if (bitstream.length === 0) {
                // If it starts with SOI but has no SOS, or doesn't start with SOI at all
                const parseInfo = parseJpegMarkers(corruptBuffer);
                if (parseInfo.headerEndOffset === 0) {
                    // Let's assume the whole thing (or from index 2 if SOI) is bitstream if entropy is high
                    const startOffset = parseInfo.markers.length > 0 && parseInfo.markers[0].marker === 0xFFD8 ? 2 : 0;
                    bitstream = corruptBuffer.subarray(startOffset);
                } else {
                    return { success: false, error: 'Could not locate bitstream in corrupted file' };
                }
            }

            input.onProgress?.(60, 'Stitching header to bitstream');
            // Create combined buffer: [Ref Header] + [Corrupt Bitstream]
            const combined = Buffer.concat([refHeader, bitstream]);

            input.onProgress?.(80, 'Sanitizing markers');
            // The bitstream starts exactly after the reference header
            const sanitization = sanitizeInvalidMarkers(combined, refHeader.length);

            input.onProgress?.(95, 'Writing repaired file');
            fs.writeFileSync(input.outputFilePath, sanitization.buffer);

            return {
                success: true,
                repairedFilePath: input.outputFilePath,
                metrics: {
                    patchCount: sanitization.patchCount,
                    bytesProcessed: combined.length
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: `Grafting failed: ${err.message}`
            };
        }
    }
}
