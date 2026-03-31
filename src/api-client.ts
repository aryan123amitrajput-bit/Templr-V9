
import axios from 'axios';

const API_BASE = '/api';

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
      search,
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

export const getUserTemplates = async (userId: string) => {
  const response = await axios.get(`${API_BASE}/user/templates?userId=${userId}`);
  return response.data;
};

export const listenForUserTemplates = (userId: string, email: string | undefined, callback: (data: Template[]) => void) => {
  const fetch = async () => {
    try {
      const data = await getUserTemplates(userId);
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
  const response = await axios.post(`${API_BASE}/upload/catbox`, formData);
  return response.data.url;
};

export const uploadText = async (text: string) => {
  const response = await axios.post(`${API_BASE}/upload/text`, { text });
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
  const response = await axios.put(`${API_BASE}/templates/${id}`, { 
    updates: { ...data, author_email: email } 
  });
  return response.data;
};

export const addTemplate = async (data: NewTemplateData, user: any) => {
  const payload = {
    template: {
      ...data,
      author_id: user?.uid,
      author_name: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
      author_email: user?.email,
      author_avatar: user?.photoURL || ''
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

export const signInWithEmail = async (email: string, password: string) => {
  const response = await axios.post(`${API_BASE}/auth/signin`, { email, password });
  return response.data;
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const response = await axios.post(`${API_BASE}/auth/signup`, { email, password, name });
  return response.data;
};

export const signInWithGoogle = async () => {
  const response = await axios.post(`${API_BASE}/auth/signin`, { provider: 'google' });
  return response.data;
};

export const signOutUser = async () => {
  return { success: true };
};

export const updateUserProfile = async (uid: string, updates: any) => {
  const response = await axios.post(`${API_BASE}/user/update`, { uid, updates });
  return response.data;
};

export const fixUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://${url}`;
};
