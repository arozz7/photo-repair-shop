import { ExifMetadata, ExifToolService } from '../lib/exiftool/ExifToolService.js';
import Database from 'better-sqlite3';
import fs from 'fs';

export interface ReferenceFile {
    id: number;
    filePath: string;
    cameraModel: string;
    resolution: string;
    fileFormat: string;
}

export interface CompatibilityResult {
    isCompatible: boolean;
    score: number; // 0.0 to 1.0 (1.0 = perfect match)
    reasons: string[];
}

export interface RankedReference {
    filePath: string;
    score: number;
    reasons: string[];
}

export class ReferenceManager {
    constructor(private db: Database.Database) { }

    async validateCompatibility(referencePath: string, targetMetadata: ExifMetadata): Promise<CompatibilityResult> {
        const refMeta = await ExifToolService.getMetadata(referencePath);
        let score = 0;
        const reasons: string[] = [];
        let isCompatible = true;

        // 1. Camera Model (Crucial)
        if (refMeta.cameraModel && targetMetadata.cameraModel) {
            if (refMeta.cameraModel === targetMetadata.cameraModel) {
                score += 0.6;
                reasons.push('Camera model exactly matches.');
            } else {
                isCompatible = false;
                reasons.push(`Camera mismatch: Target is ${targetMetadata.cameraModel}, Ref is ${refMeta.cameraModel}`);
            }
        } else {
            reasons.push('Missing camera model mapping data; assuming compatible but high risk.');
            score += 0.2; // partial credit since we can't disprove
        }

        // 2. Resolution (Very Important for MCU sizing)
        if (refMeta.resolution && targetMetadata.resolution) {
            if (refMeta.resolution === targetMetadata.resolution) {
                score += 0.3;
                reasons.push('Resolutions exactly match (MCU grid sync probable).');
            } else {
                isCompatible = false;
                reasons.push(`Resolution mismatch: Target is ${targetMetadata.resolution}, Ref is ${refMeta.resolution}`);
            }
        }

        // 3. Orientation 
        if (refMeta.orientation === targetMetadata.orientation) {
            score += 0.1;
            reasons.push('Orientation matches flawlessly.');
        }

        // Normalize slightly if they passed constraints but lacked data
        if (isCompatible && score < 0.1) score = 0.1;

        return {
            isCompatible,
            score: Math.min(score, 1.0),
            reasons
        };
    }

    async rankCandidates(candidates: string[], targetMetadata: ExifMetadata): Promise<RankedReference[]> {
        const results: RankedReference[] = [];

        for (const file of candidates) {
            const compat = await this.validateCompatibility(file, targetMetadata);
            if (compat.isCompatible) {
                results.push({
                    filePath: file,
                    score: compat.score,
                    reasons: compat.reasons
                });
            }
        }

        // Sort descending by score
        return results.sort((a, b) => b.score - a.score);
    }

    async addToLibrary(filePath: string): Promise<void> {
        const meta = await ExifToolService.getMetadata(filePath);
        if (meta.errors && meta.errors.length > 0) throw new Error('Cannot add corrupted file as reference.');

        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO reference_library (file_path, camera_model, resolution, file_format)
      VALUES (?, ?, ?, ?)
    `);

        // Basic format guessing (could be improved with a proper mime checker)
        const format = filePath.toLowerCase().split('.').pop() || 'unknown';

        stmt.run(
            filePath,
            meta.cameraModel || null,
            meta.resolution || null,
            format
        );
    }

    async scanReferenceFolder(folderPath: string): Promise<number> {
        let addedCount = 0;
        if (!fs.existsSync(folderPath)) return 0;

        try {
            const files = fs.readdirSync(folderPath);
            for (const file of files) {
                const ext = file.toLowerCase();
                if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.jfif') ||
                    ext.endsWith('.cr2') || ext.endsWith('.nef') || ext.endsWith('.arw')) {
                    const fullPath = require('path').join(folderPath, file);
                    try {
                        await this.addToLibrary(fullPath);
                        addedCount++;
                    } catch (e) {
                        console.warn(`[ReferenceManager] Failed to add ${fullPath} during scan:`, e);
                    }
                }
            }
        } catch (err) {
            console.error(`[ReferenceManager] Error scanning reference folder:`, err);
        }
        return addedCount;
    }

    findInLibrary(targetMetadata: ExifMetadata): ReferenceFile[] {
        // Exact match approach for now
        const sql = `
       SELECT id, file_path as filePath, camera_model as cameraModel, resolution, file_format as fileFormat 
       FROM reference_library 
       WHERE camera_model = ? AND resolution = ?
    `;

        if (!targetMetadata.cameraModel || !targetMetadata.resolution) return [];

        const stmt = this.db.prepare(sql);
        return stmt.all(targetMetadata.cameraModel, targetMetadata.resolution) as ReferenceFile[];
    }
}
