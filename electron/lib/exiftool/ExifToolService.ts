import { ExifTool } from 'exiftool-vendored';

export interface ExifMetadata {
    cameraModel?: string;
    resolution?: string;
    orientation?: number;
    warnings?: string[];
    errors?: string[];
}

export interface ValidationResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
}

export class ExifToolService {
    private static instance: ExifTool | null = null;

    static getInstance(): ExifTool {
        if (!this.instance) {
            this.instance = new ExifTool({ taskTimeoutMillis: 10000, maxProcs: 2 });
        }
        return this.instance;
    }

    static async getMetadata(filePath: string): Promise<ExifMetadata> {
        const et = this.getInstance();
        const tags: any = await et.read(filePath);

        return {
            cameraModel: tags.Model as string | undefined,
            resolution: tags.ImageSize as string | undefined,
            orientation: tags.Orientation as number | undefined,
            warnings: tags.Warning ? (Array.isArray(tags.Warning) ? tags.Warning : [tags.Warning]) : [],
            errors: tags.Error ? (Array.isArray(tags.Error) ? tags.Error : [tags.Error]) : []
        };
    }

    static async extractPreview(filePath: string, outputPath: string): Promise<boolean> {
        const et = this.getInstance();
        try {
            await et.extractJpgFromRaw(filePath, outputPath);
            return true;
        } catch {
            try {
                await et.extractPreview(filePath, outputPath);
                return true;
            } catch {
                try {
                    await et.extractThumbnail(filePath, outputPath);
                    return true;
                } catch {
                    return false;
                }
            }
        }
    }

    static async validateFile(filePath: string): Promise<ValidationResult> {
        const et = this.getInstance();
        // ExifTool -validate
        const tags: any = await et.read(filePath, ['-validate', '-warning', '-error', '-a']);

        const errors = tags.Error ? (Array.isArray(tags.Error) ? tags.Error : [tags.Error]) : [];
        const warnings = tags.Warning ? (Array.isArray(tags.Warning) ? tags.Warning : [tags.Warning]) : [];

        return {
            passed: errors.length === 0,
            errors,
            warnings
        };
    }

    static async shutdown(): Promise<void> {
        if (this.instance) {
            await this.instance.end();
            this.instance = null;
        }
    }
}
