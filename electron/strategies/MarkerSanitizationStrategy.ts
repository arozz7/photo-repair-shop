import fs from 'fs';
import { IRepairStrategy, RepairInput, RepairResult } from './IRepairStrategy';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { sanitizeInvalidMarkers } from '../lib/jpeg/sanitizer';

export class MarkerSanitizationStrategy implements IRepairStrategy {
    name = 'marker-sanitization';
    requiresReference = false;

    async repair(input: RepairInput): Promise<RepairResult> {
        try {
            input.onProgress?.(10, 'Validating source file');
            if (!fs.existsSync(input.sourceFilePath)) {
                return { success: false, error: 'Source file not found' };
            }

            const buffer = fs.readFileSync(input.sourceFilePath);

            input.onProgress?.(40, 'Locating bitstream offset');
            const parseResult = parseJpegMarkers(buffer);

            if (parseResult.bitstreamOffset === 0) {
                return { success: false, error: 'Cannot safely sanitize without a clear bitstream start offset.' };
            }

            input.onProgress?.(60, 'Sanitizing bitstream markers');
            const sanitization = sanitizeInvalidMarkers(buffer, parseResult.bitstreamOffset);

            input.onProgress?.(90, 'Writing sanitized file');
            fs.writeFileSync(input.outputFilePath, sanitization.buffer);

            return {
                success: true,
                repairedFilePath: input.outputFilePath,
                metrics: {
                    patchCount: sanitization.patchCount,
                    bytesProcessed: sanitization.buffer.length
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: `Sanitization failed: ${err.message}`
            };
        }
    }
}
