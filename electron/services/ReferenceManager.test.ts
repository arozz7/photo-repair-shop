import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReferenceManager } from './ReferenceManager';
import { ExifToolService } from '../lib/exiftool/ExifToolService';
import Database from 'better-sqlite3';

vi.mock('../lib/exiftool/ExifToolService');
vi.mock('better-sqlite3', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            prepare: vi.fn().mockReturnValue({
                run: vi.fn(),
                all: vi.fn().mockReturnValue([])
            }),
            pragma: vi.fn(),
            exec: vi.fn(),
            close: vi.fn()
        }))
    };
});
vi.mock('fs');
import fs from 'fs';
import { initializeDatabase } from '../db/database';


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

        // We also need to mock preparation for the specific return
        const mockAll = vi.fn().mockReturnValue([{ filePath: '/lib/sony_donor.arw', cameraModel: 'Sony A7IV', resolution: '7000x4666' }]);
        (db.prepare as any).mockReturnValue({ run: vi.fn(), all: mockAll });

        await manager.addToLibrary('/lib/sony_donor.arw');

        // Target matches
        const matches = manager.findInLibrary({ cameraModel: 'Sony A7IV', resolution: '7000x4666' });
        expect(matches.length).toBe(1);
        expect(matches[0].filePath).toBe('/lib/sony_donor.arw');
    });

    it('should support wider range of format profiles during scan', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([
            'photo1.jpg',
            'photo2.DNG',
            'photo3.cr3',
            'photo4.raf',
            'photo5.rw2',
            'photo6.orf',
            'photo7.pef',
            'photo8.sr2',
            'ignored.txt',
            'photo9.ARW'
        ] as any);

        vi.mocked(ExifToolService.getMetadata).mockResolvedValue({
            cameraModel: 'Generic Camera',
            resolution: '4000x3000'
        });

        const addedCount = await manager.scanReferenceFolder('/mock/folder');

        // Wait, current manager only supports a few. This test will currently fail until I expand them!
        // But TDD says test fails first. I expect 9 files to be added.
        expect(addedCount).toBe(9);
    });

    it('should find best reference for batch targets', async () => {
        // mock return from library with 2 candidates
        const mockAll = vi.fn().mockReturnValue([
            { filePath: '/lib/canon_donor1.cr3', cameraModel: 'Canon R5', resolution: '8192x5464', fileFormat: 'cr3' },
            { filePath: '/lib/canon_donor2.cr3', cameraModel: 'Canon R5', resolution: '8192x5464', fileFormat: 'cr3' }
        ]);
        (db.prepare as any).mockReturnValue({ run: vi.fn(), all: mockAll });

        // Mock ExifToolService to return exactly matching metadata for donor1 and slightly mismatched for donor 2
        vi.mocked(ExifToolService.getMetadata).mockImplementation(async (filePath) => {
            if (filePath === '/lib/canon_donor1.cr3') {
                return { cameraModel: 'Canon R5', resolution: '8192x5464', orientation: 1 };
            }
            return { cameraModel: 'Canon R5', resolution: '8192x5464', orientation: 8 }; // different orientation
        });

        const best = await manager.findBestReference({ cameraModel: 'Canon R5', resolution: '8192x5464', orientation: 1 });

        expect(best).not.toBeNull();
        expect(best!.filePath).toBe('/lib/canon_donor1.cr3');
        expect(best!.score).toBeGreaterThan(0.9);
    });
});
