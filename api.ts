
import { createClient } from '@supabase/supabase-js';
import { Template as MockTemplate, templates as MockTemplates } from './db';

// ==========================================
//   TEMPLR PRODUCTION ENGINE v9.36
// ==========================================

const PROVIDED_URL = 'https://risynxckpsgqgprnaccr.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpc3lueGNrcHNncWdwcm5hY2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY4MTQsImV4cCI6MjA3Nzg0MjgxNH0.Ta6cfgjZf7AMLoMzIpIIsGxgAefQvTRTSVsrpROVoak';

const getSupabaseConfig = () => {
    let url = '';
    let key = '';
    try {
        if (typeof window !== 'undefined') {
            url = localStorage.getItem('templr_project_url') || '';
            key = localStorage.getItem('templr_anon_key') || '';
        }
    } catch(e) {}

    if (!url || !key) {
        try {
            if (typeof process !== 'undefined' && process.env) {
                url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            }
        } catch (e) {}
    }

    if (!url || url.includes('placeholder')) url = PROVIDED_URL;
    if (!key || key.includes('placeholder')) key = PROVIDED_KEY;

    return { url, key };
};

const config = getSupabaseConfig();
export const isApiConfigured = config.url && config.url !== 'https://placeholder.supabase.co';

export const supabase = createClient(
    config.url,
    config.key, 
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

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
  sourceCode?: string;
  initialStatus?: 'pending_review' | 'draft' | 'approved';
}

export type Session = {
  user: {
    id: string;
    email?: string;
    user_metadata: {
        avatar_url?: string;
        full_name?: string;
    };
  };
};

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT';
export type Template = MockTemplate;

export interface CreatorStats {
    name: string;
    email: string;
    totalViews: number;
    totalLikes: number;
    templateCount: number;
    avatarUrl: string;
    role: string;
}

const mapTemplate = (data: any): Template => {
    let inferredType = data.file_type || 'link';
    const hasSource = data.source_code && data.source_code.trim().length > 0;
    const hasLink = data.file_url && data.file_url.trim().length > 0 && data.file_url !== '#';
    const hasZip = data.file_url && (data.file_url.endsWith('.zip') || data.file_url.endsWith('.rar'));

    if (hasZip) inferredType = 'zip';
    else if (hasSource && !hasLink) inferredType = 'code';
    else if (!hasSource && hasLink) inferredType = 'link';
    else if (hasSource && hasLink) inferredType = 'code';
    else if (!hasSource && !hasLink) inferredType = 'image';

    return {
        id: data.id,
        title: data.title,
        author: data.author_name || 'Anonymous', 
        authorAvatar: data.author_avatar,
        imageUrl: data.image_url,
        bannerUrl: data.banner_url || data.image_url,
        galleryImages: data.gallery_images || [],
        videoUrl: data.video_url,
        likes: data.likes || 0,
        views: data.views || 0,
        isLiked: false, 
        category: data.category,
        tags: data.tags || [],
        description: data.description,
        price: data.price,
        fileUrl: data.file_url,
        fileName: data.file_name,
        fileType: inferredType,
        fileSize: data.file_size,
        sourceCode: data.source_code || '', 
        status: data.status || 'pending_review',
        sales: data.sales || 0,
        earnings: data.earnings || 0,
        createdAt: new Date(data.created_at).getTime()
    };
};

export const getPublicTemplates = async (
    page: number = 0, 
    limit: number = 6, 
    searchQuery: string = '', 
    category: string = 'All',
    sortBy: 'newest' | 'popular' | 'likes' = 'newest'
): Promise<{ data: Template[], hasMore: boolean }> => {
    
    if (!isApiConfigured) {
        if (page === 0) return { data: MockTemplates, hasMore: false };
        return { data: [], hasMore: false };
    }

    let query = supabase
        .from('templates')
        .select('*')
        .eq('status', 'approved');

    if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,author_name.ilike.%${searchQuery}%`);
    }

    if (category !== 'All') {
        if (category === 'Popular') {
            query = query.gt('views', 100); 
        } else if (category === 'Newest') {
             // Handled by default sort
        } else {
            query = query.eq('category', category);
        }
    }

    if (sortBy === 'popular') {
        query = query.order('views', { ascending: false });
    } else if (sortBy === 'likes') {
        query = query.order('likes', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const from = page * limit;
    const to = from + limit;
    
    const { data, error } = await query.range(from, to - 1);

    if (error) {
        console.error("Fetch error:", error);
        return { data: [], hasMore: false };
    }

    const hasMore = data.length === limit;

    return { 
        data: data.map(mapTemplate), 
        hasMore 
    };
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
    if (!isApiConfigured) return [];

    const { data, error } = await supabase
        .from('templates')
        .select('author_name, author_email, author_avatar, views, likes')
        .eq('status', 'approved');

    if (error || !data) return [];

    const statsMap = new Map<string, CreatorStats>();

    data.forEach((t: any) => {
        const email = t.author_email || 'anon';
        const current = statsMap.get(email) || {
            name: t.author_name || 'Anonymous',
            email: email,
            totalViews: 0,
            totalLikes: 0,
            templateCount: 0,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author_name || 'A')}&background=random`,
            role: 'Creator'
        };

        if (t.author_avatar) {
            current.avatarUrl = t.author_avatar;
        }

        current.totalViews += (t.views || 0);
        current.totalLikes += (t.likes || 0);
        current.templateCount += 1;
        statsMap.set(email, current);
    });

    const allCreators = Array.from(statsMap.values())
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 20);

    for (let i = allCreators.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCreators[i], allCreators[j]] = [allCreators[j], allCreators[i]];
    }

    return allCreators.slice(0, 4).map(c => ({
        ...c,
        role: c.totalViews > 1000 ? 'Top Seller' : 'Rising Star'
    }));
};

export const listenForUserTemplates = async (userEmail: string, callback: (templates: Template[]) => void) => {
    if (!userEmail) { callback([]); return { unsubscribe: () => {} }; }

    const fetchUserTemplates = async () => {
        const { data } = await supabase
            .from('templates')
            .select('*')
            .eq('author_email', userEmail)
            .order('created_at', { ascending: false });
        if (data) callback(data.map(mapTemplate));
    };

    fetchUserTemplates();
    const interval = setInterval(fetchUserTemplates, 5000);
    return { unsubscribe: () => clearInterval(interval) };
};

export const addTemplate = async (templateData: NewTemplateData, user?: Session['user'] | null): Promise<void> => {
    if (!user || !user.email) throw new Error("Authentication required.");

    const dbPayload: any = {
        title: templateData.title,
        image_url: templateData.imageUrl,
        banner_url: templateData.bannerUrl || templateData.imageUrl,
        category: templateData.category,
        price: templateData.price,
        author_name: user.user_metadata?.full_name || user.email.split('@')[0],
        author_email: user.email,
        author_avatar: user.user_metadata?.avatar_url,
        file_name: templateData.fileName || 'Project Files',
        file_type: templateData.fileType || 'link',
        file_size: templateData.fileSize || 0,
        status: templateData.initialStatus || 'approved',
        tags: templateData.tags || [],
        description: templateData.description,
        video_url: templateData.videoUrl,
        gallery_images: templateData.galleryImages,
        source_code: templateData.sourceCode,
        file_url: templateData.fileUrl || templateData.externalLink
    };

    try {
        const { error } = await supabase.from('templates').insert(dbPayload);
        if (error) throw error;
    } catch (error: any) {
        const msg = error.message?.toLowerCase() || '';
        console.error("Database insert failed:", msg);
        
        // Surgical schema compatibility
        if (msg.includes('column') && (msg.includes('not find') || msg.includes('does not exist'))) {
            const legacyPayload = { ...dbPayload };
            
            // Only delete columns that the DB explicitly complained about
            if (msg.includes('video_url')) delete legacyPayload.video_url;
            if (msg.includes('tags')) delete legacyPayload.tags;
            if (msg.includes('author_avatar')) delete legacyPayload.author_avatar;
            if (msg.includes('source_code')) delete legacyPayload.source_code;
            if (msg.includes('gallery_images')) delete legacyPayload.gallery_images;

            // If we deleted nothing but there's still an error, it's a generic column error
            if (JSON.stringify(dbPayload) === JSON.stringify(legacyPayload)) {
                 // Try a broad strip if retry logic fails
                 delete legacyPayload.video_url;
                 delete legacyPayload.tags;
            }

            const { error: retryError } = await supabase.from('templates').insert(legacyPayload);
            if (retryError) throw new Error("Database schema mismatch. Run the SQL Fix Script in 'Connect Backend' guide.");
        } else {
            throw new Error(error.message);
        }
    }
};

export const updateTemplateData = async (id: string, data: Partial<NewTemplateData>, userEmail: string): Promise<void> => {
    const dbPayload: any = {};
    if (data.title) dbPayload.title = data.title;
    if (data.description) dbPayload.description = data.description;
    if (data.category) dbPayload.category = data.category;
    if (data.tags) dbPayload.tags = data.tags;
    if (data.externalLink) dbPayload.file_url = data.externalLink;
    if (data.imageUrl) dbPayload.image_url = data.imageUrl;
    if (data.bannerUrl) dbPayload.banner_url = data.bannerUrl;
    if (data.videoUrl) dbPayload.video_url = data.videoUrl;
    if (data.sourceCode) dbPayload.source_code = data.sourceCode;
    if (data.fileUrl) dbPayload.file_url = data.fileUrl;

    const { error } = await supabase
        .from('templates')
        .update(dbPayload)
        .eq('id', id)
        .eq('author_email', userEmail);

    if (error) throw new Error(error.message);
};

export const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
  const { data, error } = await supabase.auth.updateUser({
    data: updates
  });
  if (error) throw new Error(error.message);

  if (data.user?.email) {
      try {
          const syncUpdates: any = {};
          if (updates.full_name) syncUpdates.author_name = updates.full_name;
          if (updates.avatar_url) syncUpdates.author_avatar = updates.avatar_url;
          
          await supabase
            .from('templates')
            .update(syncUpdates)
            .eq('author_email', data.user.email);
      } catch (e) {
          console.warn("Profile sync warning:", e);
      }
  }

  return data;
};

export const updateTemplate = async (templateId: string, updates: Partial<Template>): Promise<void> => {
    try {
        const dbUpdates: any = {};
        if (updates.views !== undefined) dbUpdates.views = updates.views;
        if (updates.likes !== undefined) dbUpdates.likes = updates.likes;
        await supabase.from('templates').update(dbUpdates).eq('id', templateId);
    } catch(e) {}
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    const { error } = await supabase.from('templates').delete().eq('id', templateId);
    if (error) throw new Error(error.message);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'delete', id: templateId } }));
    }
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
    const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('assets').getPublicUrl(path);
    return data.publicUrl;
};

export const onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    supabase.auth.onAuthStateChange((event, session: any) => {
        const mappedSession = session ? {
            user: {
                id: session.user.id,
                email: session.user.email,
                user_metadata: session.user.user_metadata
            }
        } : null;
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', mappedSession);
    });
    return { data: { subscription: { unsubscribe: () => {} } } };
};

export const signInWithEmail = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    return data;
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name } }
    });
    if (error) throw error;
    return data;
};

export const signOut = async () => {
    await supabase.auth.signOut();
};

export const seedDatabase = async (user: Session['user']): Promise<void> => {
    if (!user.email) throw new Error("No user email");
    const payloads = MockTemplates.map(t => ({
        title: t.title,
        author_name: t.author,
        author_email: user.email, 
        author_avatar: user.user_metadata?.avatar_url,
        image_url: t.imageUrl,
        banner_url: t.bannerUrl,
        category: t.category,
        description: t.description,
        price: t.price,
        tags: t.tags || [],
        file_type: t.fileType,
        source_code: t.sourceCode,
        file_url: t.fileUrl,
        status: 'approved',
        likes: t.likes,
        views: t.views,
        file_size: 1024 * 1024 * 5
    }));
    
    try {
        const { error } = await supabase.from('templates').insert(payloads);
        if (error) throw error;
    } catch(e: any) {
        console.warn("Seed error, trying minimal payload");
        const cleanPayloads = payloads.map(({ author_avatar, tags, source_code, video_url, ...rest }: any) => rest);
        const { error: retryError } = await supabase.from('templates').insert(cleanPayloads);
        if (retryError) throw new Error(retryError.message);
    }
};
