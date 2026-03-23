
import { repoManager } from './repoService';
import { freeHostService } from './freeHostService';
import { traffService } from './traffService';
import { templrAuditor } from './templrAuditor';

class TemplrBackend {
  public async getStats() {
    const registry = await repoManager.getMergedRegistry();
    const freeRegistry = freeHostService.getRegistry();
    const hosts = traffService.getHosts();
    
    return {
      totalTemplates: registry.length + (freeRegistry.batches.length * 100), // Approximate
      activeHosts: hosts.filter(h => h.isReachable).length,
      totalHosts: hosts.length,
      storageStatus: 'unlimited'
    };
  }

  public async syncAll() {
    // Logic to sync between GitHub and GitLab if needed
  }
}

export const templrBackend = new TemplrBackend();
