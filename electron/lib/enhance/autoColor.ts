import sharp from 'sharp';
import fs from 'fs';

export async function normalizeHistogram(inputPath: string, outputPath: string): Promise<void> {
    if (!fs.existsSync(inputPath)) {
        throw new Error('Input file not found for auto-enhance');
    }

    try {
        // We use sharp to extract the image buffer, apply normalization (which stretches the histogram
        // to cover full dynamic range, fixing washed out colors), and write to a new file.
        await sharp(inputPath)
            .normalize()
            .toFile(outputPath);
    } catch (err: any) {
        throw new Error(`Auto-color enhancement failed: ${err.message}`);
    }
}
