
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const API_BASE = '/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Template {
  id: string;
  title: string;
  author: string;
  author_uid?: string;
  authorAvatar?: string;
  authorBanner?: string;
  imageUrl: string;
  bannerUrl: string;
  likes: number;
  views: number;
  category: string;
  tags?: string[];
  description: string;
  price: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  sales: number;
  earnings: number;
  galleryImages?: string[];
  videoUrl?: string;
  createdAt?: number;
  catbox_url?: string;
}

export interface Session {
  user: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  };
}

export interface NewTemplateData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: string;
  imageUrl: string;
  bannerUrl?: string;
  fileUrl?: string;
  fileType?: string;
  videoUrl?: string;
  initialStatus?: 'approved' | 'pending_review' | 'rejected' | 'draft';
  author_name?: string;
  author_email?: string;
  author_avatar?: string;
}

export interface CreatorStats {
  name: string;
  email: string;
  avatar?: string;
  count: number;
  likes: number;
  views: number;
}

export const getPublicTemplates = async (
  page: number = 0,
  limit: number = 6,
  search: string = '',
  category: string = 'All',
  sort: string = 'newest',
  userId?: string
) => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      searchQuery: search,
      category,
      sort,
    });
    if (userId) params.append('userId', userId);

    const response = await axios.get(`${API_BASE}/templates?${params.toString()}`);
    return {
      data: response.data.data || [],
      hasMore: response.data.hasMore || false,
      error: null
    };
  } catch (error: any) {
    return {
      data: [],
      hasMore: false,
      error: error.response?.data?.error || error.message
    };
  }
};

export const getTemplateById = async (id: string) => {
  const response = await axios.get(`${API_BASE}/templates/${id}`);
  return response.data;
};

export const getUserTemplates = async (email: string) => {
  const response = await axios.get(`${API_BASE}/user/templates?email=${encodeURIComponent(email)}`);
  return response.data;
};

export const listenForUserTemplates = (userId: string, email: string | undefined, callback: (data: Template[]) => void) => {
  const fetch = async () => {
    if (!email) return;
    try {
      const data = await getUserTemplates(email);
      callback(data.data || []);
    } catch (e) {
      console.error('Error in listenForUserTemplates:', e);
    }
  };
  fetch();
  const interval = setInterval(fetch, 10000);
  return { unsubscribe: () => clearInterval(interval) };
};

export const uploadTemplate = async (formData: FormData) => {
  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE}/upload/catbox`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE}/upload`, formData);
  return response.data; // Returns { url, host, ... }
};

export const uploadText = async (text: string) => {
  const response = await axios.post(`${API_BASE}/upload/text`, { content: text });
  return response.data;
};

export const deleteTemplate = async (id: string) => {
  const response = await axios.delete(`${API_BASE}/templates/${id}`);
  return response.data;
};

export const updateTemplate = async (id: string, updates: any) => {
  const response = await axios.put(`${API_BASE}/templates/${id}`, { updates });
  return response.data;
};

export const updateTemplateData = async (id: string, data: any, email: string) => {
  const mappedUpdates = {
    title: data.title,
    description: data.description,
    image_url: data.imageUrl,
    file_url: data.fileUrl,
    video_url: data.videoUrl,
    tags: data.tags,
    category: data.category,
    status: data.initialStatus || data.status,
    author_email: email
  };
  
  // Remove undefined fields
  Object.keys(mappedUpdates).forEach(key => {
    if (mappedUpdates[key as keyof typeof mappedUpdates] === undefined) {
      delete mappedUpdates[key as keyof typeof mappedUpdates];
    }
  });

  const response = await axios.put(`${API_BASE}/templates/${id}`, { 
    updates: mappedUpdates 
  });
  return response.data;
};

export const addTemplate = async (data: NewTemplateData, user: any) => {
  const payload = {
    template: {
      ...data,
      author_id: user?.id || user?.uid,
      author_name: user?.user_metadata?.name || user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
      author_email: user?.email,
      author_avatar: user?.user_metadata?.avatar_url || user?.photoURL || ''
    }
  };
  const response = await axios.post(`${API_BASE}/templates`, payload);
  return response.data.template;
};

export const getStats = async () => {
  const response = await axios.get(`${API_BASE}/stats`);
  return response.data;
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
  try {
    const response = await axios.get(`${API_BASE}/creators`);
    return response.data.data || [];
  } catch (e) {
    console.error('Error fetching featured creators:', e);
    return [];
  }
};

export const logError = async (error: any) => {
  console.error('Logging error to server:', error);
  return { success: true };
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, usage_count: 0, is_pro: false } }
  });
  if (error) throw error;
  return data;
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
};

export const signOutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { success: true };
};

export const updateUserProfile = async (uid: string, updates: any) => {
  const { data, error } = await supabase.auth.updateUser({
    data: updates
  });
  if (error) throw error;
  return data;
};

export const fixUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://${url}`;
};
