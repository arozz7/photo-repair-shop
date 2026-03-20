import fs from 'fs';
import pngToIco from 'png-to-ico';

async function convert() {
    try {
        const buf = await pngToIco('public/icon.png');
        fs.writeFileSync('public/icon.ico', buf);
        fs.writeFileSync('electron/icon.ico', buf);
        console.log('Successfully saved to public/icon.ico and electron/icon.ico');
    } catch (err) {
        console.error(err);
    }
}
convert();
