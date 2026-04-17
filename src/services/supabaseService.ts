import { supabase } from './supabaseClient';
import { Template } from '../api-client';

export const getSupabase = () => supabase;

export async function getTemplates(page?: number, limit?: number, category?: string, searchQuery?: string) {
  let query = supabase
    .from('templates')
    .select('*');

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,author_name.ilike.%${searchQuery}%`);
  }

  if (page !== undefined && limit !== undefined) {
    const from = page * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getUserTemplates(userId: string, email?: string) {
  let query = supabase.from('templates').select('*');
  
  if (email && userId) {
    query = query.or(`author_id.eq.${userId},author_email.eq.${email}`);
  } else if (userId) {
    query = query.eq('author_id', userId);
  } else if (email) {
    query = query.eq('author_email', email);
  } else {
    return [];
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTemplate(template: any) {
  // Filter only valid columns to avoid errors
  const validColumns = [
    'id', 'title', 'description', 'image_url', 'category', 'tags', 
    'author_id', 'author_name', 'author_email', 'likes', 'views', 
    'is_public', 'created_at', 'updated_at', 'config'
  ];

  const filteredTemplate: any = {};
  for (const key of validColumns) {
    if (template[key] !== undefined) {
      filteredTemplate[key] = template[key];
    }
  }

  // Fallback for image_url
  if (!filteredTemplate.image_url && template.thumbnail) {
    filteredTemplate.image_url = template.thumbnail;
  }

  const { data, error } = await supabase
    .from('templates')
    .insert([filteredTemplate])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateTemplate(id: string, updates: any) {
  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAllTemplates(userId?: string) {
  let query = supabase.from('templates').delete();
  if (userId) {
    query = query.eq('author_id', userId);
  } else {
    query = query.neq('id', '0'); // Delete all
  }
  const { error } = await query;

  if (error) throw error;
}

export async function updateUser(user: any) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      uid: user.uid,
      email: user.email,
      display_name: user.displayName,
      photo_url: user.photoURL,
      updated_at: new Date().toISOString()
    }, { onConflict: 'uid' })
    .select();

  if (error) throw error;
  return data[0];
}

export async function uploadToSupabase(file: Buffer | Blob, path: string, contentType: string) {
  const { data, error } = await supabase.storage
    .from('templates')
    .upload(path, file, {
      contentType,
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('templates')
    .getPublicUrl(path);

  return publicUrl;
}
