import { repoManager, uploadToPasteRs } from './repoService';

interface TemplateMetadata {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  imageUrl: string;
  bannerUrl: string;
  category: string;
  tags: string[];
  author: string;
  created_at: string;
  price: string;
  likes: number;
  views: number;
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

  private readonly MOCK_TEMPLATES: TemplateMetadata[] = [
    {
      id: 'fluid-fitness-01',
      title: 'Vanguard Fitness Dashboard',
      description: 'A high-performance fitness tracking dashboard with real-time metrics and biometric data visualization.',
      fileUrl: 'https://fluid-fitness.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1920&auto=format&fit=crop',
      category: 'SaaS',
      tags: ['Dashboard', 'Fitness', 'Dark UI', 'React'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 1240,
      views: 8500
    },
    {
      id: 'fluid-fitness-02',
      title: 'Aura Meditation App',
      description: 'Minimalist meditation and mindfulness application with atmospheric soundscapes and breathing guides.',
      fileUrl: 'https://aura-meditation.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1920&auto=format&fit=crop',
      category: 'Mobile',
      tags: ['Meditation', 'Mindfulness', 'Glassmorphism', 'iOS'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 890,
      views: 4200
    },
    {
      id: 'fluid-fitness-03',
      title: 'Titan Strength Trainer',
      description: 'Brutalist design for heavy lifting and strength training. Focused on raw data and performance tracking.',
      fileUrl: 'https://titan-strength.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1920&auto=format&fit=crop',
      category: 'Brutalist',
      tags: ['Strength', 'Gym', 'Typography', 'Performance'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 2100,
      views: 12000
    },
    {
      id: 'fluid-fitness-04',
      title: 'Zenith Yoga Studio',
      description: 'Elegant and organic landing page for boutique yoga studios. Features fluid animations and soft palettes.',
      fileUrl: 'https://zenith-yoga.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1920&auto=format&fit=crop',
      category: 'Landing Page',
      tags: ['Yoga', 'Wellness', 'Organic', 'Animations'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 560,
      views: 3100
    },
    {
      id: 'fluid-fitness-05',
      title: 'Pulse Cardio Tracker',
      description: 'Dynamic cardio tracking interface with live heart rate monitoring and route mapping.',
      fileUrl: 'https://pulse-cardio.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1530143311094-34d807799e8f?q=80&w=1920&auto=format&fit=crop',
      category: 'SaaS',
      tags: ['Cardio', 'Running', 'Maps', 'Live Data'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 1450,
      views: 9200
    },
    {
      id: 'fluid-fitness-06',
      title: 'Omega Nutrition Planner',
      description: 'Comprehensive nutrition and meal planning tool with macro tracking and recipe discovery.',
      fileUrl: 'https://omega-nutrition.vercel.app',
      imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1920&auto=format&fit=crop',
      category: 'SaaS',
      tags: ['Nutrition', 'Diet', 'Planning', 'Recipes'],
      author: 'Fluid Fitness Team',
      created_at: new Date().toISOString(),
      price: 'Free',
      likes: 780,
      views: 5400
    }
  ];

  private readonly BATCH_SIZE = 500;
  private readonly JSON_HOSTING_API = 'https://jsonhosting.com/api/json';
  private registryLoaded = false;

  constructor() {
    this.loadRegistry();
  }

  private async ensureRegistryLoaded() {
    if (!this.registryLoaded) {
      await this.loadRegistry();
    }
  }

  private async loadRegistry() {
    try {
      // Try to load from GitHub repo first
      const content = await repoManager.getFile('master_registry.json');
      if (content) {
        const parsed = JSON.parse(content);
        this.registry = {
          batches: parsed.batches || [],
          totalTemplates: parsed.totalTemplates || 0,
          lastUpdated: parsed.lastUpdated || new Date().toISOString()
        };
        console.log('Loaded master registry from GitHub');
      }
      this.registryLoaded = true;
    } catch (e) {
      console.log('No master registry found, starting fresh');
      this.registryLoaded = true;
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

  public async getRegistry() {
    await this.ensureRegistryLoaded();
    if (this.registry.batches.length === 0) {
      return {
        ...this.registry,
        totalTemplates: this.MOCK_TEMPLATES.length
      };
    }
    return this.registry;
  }

  public async addTemplate(template: TemplateMetadata) {
    await this.ensureRegistryLoaded();
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
    await this.ensureRegistryLoaded();
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
    await this.ensureRegistryLoaded();
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
    await this.ensureRegistryLoaded();
    
    // Check mock templates first if registry is empty
    if (this.registry.batches.length === 0) {
      const mock = this.MOCK_TEMPLATES.find(t => t.id === templateId);
      if (mock) return mock;
    }

    for (const batch of this.registry.batches) {
      const content = await this.fetchBatchContent(batch.url);
      if (content && content.templates) {
        const template = content.templates.find((t: any) => t.id === templateId);
        if (template) return template;
      }
    }
    return null;
  }

  public async getTemplates(offset: number, limit: number, category?: string, searchQuery?: string) {
    await this.ensureRegistryLoaded();
    
    let allTemplates: TemplateMetadata[] = [];

    // If we have no batches, use mock templates as fallback
    if (this.registry.batches.length === 0) {
      allTemplates = [...this.MOCK_TEMPLATES];
    } else {
      // Fetch all batches (in a real app with thousands of templates, this would need a proper database)
      // For now, since it's a fallback, we fetch all to correctly apply filters and pagination
      const batchPromises = this.registry.batches.map(batch => this.fetchBatchContent(batch.url));
      const batchContents = await Promise.all(batchPromises);
      
      for (const content of batchContents) {
        if (content && content.templates) {
          allTemplates.push(...content.templates);
        }
      }
    }

    // Apply filters
    if (category && category !== 'All') {
      allTemplates = allTemplates.filter((t: any) => t.category === category);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      allTemplates = allTemplates.filter((t: any) => 
        t.title?.toLowerCase().includes(q) || 
        t.description?.toLowerCase().includes(q)
      );
    }

    // Sort by newest
    allTemplates.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allTemplates.slice(offset, offset + limit);
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
      console.error(`Upload to JSONHosting failed, trying paste.rs...`, e);
      try {
        const pasteUrl = await uploadToPasteRs(JSON.stringify(content));
        // Return a mock object that matches the expected structure
        return {
          id: `paste_${Date.now()}`,
          editKey: 'none',
          rawUrl: pasteUrl
        };
      } catch (pasteError) {
        console.error('Paste.rs backup failed:', pasteError);
      }
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
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
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
