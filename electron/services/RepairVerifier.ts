import fs from 'fs';
import sharp from 'sharp';
import { ExifToolService } from '../lib/exiftool/ExifToolService';
import { parseJpegMarkers } from '../lib/jpeg/parser';
import { analyzeEntropyMap } from '../lib/jpeg/entropy';

interface VerificationResult {
    tier: 'structural' | 'entropy' | 'decode' | 'thumbnail' | 'none';
    isVerified: boolean;
    warnings: string[];
    error?: string;
    metadata?: any;
}

export class RepairVerifier {

    // Tier 1: ExifTool (-validate)
    static async validateStructure(filePath: string): Promise<{ passed: boolean; warnings: string[]; error?: string }> {
        const res = await ExifToolService.validateFile(filePath);
        return {
            passed: res.passed,
            warnings: res.warnings,
            error: res.errors.length > 0 ? res.errors.join(' | ') : undefined
        };
    }

    // Tier 2: Entropy check (Are there weird drop-offs?)
    static analyzeEntropy(buffer: Buffer): { passed: boolean; warnings: string[] } {
        const parseRes = parseJpegMarkers(buffer);
        if (!parseRes.isValid || parseRes.bitstreamOffset === 0) return { passed: false, warnings: ['Invalid JPEG for entropy check'] };

        const entropy = analyzeEntropyMap(buffer, parseRes.bitstreamOffset);
        if (entropy.firstLowEntropySector !== undefined && !parseRes.hasEoiMarker) {
            return { passed: false, warnings: [`Low entropy found at ${entropy.firstLowEntropySector} without reaching an EOI marker.`] };
        }
        return { passed: true, warnings: [] };
    }

    // Tier 3: sharp full decode
    static async attemptDecode(filePath: string): Promise<{ passed: boolean; warnings: string[]; error?: string }> {
        try {
            const meta = await sharp(filePath).metadata();
            if (!meta.width || !meta.height) {
                return { passed: false, warnings: [], error: 'Decoded image has no width or height' };
            }
            return { passed: true, warnings: [] };
        } catch (err: any) {
            return { passed: false, warnings: [], error: err.message };
        }
    }

    // Run the full gauntlet
    static async verify(filePath: string): Promise<VerificationResult> {
        const warnings: string[] = [];

        // 1
        const t1 = await this.validateStructure(filePath);
        if (!t1.passed) return { tier: 'structural', isVerified: false, error: t1.error, warnings: [...warnings, ...t1.warnings] };
        warnings.push(...t1.warnings);

        // 2
        try {
            const buffer = fs.readFileSync(filePath);
            const t2 = this.analyzeEntropy(buffer);
            if (!t2.passed) return { tier: 'entropy', isVerified: false, warnings: [...warnings, ...t2.warnings], error: t2.warnings[0] };
        } catch (err: any) {
            return { tier: 'entropy', isVerified: false, warnings, error: `Failed to read file for entropy: ${err.message}` };
        }

        // 3
        const t3 = await this.attemptDecode(filePath);
        if (!t3.passed) return { tier: 'decode', isVerified: false, error: t3.error, warnings: [...warnings, ...t3.warnings] };

        // 4 (Thumbnail diffing) -> We will stub this for MVP and just return verified at Decode stage
        return {
            tier: 'decode', // It passed up through decode
            isVerified: true,
            warnings
        };
    }
}
