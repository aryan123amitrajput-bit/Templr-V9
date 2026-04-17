import { supabase } from './services/supabaseClient';
import { sendTelegramMessage } from './services/telegramService';

export type Session = any;
export type Template = any;
export type NewTemplateData = any;

export const getPublicTemplates = async (offset: number, limit: number) => {
    console.log('Fetching templates from Supabase...');
    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .range(offset, offset + limit - 1);
    
    if (error) {
        console.error('Supabase error:', error);
    } else {
        console.log('Supabase data:', data);
    }
    
    return { data: data || [], error: error?.message || null };
};

export const getTemplateById = async (id: string) => {
    return null;
};

export const onAuthStateChange = (callback: any) => {
    return supabase.auth.onAuthStateChange(callback);
};

export const signInWithEmail = async (e: string, p: string) => {
    return await supabase.auth.signInWithPassword({ email: e, password: p });
};

export const signUpWithEmail = async (e: string, p: string, n: string) => {
    return await supabase.auth.signUp({ email: e, password: p, options: { data: { name: n } } });
};

export const signOut = async () => {
    return await supabase.auth.signOut();
};

export const updateTemplateData = async (id: string, data: any, email: string) => {
    // ...
};

export const addTemplate = async (data: any, user: any) => {
    // ...
};

export const updateTemplate = async (id: string, data: any) => {
    // ...
};

export const setProStatus = async (status: boolean) => {
    // ...
};

export const updateUserUsage = async (count: number) => {
    // ...
};

export const uploadFile = async (file: File, path: string) => {
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            file: base64Data,
            path: path
        })
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return await response.json();
};

export const getFeaturedCreators = async () => {
    // Placeholder
    return [];
};

export const listenForUserTemplates = (email: string, callback: (templates: any[]) => void) => {
    // Placeholder
    return () => {};
};

export const deleteTemplate = async (id: string) => {
    // Placeholder
};

export const fixUrl = (url: string) => {
    return url;
};

export const updateUserProfile = async (userId: string, data: any) => {
    // Placeholder
};
