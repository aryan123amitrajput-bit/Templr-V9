import 'dotenv/config';
import { getSupabase } from '../server/services/supabaseService';
import { uploadFromUrl } from '../src/services/imageUploadService';

const supabase = getSupabase();

async function validateAndFixImages() {
    console.log('Starting image validation...');
    
    const { data: templates, error } = await supabase.from('templates').select('id, image_url, banner_url');
    
    if (error) {
        console.error('Error fetching templates:', error);
        return;
    }

    for (const template of templates) {
        const urls = [template.image_url, template.banner_url];
        let updated = false;
        const updates: any = {};

        for (const field of ['image_url', 'banner_url']) {
            const url = template[field];
            if (!url) continue;

            if (url.startsWith('blob:') || url.includes('localhost') || url.startsWith('/uploads/')) {
                console.log(`Invalid URL found in template ${template.id} (${field}): ${url}`);
                
                try {
                    // Try to re-upload if it's a valid URL, otherwise flag it
                    if (url.startsWith('http')) {
                        console.log(`Attempting to re-upload: ${url}`);
                        const result = await uploadFromUrl(url);
                        updates[field] = result.direct_url;
                        updated = true;
                    } else {
                        console.log(`Cannot re-upload local path: ${url}. Please manually fix.`);
                    }
                } catch (e) {
                    console.error(`Failed to re-upload ${url}:`, e);
                }
            }
        }

        if (updated) {
            console.log(`Updating template ${template.id}:`, updates);
            await supabase.from('templates').update(updates).eq('id', template.id);
        }
    }
    console.log('Image validation complete.');
}

validateAndFixImages();
