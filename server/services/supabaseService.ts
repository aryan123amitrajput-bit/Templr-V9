import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily or safely
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Prefer service role key for backend operations, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    console.log("Initializing Supabase client...");
    console.log("SUPABASE_URL:", supabaseUrl ? "Set" : "Not Set");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not Set");
    console.log("SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "Set" : "Not Set");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * Uploads an image buffer to Supabase Storage and returns the public URL.
 * 
 * @param fileBuffer The raw file buffer from multer
 * @param originalName The original filename
 * @param mimetype The file mimetype (e.g., image/png)
 * @returns The public URL of the uploaded image
 */
export async function uploadPreviewImage(fileBuffer: Buffer, originalName: string, mimetype: string): Promise<string> {
  const supabase = getSupabase();
  
  // Resilient bucket name resolution
  let bucketName = 'templates';
  const envBucket = process.env.SUPABASE_BUCKET;
  console.log(`[Supabase] Raw SUPABASE_BUCKET from env: "${envBucket ? (envBucket.length > 20 ? envBucket.substring(0, 10) + '...' : envBucket) : 'Not Set'}"`);
  if (envBucket) {
    // Remove quotes, trim, remove trailing slashes, replace underscores with hyphens, and lowercase
    const cleaned = envBucket.replace(/['"]/g, '').trim().split('/')[0].replace(/_/g, '-').toLowerCase();
    // Remove leading/trailing hyphens and any other invalid characters (only lowercase, numbers, hyphens allowed)
    const finalCleaned = cleaned.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/g, '');
    
    // Validate bucket name: must be 3-63 chars, not a token (doesn't start with eyJ), and not empty
    if (finalCleaned.length >= 3 && finalCleaned.length <= 63 && !finalCleaned.startsWith('eyj')) {
      bucketName = finalCleaned;
    } else {
      console.warn(`[Supabase] Invalid bucket name provided in env ("${envBucket.substring(0, 10)}..."), falling back to default "templates"`);
    }
  }
  
  console.log(`[Supabase] Using bucket: "${bucketName}" for upload`);
  
  // Generate a unique filename to prevent collisions
  const fileExt = originalName.split('.').pop() || 'bin';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `previews/${fileName}`;

  // Upload the file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: mimetype,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error(`[Supabase] Upload failed for bucket "${bucketName}":`, error);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Retrieve the public URL for the newly uploaded file
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
