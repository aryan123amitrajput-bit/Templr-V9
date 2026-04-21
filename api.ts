
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import { uploadImage } from './src/services/imageUploadService';
import { supabase } from './lib/supabaseClient';
import { mapToTemplate, Template } from './lib/mapping';

export type { Template };


// ==========================================
//   TEMPLR PRODUCTION ENGINE v10.0 (GITHUB)
// ==========================================

// --- THE "WIRE" (Instant Background Prefetch Cache) ---
class TemplateWireCache {
    private cache: any[] = [];
    private isWired = false;
    private wirePromise: Promise<void> | null = null;
    
    constructor() {
        this.installWire();
    }
    
    private async installWire() {
        this.wirePromise = (async () => {
            try {
                // Instantly wire directly into the backend registry & first page on startup
                console.log("[TemplateWire] 🔌 Initializing direct wire to external services in background...");
                const [registryRes, initialRes] = await Promise.all([
                    fetch('/api/registry').catch(() => null),
                    fetch('/api/templates?page=0&limit=24').catch(() => null)
                ]);
                
                if (initialRes && initialRes.ok) {
                    const data = await initialRes.json();
                    if (data && data.data && data.data.length > 0) {
                        this.cache = data.data;
                        this.isWired = true;
                        console.log(`[TemplateWire] ⚡ Successfully locked memory to ${this.cache.length} templates instantly.`);
                        return;
                    }
                }
                
                // CLIENT-SIDE FALLBACK SECURE-SYNC (For Cloudflare Pages / Static Deployments)
                // If the local API failed or returned empty (common on static hosts), try to sync directly from GitHub CDN, then Supabase
                console.log("[TemplateWire] 🌐 Static Host Detected (or API down). Activating Client-Side Direct Wire...");
                
                try {
                    // Try GitHub CDN directly first
                    const ghRes = await fetch('https://cdn.jsdelivr.net/gh/templr-app/templates/registry.json');
                    if (ghRes.ok) {
                        const ghData = await ghRes.json();
                        if (ghData && Array.isArray(ghData) && ghData.length > 0) {
                            this.cache = ghData;
                            this.isWired = true;
                            console.log(`[TemplateWire] 🌍 Client-Side GitHub Wire linked to ${this.cache.length} templates.`);
                            return;
                        }
                    }
                } catch (ghError) {
                    console.warn("[TemplateWire] 🌍 Client-Side GitHub Wire failed, falling back to Supabase.");
                }

                if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
                   const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false }).limit(24);
                   if (!error && data) {
                       this.cache = data;
                       this.isWired = true;
                       console.log(`[TemplateWire] 🌍 Client-Side Supabase Wire linked to ${this.cache.length} templates.`);
                   }
                }
            } catch (error) {
                console.error("[TemplateWire] ❌ Wire interference:", error);
            }
        })();
    }
    
    async getCachedTemplates(page: number, limit: number, category: string, reqSearch: string, sortBy: string) {
        if (!this.isWired && this.wirePromise) {
            await this.wirePromise;
        }
        
        // Only safely return cached wire if standard default request
        if (this.isWired && page === 0 && (!category || category === 'All') && !reqSearch && sortBy === 'newest') {
            return {
                data: this.cache,
                hasMore: false,
                fromWire: true
            };
        }
        return null;
    }
}

export const activeWireCache = new TemplateWireCache();

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return { session: { user: {
            id: result.user.uid,
            uid: result.user.uid,
            email: result.user.email || '',
            user_metadata: {
                full_name: result.user.displayName || '',
                avatar_url: fixUrl(result.user.photoURL || ''),
                usage_count: 0,
                is_pro: false
            }
        }}};
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("No user returned");
    
    const user = data.user;
    const session = {
        user: {
            id: user.id,
            uid: user.id,
            email: user.email || '',
            user_metadata: {
                full_name: user.user_metadata?.full_name || '',
                avatar_url: fixUrl(user.user_metadata?.avatar_url || ''),
                usage_count: user.user_metadata?.usage_count || 0,
                is_pro: user.user_metadata?.is_pro || false
            }
        }
    };
    return { session };
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: name,
                avatar_url: '',
                usage_count: 0,
                is_pro: false
            }
        }
    });
    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    const user = data.user;
    const session = {
        user: {
            id: user.id,
            uid: user.id,
            email: user.email || '',
            user_metadata: {
                full_name: user.user_metadata?.full_name || name,
                avatar_url: fixUrl(user.user_metadata?.avatar_url || ''),
                usage_count: user.user_metadata?.usage_count || 0,
                is_pro: user.user_metadata?.is_pro || false
            }
        }
    };
    return { session };
};

export const signOutUser = async () => {
    await signOut(auth);
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
    // Listen to Firebase Auth
    const unsubFirebase = onAuthStateChanged(auth, (user) => {
        if (user) {
            const session = {
                user: {
                    id: user.uid,
                    uid: user.uid,
                    email: user.email,
                    user_metadata: {
                        full_name: user.displayName,
                        avatar_url: user.photoURL,
                        usage_count: 0, 
                        is_pro: false 
                    }
                }
            };
            callback('SIGNED_IN', session);
        } else {
            // Check if we are still signed in with Supabase
            supabase.auth.getSession().then(({ data }) => {
                if (!data.session) {
                    callback('SIGNED_OUT', null);
                }
            });
        }
    });

    // Listen to Supabase Auth
    const { data: { subscription: unsubSupabase } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session) {
                const user = session.user;
                const mappedSession = {
                    user: {
                        id: user.id,
                        uid: user.id,
                        email: user.email,
                        user_metadata: {
                            full_name: user.user_metadata?.full_name || '',
                            avatar_url: user.user_metadata?.avatar_url || '',
                            usage_count: user.user_metadata?.usage_count || 0,
                            is_pro: user.user_metadata?.is_pro || false
                        }
                    }
                };
                callback('SIGNED_IN', mappedSession);
            }
        } else if (event === 'SIGNED_OUT') {
            // Check if we are still signed in with Firebase
            if (!auth.currentUser) {
                callback('SIGNED_OUT', null);
            }
        }
    });

    return () => {
        unsubFirebase();
        unsubSupabase.unsubscribe();
    };
};

export interface NewTemplateData {
  title: string;
  imageUrl: string; 
  bannerUrl: string; 
  galleryImages: string[]; 
  videoUrl?: string; 
  description?: string;
  category: string;
  tags?: string[];
  price: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number; 
  externalLink?: string;
  fileUrl?: string;
  template_url?: string;
  sourceCode?: string;
  uploadHost?: string;
  initialStatus?: 'pending_review' | 'draft' | 'approved';
}

export type Session = {
  user: {
    id: string;
    uid: string;
    email?: string;
    user_metadata: {
        avatar_url?: string;
        banner_url?: string;
        full_name?: string;
        usage_count?: number;
        is_pro?: boolean;
    };
  };
};

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT';


export interface CreatorStats {
    name: string;
    email: string;
    totalViews: number;
    totalLikes: number;
    templateCount: number;
    avatarUrl: string;
    role: string;
}

export const fixUrl = (url?: string | string[]): string => {
    if (!url) return '';
    
    // Handle case where DB returns an array or JSON stringified array
    if (Array.isArray(url)) {
        if (url.length === 0) return '';
        url = url[0];
    } else if (typeof url === 'string' && url.trim().startsWith('[') && url.trim().endsWith(']')) {
        try {
            const parsed = JSON.parse(url);
            if (Array.isArray(parsed) && parsed.length > 0) {
                url = parsed[0];
            }
        } catch (e) {
            // Ignore parse error
        }
    }

    if (typeof url !== 'string') return '';
    let trimmedUrl = url.trim();
    
    // Strip leading/trailing quotes if they exist
    if ((trimmedUrl.startsWith('"') && trimmedUrl.endsWith('"')) || (trimmedUrl.startsWith("'") && trimmedUrl.endsWith("'"))) {
        trimmedUrl = trimmedUrl.slice(1, -1).trim();
    }
    
    return trimmedUrl;
};

export const unfixUrl = (url?: string): string => url || '';


/**
 * Global API functions
 */

export const getPublicTemplates = async (
    page: number = 0, 
    limitNum: number = 6, 
    searchQuery: string = '', 
    category: string = 'All',
    sortBy: 'newest' | 'popular' | 'likes' = 'newest',
    currentUserId?: string
): Promise<{ data: Template[], hasMore: boolean, error?: string }> => {
    try {
        // Intercept via the Instant Pre-Wired Cache
        const wiredCache = await activeWireCache.getCachedTemplates(page, limitNum, category, searchQuery, sortBy);
        if (wiredCache) {
            console.log(`[Templates] ⚡ Served instantly from the Background Wire! (${wiredCache.data.length} items)`);
            return { data: wiredCache.data.map((t: any) => mapToTemplate(t)), hasMore: wiredCache.hasMore };
        }

        const url = `/api/templates?page=${page}&limit=${limitNum}&category=${category}&searchQuery=${searchQuery}&sortBy=${sortBy}`;
        console.log(`[API] Fetching: ${url}`);
        const response = await fetch(url).catch(err => {
            console.error(`[API] Network error fetching ${url}:`, err);
            throw new Error(`Failed to fetch: ${err.message || 'Network error'}`);
        });
        
        if (!response.ok) {
            console.warn(`[API] HTTP error ${response.status} for ${url}`);
            // FALLBACK FOR STATIC DEPLOYMENTS (Cloudflare/Vercel)
            // If the /api endpoint is not found, fallback to direct GitHub CDN, then Supabase
            if (response.status === 404) {
                console.warn("[Templates] API not found (404). Falling back to CDN/Supabase...");
                
                try {
                    const ghRes = await fetch('https://cdn.jsdelivr.net/gh/templr-app/templates/registry.json');
                    if (ghRes.ok) {
                        const ghData = (await ghRes.json()) || [];
                        let filtered = [...ghData];
                        
                        if (category && category !== 'All') {
                            filtered = filtered.filter(t => t.category === category);
                        }
                        if (searchQuery) {
                            const sq = searchQuery.toLowerCase();
                            filtered = filtered.filter(t => (t.title && t.title.toLowerCase().includes(sq)) || (t.description && t.description.toLowerCase().includes(sq)));
                        }
                        
                        if (sortBy === 'popular' || sortBy === 'likes') {
                            filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                        } else {
                            filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
                        }
                        
                        const start = page * limitNum;
                        const end = start + limitNum;
                        const paginatedData = filtered.slice(start, end);
                        
                        return {
                            data: paginatedData.map(t => mapToTemplate(t)),
                            hasMore: end < filtered.length
                        };
                    }
                } catch (ghErr) {
                    console.warn("[Templates] GitHub CDN fallback failed", ghErr);
                }

                if (import.meta.env.VITE_SUPABASE_URL) {
                    let query = supabase.from('templates').select('*', { count: 'exact' });
                    
                    if (category && category !== 'All') {
                        query = query.eq('category', category);
                    }
                    if (searchQuery) {
                        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
                    }
                    
                    if (sortBy === 'popular' || sortBy === 'likes') {
                        query = query.order('likes', { ascending: false });
                    } else {
                        query = query.order('created_at', { ascending: false });
                    }
                    
                    const { data, count, error } = await query.range(page * limitNum, (page + 1) * limitNum - 1);
                    if (error) {
                        console.error("[Supabase Fallback] Error:", error);
                        throw error;
                    }
                    
                    return { 
                        data: (data || []).map(t => mapToTemplate(t)), 
                        hasMore: (count || 0) > (page + 1) * limitNum 
                    };
                }
            }
            throw new Error(`Failed to fetch templates: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result || !result.data) {
             console.error("[API] Invalid response structure:", result);
             return { data: [], hasMore: false, error: "Invalid response from server" };
        }
        const data = result.data.map((t: any) => mapToTemplate(t));
        return { data, hasMore: result.hasMore };
    } catch (e: any) {
        console.error("Error fetching public templates:", e);
        return { data: [], hasMore: false, error: e.message || "Connection failed" };
    }
};

export const getTemplateById = async (id: string): Promise<Template | null> => {
    try {
        const response = await fetch(`/api/templates/${id}`);
        if (!response.ok) {
            // FALLBACK
            if (response.status === 404) {
                try {
                    const ghRes = await fetch('https://cdn.jsdelivr.net/gh/templr-app/templates/registry.json');
                    if (ghRes.ok) {
                        const ghData = await ghRes.json();
                        const template = ghData.find((t: any) => t.id === id);
                        if (template) return mapToTemplate(template);
                    }
                } catch (e) {
                    // Ignore and fallback to supabase
                }

                if (import.meta.env.VITE_SUPABASE_URL) {
                    const { data, error } = await supabase.from('templates').select('*').eq('id', id).single();
                    if (!error && data) return mapToTemplate(data);
                }
            }
            return null;
        }
        const result = await response.json();
        return mapToTemplate(result.template);
    } catch (e: any) {
        console.error("Error fetching template:", e);
        return null;
    }
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
    try {
        const response = await fetch('/api/creators');
        if (!response.ok) {
            // FALLBACK
            if (response.status === 404) {
                try {
                    const ghRes = await fetch('https://cdn.jsdelivr.net/gh/templr-app/templates/registry.json');
                    let templates = [];
                    if (ghRes.ok) {
                        templates = await ghRes.json();
                    } else if (import.meta.env.VITE_SUPABASE_URL) {
                        const { data } = await supabase.from('templates').select('*');
                        templates = data || [];
                    }

                    if (templates.length > 0) {
                        const creatorsMap = new Map();
                        templates.forEach((t: any) => {
                            const email = t.author_email || t.creator_email;
                            const name = t.author_name || t.creator || t.author || 'Anonymous';
                            if (!email) return;
                            if (!creatorsMap.has(email)) {
                                creatorsMap.set(email, {
                                    name: name,
                                    email: email,
                                    avatarUrl: t.author_avatar || t.creator_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                                    views: 0,
                                    likes: 0,
                                    templateCount: 0,
                                    role: 'Creator'
                                });
                            }
                            const creator = creatorsMap.get(email);
                            creator.views += (t.views || t.stats?.views || 0);
                            creator.likes += (t.likes || t.stats?.likes || 0);
                            creator.templateCount += 1;
                        });
                        return Array.from(creatorsMap.values())
                            .sort((a, b) => (b.likes + b.views) - (a.likes + a.views))
                            .slice(0, 10);
                    }
                } catch (e) {
                    console.error("Fallback creator fetch failed", e);
                }
            }
            throw new Error("Failed to fetch featured creators");
        }
        const result = await response.json();
        return result.data;
    } catch (e: any) {
        console.error("Error fetching featured creators:", e);
        return [];
    }
};

export const listenForUserTemplates = (userId: string, userEmail: string | undefined, callback: (templates: Template[]) => void) => {
    if (!userId) { callback([]); return { unsubscribe: () => {} }; }
    
    let interval: any;
    const fetchTemplates = async () => {
        try {
            const url = `/api/user/templates?email=${encodeURIComponent(userEmail || '')}`;
            const response = await fetch(url);
            if (!response.ok) {
                const text = await response.text();
                console.error(`Error fetching user templates: ${response.status} ${text.substring(0, 100)}`);
                return;
            }
            const result = await response.json();
            callback(result.data.map((t: any) => mapToTemplate(t)));
        } catch (e) {
            console.error("Error fetching user templates:", e);
        }
    };
    
    fetchTemplates();
    interval = setInterval(fetchTemplates, 5000);
    
    return { unsubscribe: () => clearInterval(interval) };
};

export const addTemplate = async (templateData: NewTemplateData, user?: Session['user'] | null): Promise<Template> => {
    const currentUser = user || (auth.currentUser ? { 
        uid: auth.currentUser.uid, 
        id: auth.currentUser.uid, 
        email: auth.currentUser.email || '', 
        user_metadata: { 
            full_name: auth.currentUser.displayName || '', 
            avatar_url: auth.currentUser.photoURL || '' 
        } 
    } : null);

    if (!currentUser || !currentUser.uid) throw new Error("Authentication required.");

    const templatePayload = {
        title: templateData.title,
        preview_image: unfixUrl(templateData.imageUrl),
        banner_url: unfixUrl(templateData.bannerUrl || templateData.imageUrl),
        category: templateData.category,
        price: templateData.price,
        author_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        author_email: currentUser.email,
        author_avatar: unfixUrl(currentUser.user_metadata?.avatar_url),
        file_name: templateData.fileName || 'Project Files',
        file_type: templateData.fileType || 'link',
        file_size: templateData.fileSize || 0,
        status: templateData.initialStatus === 'draft' ? 'draft' : 'approved',
        tags: templateData.tags || [],
        description: templateData.description,
        video_url: unfixUrl(templateData.videoUrl),
        gallery_images: (templateData.galleryImages || []).map(unfixUrl),
        template_url: templateData.template_url || '',
        file_url: unfixUrl(templateData.fileUrl || templateData.externalLink),
        upload_host: templateData.uploadHost,
        author_uid: currentUser.uid
    };

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: templatePayload })
        });
        if (!response.ok) throw new Error("Failed to add template");
        const result = await response.json();
        return mapToTemplate(result.template);
    } catch (error: any) {
        console.error("Error adding template:", error);
        throw new Error(error.message || "Error saving template.");
    }
};

export const updateTemplateData = async (id: string, data: Partial<NewTemplateData>, userEmail: string): Promise<void> => {
    const updates: any = {};
    if (data.title) updates.title = data.title;
    if (data.description) updates.description = data.description;
    if (data.category) updates.category = data.category;
    if (data.tags) updates.tags = data.tags;
    if (data.externalLink) updates.file_url = unfixUrl(data.externalLink);
    if (data.imageUrl) updates.preview_image = unfixUrl(data.imageUrl);
    if (data.bannerUrl) updates.banner_url = unfixUrl(data.bannerUrl);
    if (data.videoUrl) updates.video_url = unfixUrl(data.videoUrl);
    if (data.template_url) updates.template_url = data.template_url;
    if (data.fileUrl) updates.file_url = unfixUrl(data.fileUrl);
    if (data.initialStatus) updates.status = data.initialStatus === 'draft' ? 'draft' : 'approved';

    try {
        const response = await fetch(`/api/templates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        if (!response.ok) throw new Error("Failed to update template");
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'update', id } }));
        }
    } catch (error: any) {
        console.error("Error updating template data:", error);
        throw new Error(error.message || "Error updating template.");
    }
};

export const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string; banner_url?: string }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  
  const dbUpdates: any = { ...updates };
  if (dbUpdates.avatar_url) dbUpdates.avatar_url = unfixUrl(dbUpdates.avatar_url);
  if (dbUpdates.banner_url) dbUpdates.banner_url = unfixUrl(dbUpdates.banner_url);

  try {
      // Use backend API instead of Firestore
      const response = await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates, uid: user.uid })
      });
      
      if (!response.ok) throw new Error("Failed to update profile");
      
      return { user: { ...user, user_metadata: { ...user.providerData[0], ...updates } } };
  } catch (e: any) {
      console.error("Error updating profile:", e);
      throw e;
  }
};

export const updateUserUsage = async (count: number) => {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
      // Use backend API instead of Firestore
      await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: { usage_count: count }, uid: user.uid })
      });
  } catch (e: any) {
      console.error("Sync usage error:", e);
  }
};

export const setProStatus = async (status: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Use backend API instead of Firestore
        await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { is_pro: status }, uid: user.uid })
        });
    } catch (e: any) {
        console.error("Pro Status update failed:", e);
    }
};

export const updateTemplate = async (templateId: string, updates: Partial<Template>): Promise<void> => {
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        if (!response.ok) throw new Error("Failed to update template");
    } catch(e: any) {
        console.error("Error updating template:", e);
    }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error("Failed to delete template");

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'delete', id: templateId } }));
        }
    } catch (e: any) {
        console.error("Error deleting template:", e);
        throw new Error(e.message || "Error deleting template.");
    }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const getSession = async (): Promise<Session | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
        user: {
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            user_metadata: {
                full_name: user.displayName || '',
                avatar_url: fixUrl(user.photoURL || ''),
            }
        }
    };
};

export const uploadFileFromUrl = async (url: string): Promise<{ url: string; host: string }> => {
    if (!url) throw new Error("No URL provided for upload.");
    
    try {
        const response = await fetch('/api/upload/url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload from URL failed: ${response.statusText}`);
        }

        const data = await response.json();
        return { url: data.url, host: data.host };
    } catch (err: any) {
        throw new Error("Upload from URL failed: " + err.message);
    }
};

export const getWireData = async () => {
    const res = await fetch('/api/wire');
    if (!res.ok) throw new Error("Failed to fetch wire data");
    return await res.json();
};

export const uploadFile = async (file: File, path: string): Promise<{ url: string; host: string }> => {
    if (!file) throw new Error("No file provided for upload.");
    
    // Use specialized image upload service for images to ensure external hosting prioritization
    if (file.type.startsWith('image/')) {
        try {
            const result = await uploadImage(file);
            return { url: result.direct_url, host: result.provider };
        } catch (err: any) {
            console.warn("[Upload] Client-side uploadImage failed, falling back to backend:", err.message);
        }
    }

    // Sanitize path just in case
    const safePath = path.replace(/[^a-zA-Z0-9/._-]/g, '_');

    const attempt = async (retryCount = 0): Promise<{ url: string; host: string }> => {
        try {
            const base64File = await fileToBase64(file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file: base64File, path: safePath })
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'File upload failed');
                } else {
                    const errorText = await response.text();
                    throw new Error(`File upload failed: ${errorText.substring(0, 100)}`);
                }
            }
            const data = await response.json();
            return { url: data.url, host: data.host };
        } catch (err: any) {
            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            throw new Error("Upload failed: " + err.message);
        }
    };
    return attempt();
};
