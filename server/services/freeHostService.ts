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
  private readonly PROVIDERS = ['JSONHosting', 'PlainRaw', 'StaticSave', 'TiinyHost'];

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
      const provider = this.PROVIDERS[Math.floor(Math.random() * this.PROVIDERS.length)];
      const batchId = `batch_${Date.now()}`;
      
      // Initial batch content
      const batchContent = [template];
      const url = await this.uploadToProvider(provider, batchContent);

      if (url) {
        this.registry.batches.push({
          id: batchId,
          url,
          provider,
          count: 1
        });
        this.registry.totalTemplates++;
        await this.saveRegistry();
      }
    } else {
      // Update existing batch
      const batchContent = await this.fetchBatchContent(lastBatch.url);
      if (batchContent) {
        batchContent.push(template);
        const newUrl = await this.updateOnProvider(lastBatch.provider, lastBatch.url, batchContent);
        
        if (newUrl) {
          lastBatch.url = newUrl;
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
      
      if (batchContent) {
        const index = batchContent.findIndex((t: any) => t.id === templateId);
        if (index !== -1) {
          batchContent.splice(index, 1);
          
          if (batchContent.length === 0) {
            // Remove empty batch
            this.registry.batches.splice(i, 1);
          } else {
            // Update batch
            const newUrl = await this.updateOnProvider(batch.provider, batch.url, batchContent);
            if (newUrl) {
              batch.url = newUrl;
              batch.count = batchContent.length;
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

  public async getTemplates(page: number, limit: number, category?: string, searchQuery?: string) {
    // For now, we'll focus on pagination. Filtering across batches is expensive.
    // We'll fetch the necessary batches to satisfy the page/limit.
    
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
        if (content) {
          // Apply filters if any
          let filtered = content;
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
      if (currentCount >= endIdx && !category && !searchQuery) break; // Optimization for non-filtered requests
    }
    
    // Final slice for the specific page
    return templates.slice(0, limit);
  }

  private async uploadToProvider(provider: string, content: any[]): Promise<string | null> {
    console.log(`Uploading batch to ${provider}...`);
    const jsonStr = JSON.stringify(content);

    try {
      switch (provider) {
        case 'JSONHosting':
          // Mocking JSONHosting API
          // return await this.postToJSONHosting(jsonStr);
          return `https://jsonhosting.com/raw/${Math.random().toString(36).substring(7)}.json`;
        case 'PlainRaw':
          return `https://plainraw.com/r/${Math.random().toString(36).substring(7)}`;
        case 'StaticSave':
          return `https://staticsave.com/raw/${Math.random().toString(36).substring(7)}`;
        default:
          return `https://freehost.com/${Math.random().toString(36).substring(7)}.json`;
      }
    } catch (e) {
      console.error(`Upload to ${provider} failed:`, e);
      return null;
    }
  }

  private async updateOnProvider(provider: string, oldUrl: string, content: any[]): Promise<string | null> {
    // Most free hosts don't support updates, so we just re-upload and get a new URL
    return await this.uploadToProvider(provider, content);
  }

  private async fetchBatchContent(url: string): Promise<any[] | null> {
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
