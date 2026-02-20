import fs from 'fs';
import { IRepairStrategy, RepairInput, RepairResult } from './IRepairStrategy';
import { ExifToolService } from '../lib/exiftool/ExifToolService';

export class PreviewExtractionStrategy implements IRepairStrategy {
    name = 'preview-extraction';
    requiresReference = false;

    async repair(input: RepairInput): Promise<RepairResult> {
        try {
            input.onProgress?.(10, 'Validating source file');
            if (!fs.existsSync(input.sourceFilePath)) {
                return { success: false, error: 'Source file not found' };
            }

            input.onProgress?.(40, 'Extracting highest quality embedded JPEG');
            const success = await ExifToolService.extractPreview(
                input.sourceFilePath,
                input.outputFilePath
            );

            if (!success) {
                return { success: false, error: 'Failed to extract an embedded preview from the file.' };
            }

            input.onProgress?.(90, 'Verifying extraction output');
            if (!fs.existsSync(input.outputFilePath)) {
                return { success: false, error: 'Extraction tool didn\'t produce an output file.' };
            }

            return {
                success: true,
                repairedFilePath: input.outputFilePath,
                metrics: {}
            };
        } catch (err: any) {
            return {
                success: false,
                error: `Extraction failed: ${err.message}`
            };
        }
    }
}
