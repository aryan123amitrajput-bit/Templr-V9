
import { repoManager, RepoConfig } from './repoService';

export interface HostHealth {
  id: string;
  type: 'github' | 'gitlab';
  name: string;
  isReachable: boolean;
  latency: number;
  lastChecked: string;
}

class TraffService {
  private hosts: HostHealth[] = [];

  constructor() {
    this.initializeHosts();
  }

  private async initializeHosts() {
    const repos = await repoManager.getAllRepos();
    this.hosts = repos.map((repo, index) => ({
      id: `host-${index}`,
      type: repo.type,
      name: repo.type === 'github' ? `${repo.owner}/${repo.repo}` : repo.projectId || 'GitLab Project',
      isReachable: true,
      latency: 0,
      lastChecked: new Date().toISOString()
    }));
  }

  public async auditHosts(): Promise<HostHealth[]> {
    const repos = await repoManager.getAllRepos();
    const auditResults: HostHealth[] = [];

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const start = Date.now();
      let reachable = false;

      try {
        // Simple check: try to fetch registry
        await repoManager.getRegistry(repo, false);
        reachable = true;
      } catch (e) {
        reachable = false;
      }

      const health: HostHealth = {
        id: `host-${i}`,
        type: repo.type,
        name: repo.type === 'github' ? `${repo.owner}/${repo.repo}` : repo.projectId || 'GitLab Project',
        isReachable: reachable,
        latency: Date.now() - start,
        lastChecked: new Date().toISOString()
      };
      auditResults.push(health);
    }

    this.hosts = auditResults;
    return auditResults;
  }

  public getHosts(): HostHealth[] {
    return this.hosts;
  }
}

export const traffService = new TraffService();
