import 'dotenv/config';
import { getSupabase } from './supabaseService.js';
import { uploadToSupabase } from './supabaseService.js';
import axios from 'axios';

const supabase = getSupabase();

async function downloadToBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

async function backupImages() {
    console.log('Starting image backup audit and mirroring...');
    
    // Fetch all templates
    const { data: templates, error } = await supabase.from('templates').select('id, image_url, banner_url, gallery_images');
    
    if (error) {
        console.error('Error fetching templates:', error);
        return;
    }

    const templatesList = templates as any[];
    console.log(`Found ${templatesList.length} templates to audit.`);

    for (const template of templatesList) {
        const fields = ['image_url', 'banner_url', 'gallery_images'];
        const updates: any = {};
        let updated = false;

        for (const field of fields) {
            let urls = template[field];
            if (!urls) continue;
            
            // Normalize to array for easier processing
            const urlArray = Array.isArray(urls) ? urls : [urls];
            const processedUrls = [];

            for (const url of urlArray) {
                if (typeof url !== 'string' || !url.includes('http')) {
                    processedUrls.push(url);
                    continue;
                }

                // If it's already in Supabase, skip
                if (url.includes('supabase.co')) {
                    processedUrls.push(url);
                    continue;
                }

                console.log(`Mirroring ${url} to Supabase...`);
                try {
                    const buffer = await downloadToBuffer(url);
                    const fileName = `${template.id}/${field}/${Date.now()}.jpg`;
                    const mimeType = 'image/jpeg';
                    
                    const newUrl = await uploadToSupabase(buffer, fileName, mimeType);
                    processedUrls.push(newUrl);
                    updated = true;
                } catch (e) {
                    console.error(`Failed to backup ${url}:`, e);
                    processedUrls.push(url); // Keep old URL if backup fails
                }
            }

            if (updated) {
                updates[field] = Array.isArray(urls) ? processedUrls : processedUrls[0];
            }
        }

        if (updated) {
            console.log(`Updating template ${template.id} with backup URLs:`, updates);
            await (supabase.from('templates') as any).update(updates).eq('id', template.id);
        }
    }
    console.log('Image backup mirroring complete.');
}

backupImages().catch(console.error);
