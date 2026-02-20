import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExifToolService } from './ExifToolService';

// Mock the vendored library
vi.mock('exiftool-vendored', () => {
    return {
        ExifTool: vi.fn().mockImplementation(() => ({
            read: vi.fn(async (filePath, args) => {
                if (filePath.includes('corrupt')) {
                    return {
                        Error: 'File format error'
                    };
                }
                if (args && args.includes('-validate')) {
                    return {
                        Warning: 'Improper JPEG alignment'
                    };
                }
                return {
                    Model: 'Canon EOS R5',
                    ImageSize: '6000x4000',
                    Orientation: 1
                };
            }),
            extractJpgFromRaw: vi.fn(async (filePath) => {
                if (filePath.includes('missing-preview')) throw new Error('Preview not found');
                return true;
            }),
            extractPreview: vi.fn(async () => { throw new Error('Not found') }),
            extractThumbnail: vi.fn(async () => { throw new Error('Not found') }),
            end: vi.fn(async () => { })
        }))
    };
});

describe('ExifToolService', () => {
    afterEach(async () => {
        await ExifToolService.shutdown();
    });

    describe('getMetadata', () => {
        it('should extract metadata from a valid file', async () => {
            const meta = await ExifToolService.getMetadata('/valid.cr2');
            expect(meta.cameraModel).toBe('Canon EOS R5');
            expect(meta.resolution).toBe('6000x4000');
            expect(meta.errors).toHaveLength(0);
        });

        it('should map errors if file is corrupt', async () => {
            const meta = await ExifToolService.getMetadata('/corrupt.jpg');
            expect(meta.cameraModel).toBeUndefined();
            expect(meta.errors).toContain('File format error');
        });
    });

    describe('extractPreview', () => {
        it('should successfully extract a preview', async () => {
            const result = await ExifToolService.extractPreview('/valid.cr2', '/out.jpg');
            expect(result).toBe(true);
        });

        it('should return false if extraction fails completely', async () => {
            const result = await ExifToolService.extractPreview('/missing-preview.cr2', '/out.jpg');
            expect(result).toBe(false);
        });
    });

    describe('validateFile', () => {
        it('should identify warnings during validation', async () => {
            const validation = await ExifToolService.validateFile('/valid.jpg');
            expect(validation.passed).toBe(true);
            expect(validation.warnings).toContain('Improper JPEG alignment');
        });

        it('should fail if errors exist', async () => {
            const validation = await ExifToolService.validateFile('/corrupt.jpg');
            expect(validation.passed).toBe(false);
            expect(validation.errors).toContain('File format error');
        });
    });
});
