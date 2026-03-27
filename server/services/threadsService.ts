import { ThreadsAPI } from 'threads-api';
import fs from 'fs';
import path from 'path';

export interface ThreadsTemplateMetadata {
    id: string;
    title: string;
    description: string;
    tags: string[];
    timestamp: string;
    author: string;
    category: string;
    price: string;
    demoLink?: string;
}

export class ThreadsService {
    private api: ThreadsAPI;
    private username: string;
    private userId: string | null = null;

    constructor() {
        this.username = process.env.THREADS_USERNAME || '';
        const password = process.env.THREADS_PASSWORD || '';
        
        this.api = new ThreadsAPI({
            username: this.username,
            password: password,
        });
    }

    public isConfigured(): boolean {
        return !!this.username && !!process.env.THREADS_PASSWORD;
    }

    private async ensureLogin() {
        if (!this.userId) {
            this.userId = await this.api.getUserIDfromUsername(this.username);
        }
    }

    public async publishTemplate(images: Buffer[], metadata: ThreadsTemplateMetadata): Promise<{ postId: string; mediaUrls: string[] }> {
        await this.ensureLogin();

        const caption = this.formatCaption(metadata);
        
        try {
            let attachment: any;
            if (images.length === 1) {
                attachment = {
                    image: {
                        type: 'image/jpeg',
                        data: images[0]
                    }
                };
            } else {
                attachment = {
                    sidecar: images.map(img => ({
                        type: 'image/jpeg',
                        data: img
                    }))
                };
            }

            const result = await this.api.publish({
                text: caption,
                attachment
            });

            const postId = typeof result === 'string' ? result : (result as any)?.id || (result as any)?.pk || (result as any)?.code;
            if (!postId) throw new Error('Failed to get post ID from Threads API');

            await new Promise(resolve => setTimeout(resolve, 2000));

            const postDetails = await this.api.getThreads(postId); 
            const post = postDetails.containing_thread.thread_items[0]?.post;
            
            let mediaUrls: string[] = [];
            if (post?.carousel_media) {
                mediaUrls = post.carousel_media.map((m: any) => m.image_versions2?.candidates[0]?.url).filter(Boolean);
            } else if (post?.image_versions2) {
                mediaUrls = [post.image_versions2.candidates[0]?.url].filter(Boolean);
            }

            return { postId, mediaUrls };
        } catch (error: any) {
            throw error;
        }
    }

    public async fetchTemplates(): Promise<ThreadsTemplateMetadata[]> {
        await this.ensureLogin();
        if (!this.userId) throw new Error('Could not get Threads User ID');

        const threads = await this.api.getUserProfileThreads(this.userId);
        const templates: ThreadsTemplateMetadata[] = [];

        for (const thread of threads) {
            const post = thread.thread_items[0]?.post;
            if (!post) continue;

            const caption = post.caption?.text || '';
            const metadata = this.parseCaption(caption);
            
            if (metadata) {
                const mediaUrl = post.image_versions2?.candidates[0]?.url || '';
                templates.push({
                    ...metadata,
                    demoLink: mediaUrl
                });
            }
        }
        return templates;
    }

    public async getTemplateById(postId: string): Promise<ThreadsTemplateMetadata | null> {
        await this.ensureLogin();
        const thread = await this.api.getThreads(postId);
        const post = thread.containing_thread.thread_items[0]?.post;
        if (!post) return null;

        const caption = post.caption?.text || '';
        const metadata = this.parseCaption(caption);
        if (!metadata) return null;

        const mediaUrl = post.image_versions2?.candidates[0]?.url || '';
        return {
            ...metadata,
            demoLink: mediaUrl
        };
    }

    public async deleteTemplate(postId: string): Promise<boolean> {
        await this.ensureLogin();
        try {
            // Some versions of threads-api use delete, others use deletePost
            // We'll try to find the correct method
            if (typeof (this.api as any).delete === 'function') {
                await (this.api as any).delete(postId);
            } else if (typeof (this.api as any).deletePost === 'function') {
                await (this.api as any).deletePost(postId);
            } else {
                throw new Error('Delete method not found in Threads API');
            }
            return true;
        } catch (error: any) {
            console.error(`[Threads] Failed to delete post ${postId}:`, error.message);
            return false;
        }
    }

    private formatCaption(metadata: ThreadsTemplateMetadata): string {
        return `
[TEMPLR_DATA]
id: ${metadata.id}
title: ${metadata.title}
description: ${metadata.description}
tags: ${metadata.tags.join(', ')}
author: ${metadata.author}
category: ${metadata.category}
price: ${metadata.price}
timestamp: ${metadata.timestamp}
[/TEMPLR_DATA]
        `.trim();
    }

    private parseCaption(caption: string): ThreadsTemplateMetadata | null {
        const match = caption.match(/\[TEMPLR_DATA\]([\s\S]*?)\[\/TEMPLR_DATA\]/);
        if (!match) return null;

        const dataStr = match[1].trim();
        const lines = dataStr.split('\n');
        const metadata: any = {};

        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                const cleanKey = key.trim();
                
                if (cleanKey === 'tags') {
                    metadata[cleanKey] = value.split(',').map(t => t.trim()).filter(Boolean);
                } else {
                    metadata[cleanKey] = value;
                }
            }
        }

        return metadata as ThreadsTemplateMetadata;
    }
}

export const threadsService = new ThreadsService();
