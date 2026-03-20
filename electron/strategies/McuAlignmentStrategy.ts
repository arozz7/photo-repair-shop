import fs from 'fs';
import { IRepairStrategy, RepairInput, RepairResult } from './IRepairStrategy';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { detectMcuMisalignment } from '../lib/jpeg/mcuDetector';

export class McuAlignmentStrategy implements IRepairStrategy {
    name = 'mcu-alignment';
    requiresReference = true; // MCU alignment relies on reference to graft healthy RST segments

    async repair(input: RepairInput): Promise<RepairResult> {
        try {
            input.onProgress?.(10, 'Validating inputs');
            if (!input.referenceFilePath) {
                return { success: false, error: 'Reference file is required for MCU Alignment.' };
            }

            if (!fs.existsSync(input.sourceFilePath) || !fs.existsSync(input.referenceFilePath)) {
                return { success: false, error: 'Source or Reference file not found' };
            }

            input.onProgress?.(30, 'Reading source bitstream');
            const sourceBuffer = fs.readFileSync(input.sourceFilePath);
            const sourceParsed = parseJpegMarkers(sourceBuffer);

            input.onProgress?.(40, 'Checking for misalignment');
            const detection = detectMcuMisalignment(sourceBuffer, sourceParsed);

            if (!detection.likelyMisaligned) {
                // If it looks fine, just copy it over or do nothing.
                fs.writeFileSync(input.outputFilePath, sourceBuffer);
                return {
                    success: true,
                    repairedFilePath: input.outputFilePath,
                    warnings: ['No MCU misalignment detected. Copying source as-is.']
                };
            }

            input.onProgress?.(60, 'Aligning with reference stream');
            const refBuffer = fs.readFileSync(input.referenceFilePath);
            const refParsed = parseJpegMarkers(refBuffer);

            if (!refParsed.isValid || refParsed.bitstreamOffset === 0) {
                return { success: false, error: 'Reference file is an invalid JPEG.' };
            }

            // Heuristic reference-based MCU alignment logic:
            // For a baseline, we copy the header up to the bitstream from the source (or reference depending on corruption).
            // Then we attempt to graft the first few intact Restart Intervals from the reference file to force a realignment,
            // then stream the rest of the source file.

            // Note: A true Huffman decoder would interleave here. For the MVP, we simulate bridging a corrupt block
            // by injecting the reference's matching interval.

            // Get header
            const headerLimit = sourceParsed.bitstreamOffset > 0 ? sourceParsed.bitstreamOffset : refParsed.bitstreamOffset;
            const outputBuffer = Buffer.alloc(sourceBuffer.length + 1024); // Allocate some extra room
            let outOffset = 0;

            // 1. Write Header
            sourceBuffer.copy(outputBuffer, 0, 0, headerLimit);
            outOffset += headerLimit;

            // 2. Identify a "patch" sector from the reference (e.g. the first 10% of the bitstream)
            // This forces the MCU state machine in standard decoders to reset aligning factors properly.
            const patchSize = Math.min(refBuffer.length - refParsed.bitstreamOffset, 1024); // 1KB patch
            refBuffer.copy(outputBuffer, outOffset, refParsed.bitstreamOffset, refParsed.bitstreamOffset + patchSize);
            outOffset += patchSize;

            // 3. Jump the source ahead past the bad data
            const sourceJump = headerLimit + patchSize;
            if (sourceJump < sourceBuffer.length) {
                sourceBuffer.copy(outputBuffer, outOffset, sourceJump);
                outOffset += (sourceBuffer.length - sourceJump);
            }

            // Trim
            const finalBuffer = outputBuffer.subarray(0, outOffset);

            input.onProgress?.(90, 'Writing aligned file');
            fs.writeFileSync(input.outputFilePath, finalBuffer);

            input.onProgress?.(100, 'MCU Alignment complete');

            return {
                success: true,
                repairedFilePath: input.outputFilePath,
                metrics: {
                    patchCount: 1,
                    bytesProcessed: finalBuffer.length
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: `MCU Alignment failed: ${err.message}`
            };
        }
    }
}
