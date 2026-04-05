import { repoManager } from './repoService';
import { telegramService } from './telegramService';
import { uploadToCatbox } from './catboxService';
import { uploadToPasteRs } from './pasteService';

interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  preview_url: string;
  image_preview: string;
  banner_url?: string;
  gallery_images?: string[];
  file_url?: string;
  tags: string[];
  creator: string;
  creator_email?: string;
  creator_avatar?: string;
  created_at: string;
  category?: string;
  price?: number;
  stats: {
    likes: number;
    views: number;
  };
}

interface Batch {
  id: string;
  url: string;
  editKey: string;
  provider: string;
  count: number;
}

interface MasterRegistry {
  batches: Batch[];
  totalTemplates: number;
  lastUpdated: string;
}

class FreeHostService {
  private registry: MasterRegistry = {
    batches: [],
    totalTemplates: 0,
    lastUpdated: new Date().toISOString()
  };

  private readonly BATCH_SIZE = 500;
  private readonly JSON_HOSTING_API = 'https://jsonhosting.com/api/json';

  constructor() {
    this.loadRegistry();
  }

  private async loadRegistry() {
    try {
      // Try to load from GitHub repo first
      console.log('[FreeHostService] Loading registry...');
      const content = await repoManager.getFile('master_registry.json');
      if (content) {
        const parsed = JSON.parse(content);
        this.registry = {
          batches: parsed.batches || [],
          totalTemplates: parsed.totalTemplates || 0,
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
        console.log(`[FreeHostService] Loaded master registry from GitHub. Batches: ${this.registry.batches.length}`);
      } else {
        console.log('[FreeHostService] No content found in master_registry.json');
      }
    } catch (e) {
      console.error('[FreeHostService] Error loading registry:', e);
    }
  }

  private async saveRegistry() {
    this.registry.lastUpdated = new Date().toISOString();
    try {
      await repoManager.updateFile('master_registry.json', JSON.stringify(this.registry, null, 2));
      console.log('Saved master registry to GitHub');
    } catch (e) {
      console.error('Failed to save master registry:', e);
    }
  }

  public getRegistry() {
    return this.registry;
  }

  private async uploadBatch(content: any): Promise<{ id: string, editKey: string, rawUrl: string, provider: string } | null> {
    const jsonString = JSON.stringify(content);
    const buffer = Buffer.from(jsonString, 'utf-8');
    const filename = `batch_${Date.now()}.json`;

    // 1. Try JSONHosting (Standard)
    try {
      const result = await this.uploadToJSONHosting(content);
      if (result) return { ...result, provider: 'JSONHosting' };
    } catch (e) {
      console.warn('[FreeHostService] JSONHosting failed, trying Telegram...');
    }

    // 2. Try Telegram (Reliable)
    if (telegramService.isConfigured()) {
      try {
        const tgUri = await telegramService.uploadDocument(buffer, filename, 'application/json');
        return { 
          id: tgUri.split('/').pop() || 'tg', 
          editKey: 'none', 
          rawUrl: tgUri, 
          provider: 'Telegram' 
        };
      } catch (e) {
        console.warn('[FreeHostService] Telegram failed, trying Catbox...');
      }
    }

    // 3. Try Catbox
    try {
      const { direct_url } = await uploadToCatbox(buffer, filename, 'application/json');
      return { 
        id: direct_url.split('/').pop() || 'catbox', 
        editKey: 'none', 
        rawUrl: direct_url, 
        provider: 'Catbox' 
      };
    } catch (e) {
      console.warn('[FreeHostService] Catbox failed, trying Paste.rs...');
    }

    // 4. Try Paste.rs
    try {
      const url = await uploadToPasteRs(jsonString);
      return { 
        id: url.split('/').pop() || 'paste', 
        editKey: 'none', 
        rawUrl: url, 
        provider: 'Paste.rs' 
      };
    } catch (e) {
      console.error('[FreeHostService] All batch hosting providers failed');
    }

    return null;
  }

  public async addTemplate(template: TemplateMetadata) {
    let lastBatch = this.registry.batches[this.registry.batches.length - 1];

    if (!lastBatch || lastBatch.count >= this.BATCH_SIZE) {
      // Create new batch
      const batchContent = { templates: [template] };
      const result = await this.uploadBatch(batchContent);

      if (result) {
        this.registry.batches.push({
          id: result.id,
          url: result.rawUrl,
          editKey: result.editKey,
          provider: result.provider,
          count: 1
        });
        this.registry.totalTemplates++;
        await this.saveRegistry();
      }
    } else {
      // Update existing batch
      const batchContent = await this.fetchBatchContent(lastBatch.url);
      if (batchContent && batchContent.templates) {
        batchContent.templates.push(template);
        
        // If it's JSONHosting and we have an edit key, try to update in place
        if (lastBatch.provider === 'JSONHosting' && lastBatch.editKey !== 'none') {
          const success = await this.updateOnJSONHosting(lastBatch.id, lastBatch.editKey, batchContent);
          if (success) {
            if (typeof success === 'object') {
              lastBatch.id = success.id;
              lastBatch.url = success.rawUrl;
              lastBatch.editKey = success.editKey;
            }
            lastBatch.count++;
            this.registry.totalTemplates++;
            await this.saveRegistry();
            return;
          }
        }
        
        // Fallback: Upload as a new batch and replace the old one in the registry
        const result = await this.uploadBatch(batchContent);
        if (result) {
          lastBatch.id = result.id;
          lastBatch.url = result.rawUrl;
          lastBatch.editKey = result.editKey;
          lastBatch.provider = result.provider;
          lastBatch.count++;
          this.registry.totalTemplates++;
          await this.saveRegistry();
        }
      }
    }
  }

  public async deleteTemplate(templateId: string) {
    console.log(`[FreeHostService] Attempting to delete template: ${templateId}`);
    let registryUpdated = false;

    for (let i = this.registry.batches.length - 1; i >= 0; i--) {
      const batch = this.registry.batches[i];
      const batchContent = await this.fetchBatchContent(batch.url);
      
      if (!batchContent) {
        console.warn(`[FreeHostService] Batch ${batch.id} could not be fetched. It might be dead. Skipping for now.`);
        continue;
      }

      if (batchContent && batchContent.templates) {
        const index = batchContent.templates.findIndex((t: any) => t.id === templateId);
        if (index !== -1) {
          console.log(`[FreeHostService] Found template ${templateId} in batch ${batch.id}`);
          batchContent.templates.splice(index, 1);
          
          if (batchContent.templates.length === 0) {
            // Remove empty batch from host
            const deleted = await this.deleteFromJSONHosting(batch.id, batch.editKey);
            if (!deleted) {
                console.error(`[FreeHostService] Failed to delete batch ${batch.id} from host. Removing from registry anyway.`);
            }
            // Remove empty batch from registry
            this.registry.batches.splice(i, 1);
          } else {
            // Update batch
            const success = await this.updateOnJSONHosting(batch.id, batch.editKey, batchContent);
            if (success) {
              if (typeof success === 'object') {
                batch.id = success.id;
                batch.url = success.rawUrl;
                batch.editKey = success.editKey;
              }
              batch.count = batchContent.templates.length;
            } else {
                console.error(`[FreeHostService] Failed to update batch ${batch.id} on host`);
                return false;
            }
          }
          
          this.registry.totalTemplates--;
          registryUpdated = true;
          console.log(`[FreeHostService] Successfully deleted template ${templateId}`);
          break; // Found and deleted, no need to check other batches
        }
      }
    }

    if (registryUpdated) {
      await this.saveRegistry();
      return true;
    }

    console.log(`[FreeHostService] Template ${templateId} not found`);
    return false;
  }

  public async updateTemplate(templateId: string, updates: any) {
    for (const batch of this.registry.batches) {
      const batchContent = await this.fetchBatchContent(batch.url);
      if (batchContent && batchContent.templates) {
        const index = batchContent.templates.findIndex((t: any) => t.id === templateId);
        if (index !== -1) {
          batchContent.templates[index] = { ...batchContent.templates[index], ...updates };
          
          // Try to update in place if possible
          if (batch.provider === 'JSONHosting' && batch.editKey !== 'none') {
            const success = await this.updateOnJSONHosting(batch.id, batch.editKey, batchContent);
            if (success) {
              if (typeof success === 'object') {
                batch.id = success.id;
                batch.url = success.rawUrl;
                batch.editKey = success.editKey;
                await this.saveRegistry();
              }
              return true;
            }
          }
          
          // Fallback: Upload as new batch
          const result = await this.uploadBatch(batchContent);
          if (result) {
            batch.id = result.id;
            batch.url = result.rawUrl;
            batch.editKey = result.editKey;
            batch.provider = result.provider;
            await this.saveRegistry();
            return true;
          }
          return false;
        }
      }
    }
    return false;
  }

  public async getTemplateById(templateId: string) {
    for (const batch of this.registry.batches) {
      const content = await this.fetchBatchContent(batch.url);
      if (content && content.templates) {
        const template = content.templates.find((t: any) => t.id === templateId);
        if (template) return template;
      }
    }
    return null;
  }

  public async getTemplates(page: number, limit: number, category?: string, searchQuery?: string) {
    const startIdx = page * limit;
    const endIdx = startIdx + limit;
    
    let currentCount = 0;
    const templates: TemplateMetadata[] = [];
    const errors: string[] = [];
    
    for (const batch of this.registry.batches) {
      const batchStart = currentCount;
      const batchEnd = currentCount + batch.count;
      
      // Check if this batch overlaps with our requested range
      if (batchEnd > startIdx && batchStart < endIdx) {
        try {
          const content = await this.fetchBatchContent(batch.url);
          if (content && content.templates) {
            // Apply filters if any
            let filtered = content.templates;
            if (category && category !== 'All') {
              filtered = filtered.filter((t: any) => t.category === category);
            }
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              filtered = filtered.filter((t: any) => t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
            }
            
            templates.push(...filtered);
          } else {
            errors.push(`Batch ${batch.id} returned no templates or invalid format.`);
          }
        } catch (e: any) {
          errors.push(`Failed to fetch batch ${batch.id} from ${batch.url}: ${e.message}`);
        }
      }
      
      currentCount += batch.count;
      if (currentCount >= endIdx && !category && !searchQuery) break;
    }
    
    if (templates.length === 0 && errors.length > 0) {
        console.error(`[FreeHostService] No templates found and encountered errors: ${errors.join('; ')}`);
        // We don't throw here to avoid breaking the whole merge if other services work,
        // but we've logged the details.
    }

    return templates.slice(0, limit);
  }

  private async uploadToJSONHosting(content: any): Promise<{ id: string, editKey: string, rawUrl: string } | null> {
    console.log(`Uploading batch to JSONHosting...`);
    try {
      const response = await fetch(this.JSON_HOSTING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error(`Upload to JSONHosting failed`, e);
    }
    return null;
  }

  private async updateOnJSONHosting(id: string, editKey: string, content: any): Promise<{ id: string, editKey: string, rawUrl: string } | boolean> {
    console.log(`Updating batch ${id} on JSONHosting...`);
    try {
      const response = await fetch(`${this.JSON_HOSTING_API}/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Edit-Key': editKey
        },
        body: JSON.stringify(content)
      });

      if (response.ok) {
        return true;
      }

      const errText = await response.text();
      console.error(`[FreeHostService] Update failed with status ${response.status}:`, errText);
      
      // If PUT is not allowed or fails, fallback to DELETE and POST
      console.log(`[FreeHostService] Falling back to DELETE and POST for batch ${id}`);
      await this.deleteFromJSONHosting(id, editKey);
      const newBatch = await this.uploadToJSONHosting(content);
      if (newBatch) {
        return newBatch;
      }

    } catch (e) {
      console.error(`Update on JSONHosting failed:`, e);
    }
    return false;
  }

  private async deleteFromJSONHosting(id: string, editKey: string): Promise<boolean> {
    console.log(`[FreeHostService] Deleting batch ${id} from JSONHosting...`);
    try {
      const response = await fetch(`${this.JSON_HOSTING_API}/${id}`, {
        method: 'DELETE',
        headers: { 
          'X-Edit-Key': editKey,
          'Content-Type': 'application/json' 
        }
      });

      const text = await response.text();
      try {
        const result = JSON.parse(text);
        console.log(`[FreeHostService] JSONHosting delete response:`, result);
      } catch (e) {
        console.log(`[FreeHostService] JSONHosting delete response (text):`, text);
      }

      return response.ok;
    } catch (e) {
      console.error(`Delete from JSONHosting failed:`, e);
    }
    return false;
  }

  private async fetchBatchContent(url: string): Promise<any | null> {
    try {
      let fetchUrl = url;
      
      // Handle Telegram URLs
      if (url.startsWith('tg://')) {
        const { telegramService } = await import('./telegramService');
        fetchUrl = await telegramService.getFileDownloadUrl(url);
      }
      
      // Add cache buster to bypass any intermediate caching
      const cacheBuster = `?t=${Date.now()}`;
      fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&t=${Date.now()}` : `${fetchUrl}${cacheBuster}`;
      
      const response = await fetch(fetchUrl, { 
        signal: AbortSignal.timeout(15000), // Increased timeout for external hosts
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
    } catch (e: any) {
      console.error(`[FreeHostService] Failed to fetch batch from ${url}:`, e.message);
      throw e;
    }
  }
}

export const freeHostService = new FreeHostService();
