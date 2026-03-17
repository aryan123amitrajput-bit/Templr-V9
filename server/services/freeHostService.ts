import { repoManager } from './repoService';

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
      const content = await repoManager.getFile('master_registry.json');
      if (content) {
        this.registry = JSON.parse(content);
        console.log('Loaded master registry from GitHub');
      }
    } catch (e) {
      console.log('No master registry found, starting fresh');
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

  public async addTemplate(template: TemplateMetadata) {
    let lastBatch = this.registry.batches[this.registry.batches.length - 1];

    if (!lastBatch || lastBatch.count >= this.BATCH_SIZE) {
      // Create new batch
      const batchContent = { templates: [template] };
      const result = await this.uploadToJSONHosting(batchContent);

      if (result) {
        this.registry.batches.push({
          id: result.id,
          url: result.rawUrl,
          editKey: result.editKey,
          provider: 'JSONHosting',
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
        const success = await this.updateOnJSONHosting(lastBatch.id, lastBatch.editKey, batchContent);
        
        if (success) {
          lastBatch.count++;
          this.registry.totalTemplates++;
          await this.saveRegistry();
        }
      }
    }
  }

  public async deleteTemplate(templateId: string) {
    for (let i = 0; i < this.registry.batches.length; i++) {
      const batch = this.registry.batches[i];
      const batchContent = await this.fetchBatchContent(batch.url);
      
      if (batchContent && batchContent.templates) {
        const index = batchContent.templates.findIndex((t: any) => t.id === templateId);
        if (index !== -1) {
          batchContent.templates.splice(index, 1);
          
          if (batchContent.templates.length === 0) {
            // Remove empty batch from host
            await this.deleteFromJSONHosting(batch.id, batch.editKey);
            // Remove empty batch from registry
            this.registry.batches.splice(i, 1);
          } else {
            // Update batch
            const success = await this.updateOnJSONHosting(batch.id, batch.editKey, batchContent);
            if (success) {
              batch.count = batchContent.templates.length;
            }
          }
          
          this.registry.totalTemplates--;
          await this.saveRegistry();
          return true;
        }
      }
    }
    return false;
  }

  public async updateTemplate(templateId: string, updates: any) {
    for (const batch of this.registry.batches) {
      const batchContent = await this.fetchBatchContent(batch.url);
      if (batchContent && batchContent.templates) {
        const index = batchContent.templates.findIndex((t: any) => t.id === templateId);
        if (index !== -1) {
          batchContent.templates[index] = { ...batchContent.templates[index], ...updates };
          const success = await this.updateOnJSONHosting(batch.id, batch.editKey, batchContent);
          return success;
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
    
    for (const batch of this.registry.batches) {
      const batchStart = currentCount;
      const batchEnd = currentCount + batch.count;
      
      // Check if this batch overlaps with our requested range
      if (batchEnd > startIdx && batchStart < endIdx) {
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
        }
      }
      
      currentCount += batch.count;
      if (currentCount >= endIdx && !category && !searchQuery) break;
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
      console.error(`Upload to JSONHosting failed:`, e);
    }
    return null;
  }

  private async updateOnJSONHosting(id: string, editKey: string, content: any): Promise<boolean> {
    console.log(`Updating batch ${id} on JSONHosting...`);
    try {
      const response = await fetch(`${this.JSON_HOSTING_API}/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Edit-Key': editKey
        },
        body: JSON.stringify(content)
      });

      return response.ok;
    } catch (e) {
      console.error(`Update on JSONHosting failed:`, e);
    }
    return false;
  }

  private async deleteFromJSONHosting(id: string, editKey: string): Promise<boolean> {
    console.log(`Deleting batch ${id} from JSONHosting...`);
    try {
      const response = await fetch(`${this.JSON_HOSTING_API}/${id}`, {
        method: 'DELETE',
        headers: { 'X-Edit-Key': editKey }
      });

      return response.ok;
    } catch (e) {
      console.error(`Delete from JSONHosting failed:`, e);
    }
    return false;
  }

  private async fetchBatchContent(url: string): Promise<any | null> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error(`Failed to fetch batch from ${url}:`, e);
    }
    return null;
  }
}

export const freeHostService = new FreeHostService();
