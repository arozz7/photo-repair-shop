import fs from 'fs';
import path from 'path';
import { extractHeader } from '../../electron/lib/jpeg/parser';

const DONORS_DIR = path.join(__dirname, '../../assets/donors');
const PROFILES_DIR = path.join(__dirname, '../../assets/profiles');

function extractProfiles() {
    console.log('Extracting generic profiles from donors...');

    if (!fs.existsSync(DONORS_DIR)) {
        console.warn(`[SKIP] Donors directory not found at: ${DONORS_DIR}`);
        return;
    }

    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    const files = fs.readdirSync(DONORS_DIR).filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));

    if (files.length === 0) {
        console.log('No donor files found in assets/donors.');
        return;
    }

    let successCount = 0;
    for (const file of files) {
        const inputPath = path.join(DONORS_DIR, file);
        const baseName = path.parse(file).name;
        // Keep the .jpg extension for the output profile so it's easily recognized by the user
        const outputPath = path.join(PROFILES_DIR, `${baseName}-profile.jpg`);

        try {
            const buffer = fs.readFileSync(inputPath);
            const header = extractHeader(buffer);
            
            if (header.length > 0 && header.length < buffer.length) {
                fs.writeFileSync(outputPath, header);
                console.log(`[SUCCESS] Extracted profile: ${outputPath} (${header.length} bytes)`);
                successCount++;
            } else {
                console.warn(`[WARN] Failed to extract valid header from ${file}`);
            }
        } catch (err: any) {
            console.error(`[ERROR] Processing ${file}: ${err.message}`);
        }
    }

    console.log(`\nCompleted: ${successCount} profiles generated.`);
}

extractProfiles();
