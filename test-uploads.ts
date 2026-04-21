import { uploadToImgBB } from './api/services/imgbbService';
import { uploadToImgHippo } from './api/services/imghippoService';
import { uploadToGifyu } from './api/services/gifyuService';
import { uploadToCatbox } from './api/services/catboxService';
import { uploadToBeeIMG } from './api/services/beeimgService';
import { uploadToUguu } from './api/services/uguuService';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const originalname = 'test.gif';
    const mimetype = 'image/gif';

    const providers = [
        { name: 'Catbox', test: () => uploadToCatbox(buffer, originalname, mimetype, '') },
        { name: 'Uguu', test: () => uploadToUguu(buffer, originalname, mimetype) },
        { name: 'BeeIMG', test: () => uploadToBeeIMG(buffer, originalname, mimetype) },
        { name: 'ImgHippo', test: () => uploadToImgHippo(buffer, originalname) },
        { name: 'Gifyu', test: () => uploadToGifyu(buffer, originalname, mimetype) },
        { name: 'ImgBB', test: () => uploadToImgBB(buffer, originalname, mimetype) }
    ];

    for (const p of providers) {
        try {
            console.log(`Testing ${p.name}...`);
            const res = await p.test();
            console.log(`${p.name} SUCCESS:`, res);
        } catch (e: any) {
            console.error(`${p.name} FAILED:`, e.message);
        }
    }
}

test();
