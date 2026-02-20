import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReferenceManager } from './ReferenceManager';
import { ExifToolService } from '../lib/exiftool/ExifToolService';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/database';

vi.mock('../lib/exiftool/ExifToolService');

describe('ReferenceManager', () => {
    let db: Database.Database;
    let manager: ReferenceManager;

    beforeEach(() => {
        vi.clearAllMocks();
        db = initializeDatabase(':memory:');
        manager = new ReferenceManager(db);
    });

    afterEach(() => {
        db.close();
    });

    it('should calculate perfect compatibility score', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({
            cameraModel: 'Canon EOS R5',
            resolution: '6000x4000',
            orientation: 1
        });

        const target = {
            cameraModel: 'Canon EOS R5',
            resolution: '6000x4000',
            orientation: 1
        };

        const result = await manager.validateCompatibility('/ref.jpg', target);

        expect(result.isCompatible).toBe(true);
        expect(result.score).toBeCloseTo(1.0);
    });

    it('should reject mismatched resolution', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({
            cameraModel: 'Canon EOS R5',
            resolution: '1920x1080',
        });

        const target = {
            cameraModel: 'Canon EOS R5',
            resolution: '6000x4000',
        };

        const result = await manager.validateCompatibility('/ref.jpg', target);

        expect(result.isCompatible).toBe(false);
        expect(result.reasons.some(r => r.includes('Resolution mismatch'))).toBe(true);
    });

    it('should add to library and find exact matches', async () => {
        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({
            cameraModel: 'Sony A7IV',
            resolution: '7000x4666',
        });

        await manager.addToLibrary('/lib/sony_donor.arw');

        // Target matches
        const matches = manager.findInLibrary({ cameraModel: 'Sony A7IV', resolution: '7000x4666' });
        expect(matches.length).toBe(1);
        expect(matches[0].filePath).toBe('/lib/sony_donor.arw');

        // Target does not match
        const noMatches = manager.findInLibrary({ cameraModel: 'Canon EOS', resolution: '100x100' });
        expect(noMatches.length).toBe(0);
    });
});
