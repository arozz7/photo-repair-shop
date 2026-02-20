import fs from 'fs';
import path from 'path';

const outDir = path.join(__dirname, '../test-assets');

function generateTestAssets() {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Generate a dummy healthy JPEG
    const healthy = Buffer.from([
        0xFF, 0xD8,                          // SOI
        0xFF, 0xE0, 0x00, 0x10,              // APP0
        ...new Array(14).fill(0),
        0xFF, 0xDA, 0x00, 0x08,              // SOS
        ...new Array(6).fill(0),
        0x12, 0x34, 0x56, 0x78,              // Bitstream
        0xFF, 0xD9                           // EOI
    ]);

    fs.writeFileSync(path.join(outDir, 'healthy.jpg'), healthy);

    // 1. Missing SOI
    const missingSoi = Buffer.from(healthy).subarray(2);
    fs.writeFileSync(path.join(outDir, 'missing_soi.jpg'), missingSoi);

    // 2. Missing Header (No SOS)
    const missingHeader = Buffer.concat([
        Buffer.from([0xFF, 0xD8]),
        Buffer.from([0x12, 0x34, 0x56, 0x78, 0xFF, 0xD9])
    ]);
    fs.writeFileSync(path.join(outDir, 'missing_header.jpg'), missingHeader);

    // 3. Invalid Markers
    const invalidMarkers = Buffer.from(healthy);
    invalidMarkers[25] = 0xFF;
    invalidMarkers[26] = 0x9A; // FF 9A
    fs.writeFileSync(path.join(outDir, 'invalid_markers.jpg'), invalidMarkers);

    // 4. Truncated
    const truncated = Buffer.from(healthy).subarray(0, healthy.length - 2);
    fs.writeFileSync(path.join(outDir, 'truncated.jpg'), truncated);

    console.log(`Test assets generated in ${outDir}`);
}

generateTestAssets();
