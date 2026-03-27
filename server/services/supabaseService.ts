import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily or safely
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    // Prefer service role key for backend operations, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
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
  const bucketName = process.env.SUPABASE_BUCKET || 'templates';
  
  // Generate a unique file path
  const fileExt = originalName.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `previews/${fileName}`;

  console.log(`[Supabase] Uploading ${originalName} to ${bucketName}/${filePath}...`);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType: mimetype,
      upsert: true
    });

  if (error) {
    console.error('[Supabase Upload Error]', error);
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  console.log(`[Supabase] Upload successful: ${publicUrl}`);
  return publicUrl;
}

export async function getTemplates(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('templates')
    .select('*');
  
  if (error) {
    console.error('[Supabase Fetch Error]', error);
    return [];
  }
  
  return data || [];
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = getSupabase();
  
  // Check if ID is a valid UUID if Supabase expects it
  // If it's not a UUID, it might be a Firebase ID, so we skip Supabase delete
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUUID) {
    console.log(`[Supabase] Skipping delete for non-UUID ID: ${id}`);
    return;
  }

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('[Supabase Delete Error]', error);
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

export async function getUserTemplates(email: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('author_email', email);
  
  if (error) {
    console.error('[Supabase Fetch User Templates Error]', error);
    return [];
  }
  
  return data || [];
}

export async function updateUser(uid: string, updates: any): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .upsert({ uid, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
  
  if (error) {
    console.error('[Supabase Update User Error]', error);
    throw new Error(`Supabase update user failed: ${error.message}`);
  }
}

export async function addTemplate(template: any): Promise<void> {
  const supabase = getSupabase();
  
  // Only include columns that exist in the Supabase table
  const validColumns = [
    'id', 'created_at', 'title', 'description', 'category', 'price', 
    'author_name', 'author_email', 'image_url', 'banner_url', 
    'gallery_images', 'video_url', 'file_url', 'file_name', 
    'file_type', 'file_size', 'likes', 'views', 'sales', 
    'earnings', 'status', 'source_code', 'tags', 'author_avatar'
  ];

  const filteredTemplate: any = {};
  validColumns.forEach(col => {
    if (template[col] !== undefined) {
      filteredTemplate[col] = template[col];
    } else if (col === 'image_url' && template.thumbnail) {
      filteredTemplate[col] = template.thumbnail;
    } else if (col === 'source_code' && template.sourceCode) {
      filteredTemplate[col] = template.sourceCode;
    }
  });

  console.log(`[Supabase] Inserting template ${template.id} with filtered columns.`);

  const { error } = await (supabase
    .from('templates') as any)
    .insert([filteredTemplate]);
  
  if (error) {
    console.error('[Supabase Add Template Error]', error);
    throw new Error(`Supabase add template failed: ${error.message}`);
  }
}

export async function deleteAllTemplates(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('templates')
    .delete()
    .not('id', 'is', null);
  
  if (error) {
    console.error('[Supabase Delete All Error]', error);
    throw new Error(`Supabase delete all failed: ${error.message}`);
  }
}

