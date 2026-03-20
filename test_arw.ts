import { ExifToolService } from './electron/lib/exiftool/ExifToolService';

async function main() {
    try {
        console.log('Testing ExifToolService.validateFile...');
        const result = await ExifToolService.validateFile('M:\\carved\\carving-4TB\\ferrite_arw_627716096.arw');
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await ExifToolService.shutdown();
    }
}

main();
