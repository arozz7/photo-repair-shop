import fs from 'fs';
import { parseJpegMarkers } from '../lib/jpeg/parser.js';
import { analyzeEntropyMap } from '../lib/jpeg/entropy.js';
import { detectMcuMisalignment } from '../lib/jpeg/mcuDetector.js';
import { ExifToolService, type ExifMetadata } from '../lib/exiftool/ExifToolService.js';
import { parsePngChunks } from '../lib/png/parser.js';
import { parseHeicBoxes } from '../lib/heic/parser.js';
import { parseTiffIfds } from '../lib/tiff/parser.js';

export type CorruptionType =
    | 'missing_soi'
    | 'missing_header'
    | 'invalid_markers'
    | 'truncated'
    | 'mcu_misalignment'
    | 'metadata_corrupt'
    | 'raw_unreadable'
    | 'hollow_header'
    | 'png_missing_ihdr'
    | 'png_broken_idat'
    | 'png_crc_mismatch'
    | 'heic_missing_meta'
    | 'heic_broken_mdat'
    | 'tiff_cyclic_ifd'
    | 'tiff_invalid_offset';

export interface RepairStrategySuggestion {
    strategy: 'header-grafting' | 'preview-extraction' | 'marker-sanitization' | 'mcu-alignment' | 'png-chunk-rebuilder' | 'heic-box-recovery' | 'tiff-ifd-rebuilder';
    requiresReference: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

export interface AnalysisResult {
    jobId: string;
    filePath: string;
    fileType: 'jpeg' | 'cr2' | 'nef' | 'arw' | 'dng' | 'png' | 'heic' | 'tiff' | 'unknown';
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
        if (ext.endsWith('.png')) return 'png';
        if (ext.endsWith('.heic') || ext.endsWith('.heif')) return 'heic';
        if (ext.endsWith('.tif') || ext.endsWith('.tiff')) return 'tiff';
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

        console.log(`[FileAnalyzer] Starting metadata extraction for ${filePath}...`);
        try {
            result.metadata = await ExifToolService.getMetadata(filePath);
            console.log(`[FileAnalyzer] Metadata extracted successfully.`);
        } catch (e: any) {
            console.error(`[FileAnalyzer] Metadata extraction failed:`, e);
            throw e;
        }

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
                const mcuCheck = detectMcuMisalignment(buffer, parseResult);
                if (mcuCheck.likelyMisaligned) {
                    result.isCorrupted = true;
                    result.corruptionTypes.push('mcu_misalignment');
                    result.suggestedStrategies.push({
                        strategy: 'mcu-alignment',
                        requiresReference: true,
                        confidence: mcuCheck.confidence,
                        reason: mcuCheck.evidence.join(' ')
                    });
                }
            }
        } else if (fileType === 'png') {
            const buffer = fs.readFileSync(filePath);
            const parseResult = parsePngChunks(buffer);

            if (!parseResult.hasValidSignature) {
                result.isCorrupted = true;
            }

            if (parseResult.missingIhdr) {
                result.isCorrupted = true;
                result.corruptionTypes.push('png_missing_ihdr');
                result.suggestedStrategies.push({
                    strategy: 'png-chunk-rebuilder',
                    requiresReference: true,
                    confidence: 'high',
                    reason: 'PNG Header (IHDR) is missing. Requires a reference file to graft a healthy header.'
                });
            }

            if (parseResult.brokenIdat) {
                result.isCorrupted = true;
                result.corruptionTypes.push('png_broken_idat');
                if (!result.suggestedStrategies.some(s => s.strategy === 'png-chunk-rebuilder')) {
                    result.suggestedStrategies.push({
                        strategy: 'png-chunk-rebuilder',
                        requiresReference: false, // IDAT scavenging typically doesn't strictly need a donor unless rebuilding entirely
                        confidence: 'medium',
                        reason: 'Image data chunks are corrupt. Rebuilding blocks may recover partial image.'
                    });
                }
            }

            if (parseResult.crcMismatchCount > 0) {
                result.isCorrupted = true;
                if (!result.corruptionTypes.includes('png_crc_mismatch')) {
                    result.corruptionTypes.push('png_crc_mismatch');
                }
            }
        } else if (fileType === 'heic') {
            // HEIC files can be large; read only the first 2MB which contains all top-level boxes.
            const MAX_HEADER_READ = 2 * 1024 * 1024;
            const fd = fs.openSync(filePath, 'r');
            const header = Buffer.alloc(Math.min(MAX_HEADER_READ, result.fileSize));
            fs.readSync(fd, header, 0, header.length, 0);
            fs.closeSync(fd);

            const parseResult = parseHeicBoxes(header);

            if (!parseResult.hasValidFtyp || !parseResult.isHeic) {
                result.isCorrupted = true;
                result.corruptionTypes.push('heic_missing_meta');
            }

            if (!parseResult.hasMeta) {
                result.isCorrupted = true;
                if (!result.corruptionTypes.includes('heic_missing_meta')) {
                    result.corruptionTypes.push('heic_missing_meta');
                }
            }

            if (!parseResult.hasMdat) {
                result.isCorrupted = true;
                result.corruptionTypes.push('heic_broken_mdat');
            }

            if (result.isCorrupted) {
                result.suggestedStrategies.push({
                    strategy: 'heic-box-recovery',
                    requiresReference: true,
                    confidence: parseResult.hasMdat ? 'high' : 'medium',
                    reason: parseResult.hasMdat
                        ? 'HEIC metadata container is damaged. Will transplant your image payload into a reference shell.'
                        : 'HEIC image payload (mdat) is missing or unreadable. A reference donor from the same device is required.'
                });
            }
        } else if (fileType === 'tiff' || fileType === 'cr2' || fileType === 'nef' || fileType === 'arw' || fileType === 'dng') {
            // For TIFF-based files (includes most RAW formats), we parse the IFD chain.
            // Read only the first 1MB which is sufficient to find all IFD directories.
            const MAX_TIFF_HEADER = 1 * 1024 * 1024;
            const fd = fs.openSync(filePath, 'r');
            const header = Buffer.alloc(Math.min(MAX_TIFF_HEADER, result.fileSize));
            fs.readSync(fd, header, 0, header.length, 0);
            fs.closeSync(fd);

            const parseResult = parseTiffIfds(header);

            if (!parseResult.hasValidSignature) {
                result.isCorrupted = true;
                result.corruptionTypes.push('raw_unreadable');
            }

            if (parseResult.hasInvalidOffsets) {
                result.isCorrupted = true;
                result.corruptionTypes.push('tiff_invalid_offset');
            }

            if (parseResult.hasCyclicIfd) {
                result.isCorrupted = true;
                result.corruptionTypes.push('tiff_cyclic_ifd');
            }

            // Always offer preview extraction for RAW as a fast fallback
            result.embeddedPreviewAvailable = true;
            result.suggestedStrategies.push({
                strategy: 'preview-extraction',
                requiresReference: false,
                confidence: 'medium',
                reason: 'Extracts embedded JPEG preview from the RAW container as a fast, donor-free option.'
            });

            // Offer full IFD rebuild if structure is broken
            if (result.isCorrupted) {
                result.suggestedStrategies.push({
                    strategy: 'tiff-ifd-rebuilder',
                    requiresReference: true,
                    confidence: parseResult.hasCyclicIfd ? 'medium' : 'high',
                    reason: parseResult.hasCyclicIfd
                        ? 'IFD pointer chain is cyclic. A reference RAW from the same camera will be used to rebuild the directory.'
                        : 'IFD offset pointers are broken. Transplanting a healthy IFD from a reference file will restore decode-ability.'
                });
            }
        } else if (fileType !== 'unknown') {
            result.embeddedPreviewAvailable = true;
            if (result.isCorrupted) {
                result.suggestedStrategies.push({
                    strategy: 'preview-extraction',
                    requiresReference: false,
                    confidence: 'high',
                    reason: 'RAW file is unreadable. Will attempt to extract embedded JPEG preview.'
                });
            } else {
                result.suggestedStrategies.push({
                    strategy: 'preview-extraction',
                    requiresReference: false,
                    confidence: 'medium',
                    reason: 'RAW structure appears intact. You can manually extract the embedded JPEG preview.'
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

        // Hollow File Detection
        if (fileSize < 50 * 1024 && result.metadata?.resolution) {
            const [widthStr, heightStr] = result.metadata.resolution.split('x');
            const width = parseInt(widthStr, 10);
            const height = parseInt(heightStr, 10);
            if (!isNaN(width) && !isNaN(height)) {
                const megapixels = (width * height) / 1000000;
                if (megapixels > 1.0) {
                    result.isCorrupted = true;
                    if (!result.corruptionTypes.includes('hollow_header')) {
                        result.corruptionTypes.push('hollow_header');
                    }

                    const existingStrategy = result.suggestedStrategies.find(s => s.strategy === 'header-grafting');
                    if (existingStrategy) {
                        existingStrategy.confidence = 'high';
                        existingStrategy.reason = 'Hollow File detected: File size is too small for its reported resolution. The high-res bitstream is missing or overwritten by a thumbnail.';
                    } else {
                        result.suggestedStrategies.push({
                            strategy: 'header-grafting',
                            requiresReference: true,
                            confidence: 'high',
                            reason: 'Hollow File detected: File size is too small for its reported resolution. The high-res bitstream is missing or overwritten by a thumbnail.'
                        });
                    }
                }
            }
        }

        console.log(`[FileAnalyzer] Analysis complete. IsCorrupted: ${result.isCorrupted}`);
        return result;
    }
}
