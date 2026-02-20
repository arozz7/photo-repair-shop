import fs from 'fs';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { analyzeEntropyMap } from '../lib/jpeg/entropy';
import { ExifToolService, ExifMetadata } from '../lib/exiftool/ExifToolService';

export type CorruptionType =
    | 'missing_soi'
    | 'missing_header'
    | 'invalid_markers'
    | 'truncated'
    | 'mcu_misalignment'
    | 'metadata_corrupt'
    | 'raw_unreadable';

export interface RepairStrategySuggestion {
    strategy: 'header-grafting' | 'preview-extraction' | 'marker-sanitization';
    requiresReference: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

export interface AnalysisResult {
    jobId: string;
    filePath: string;
    fileType: 'jpeg' | 'cr2' | 'nef' | 'arw' | 'dng' | 'unknown';
    fileSize: number;
    isCorrupted: boolean;
    corruptionTypes: CorruptionType[];
    suggestedStrategies: RepairStrategySuggestion[];
    metadata: ExifMetadata | null;
    embeddedPreviewAvailable: boolean;
    entropyMap?: any;
}

export class FileAnalyzer {
    static getFileType(filePath: string): AnalysisResult['fileType'] {
        const ext = filePath.toLowerCase();
        if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.jfif')) return 'jpeg';
        if (ext.endsWith('.cr2') || ext.endsWith('.cr3')) return 'cr2';
        if (ext.endsWith('.nef')) return 'nef';
        if (ext.endsWith('.arw')) return 'arw';
        if (ext.endsWith('.dng')) return 'dng';
        return 'unknown';
    }

    static async analyze(jobId: string, filePath: string): Promise<AnalysisResult> {
        const stats = fs.statSync(filePath, { throwIfNoEntry: false });
        const fileSize = stats ? stats.size : 0;
        const fileType = this.getFileType(filePath);

        const result: AnalysisResult = {
            jobId, filePath, fileType, fileSize,
            isCorrupted: false,
            corruptionTypes: [],
            suggestedStrategies: [],
            metadata: null,
            embeddedPreviewAvailable: false
        };

        if (fileSize === 0) return result;

        result.metadata = await ExifToolService.getMetadata(filePath);

        if (result.metadata?.errors && result.metadata.errors.length > 0) {
            result.isCorrupted = true;
            if (fileType === 'jpeg') {
                result.corruptionTypes.push('metadata_corrupt');
            } else {
                result.corruptionTypes.push('raw_unreadable');
            }
        }

        if (fileType === 'jpeg') {
            const buffer = fs.readFileSync(filePath);
            const parseResult = parseJpegMarkers(buffer);

            if (!parseResult.isValid) {
                result.isCorrupted = true;
                result.corruptionTypes.push('missing_soi');
            }

            if (parseResult.invalidMarkers.length > 0) {
                result.isCorrupted = true;
                result.corruptionTypes.push('invalid_markers');
                result.suggestedStrategies.push({
                    strategy: 'marker-sanitization',
                    requiresReference: false,
                    confidence: 'high',
                    reason: 'Invalid FF markers detected in bitstream.'
                });
            }

            if (!parseResult.hasEoiMarker) {
                result.isCorrupted = true;
                result.corruptionTypes.push('truncated');
            }

            if (parseResult.headerEndOffset === 0) {
                result.isCorrupted = true;
                result.corruptionTypes.push('missing_header');
                result.suggestedStrategies.push({
                    strategy: 'header-grafting',
                    requiresReference: true,
                    confidence: 'high',
                    reason: 'No SOS marker found. Header is completely missing or destroyed.'
                });
            }

            if (parseResult.bitstreamOffset > 0) {
                result.entropyMap = analyzeEntropyMap(buffer, parseResult.bitstreamOffset);
            }
        } else if (fileType !== 'unknown') {
            if (result.isCorrupted) {
                result.embeddedPreviewAvailable = true;
                result.suggestedStrategies.push({
                    strategy: 'preview-extraction',
                    requiresReference: false,
                    confidence: 'high',
                    reason: 'RAW file is unreadable. Will attempt to extract embedded JPEG preview.'
                });
            }
        }

        if (result.isCorrupted && fileType === 'jpeg' && !result.suggestedStrategies.some(s => s.strategy === 'header-grafting')) {
            result.suggestedStrategies.push({
                strategy: 'header-grafting',
                requiresReference: true,
                confidence: 'medium',
                reason: 'General JPEG corruption; grafting a healthy header may resolve rendering issues.'
            });
        }

        return result;
    }
}
