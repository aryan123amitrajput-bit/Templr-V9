
import { repoManager } from './repoService';
import { freeHostService } from './freeHostService';

export interface AuditReport {
  templateId: string;
  title: string;
  hosts: {
    id: string;
    reachable: boolean;
    url: string;
  }[];
  overallStatus: 'healthy' | 'at-risk' | 'unreachable';
  lastChecked: string;
}

class TemplrAuditor {
  private reports: AuditReport[] = [];

  public async runFullAudit(): Promise<AuditReport[]> {
    const registry = await repoManager.getMergedRegistry();
    const freeRegistry = freeHostService.getRegistry();
    const allTemplates = [...registry, ...(freeRegistry.batches.flatMap(b => []))]; // Simplified for now

    const results: AuditReport[] = [];

    for (const template of registry) {
      const hosts: { id: string; reachable: boolean; url: string }[] = [];
      const repos = await repoManager.getAllRepos();

      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        let reachable = false;
        let url = '';

        try {
          const t = await repoManager.getTemplateById(template.id);
          if (t) {
            reachable = true;
            url = t.preview_url || '';
          }
        } catch (e) {}

        hosts.push({
          id: `host-${i}`,
          reachable,
          url
        });
      }

      const unreachableCount = hosts.filter(h => !h.reachable).length;
      const overallStatus = unreachableCount === 0 ? 'healthy' : (unreachableCount < hosts.length ? 'at-risk' : 'unreachable');

      results.push({
        templateId: template.id,
        title: template.title,
        hosts,
        overallStatus,
        lastChecked: new Date().toISOString()
      });
    }

    this.reports = results;
    return results;
  }

  public getReports(): AuditReport[] {
    return this.reports;
  }
}

export const templrAuditor = new TemplrAuditor();
