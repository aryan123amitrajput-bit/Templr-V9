import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

export interface TemplateMetadata {
  id: string;
  [key: string]: any;
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
let owner = process.env.GITHUB_OWNER || process.env.VITE_GITHUB_OWNER || '';
let repo = process.env.GITHUB_REPO || process.env.VITE_GITHUB_REPO || 'templr-metadata';

// Fix incorrect env var formats
if (repo.includes('github.com')) {
  const parts = repo.split('github.com/')[1].split('/');
  owner = parts[0];
  repo = parts[1].replace('.git', '');
} else if (owner.includes('github.com')) {
  const parts = owner.split('github.com/')[1].split('/');
  owner = parts[0];
  repo = parts[1].replace('.git', '');
} else if (owner === 'Templr-V9' && repo.includes('aryan123amitrajput-bit')) {
  // Handle the specific swapped case
  owner = 'aryan123amitrajput-bit';
  repo = 'Templr-V9';
}

export const repoManager = {
  getFile: async (filename: string): Promise<string> => {
    try {
      if (owner && repo) {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filename,
        });
        if ('content' in response.data && response.data.content) {
          return Buffer.from(response.data.content, 'base64').toString('utf-8');
        }
      }
    } catch (e: any) {
      if (e.status !== 404) console.error(`[RepoManager] Error getting file ${filename} from primary repo:`, e);
    }

    // Fallback to GITHUB_REPO_LIST
    const repoList = process.env.GITHUB_REPO_LIST || '';
    if (repoList) {
      const repos = repoList.split(',').map(r => r.trim()).filter(Boolean);
      for (const r of repos) {
        const [rOwner, rName] = r.split('/');
        if (rOwner && rName) {
          try {
            const response = await octokit.rest.repos.getContent({
              owner: rOwner,
              repo: rName,
              path: filename,
            });
            if ('content' in response.data && response.data.content) {
              return Buffer.from(response.data.content, 'base64').toString('utf-8');
            }
          } catch (e: any) {
            if (e.status !== 404) console.error(`[RepoManager] Error getting file ${filename} from ${r}:`, e);
          }
        }
      }
    }

    return '';
  },

  updateFile: async (filename: string, content: string): Promise<void> => {
    if (!owner || !repo) return;
    try {
      let sha: string | undefined;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filename,
        });
        if ('sha' in existing.data) {
          sha = existing.data.sha;
        }
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filename,
        message: `Update ${filename}`,
        content: Buffer.from(content).toString('base64'),
        sha,
      });
    } catch (e) {
      console.error(`[RepoManager] Error updating file ${filename}:`, e);
    }
  },

  getMergedRegistry: async (): Promise<any[]> => {
    try {
      let allTemplates: any[] = [];
      
      // 1. Fetch from primary repo
      const content = await repoManager.getFile('registry.json');
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) allTemplates.push(...parsed);
        } catch (e) {}
      }

      // 2. Fetch from GITHUB_REPO_LIST
      const repoList = process.env.GITHUB_REPO_LIST || '';
      if (repoList) {
        const repos = repoList.split(',').map(r => r.trim()).filter(Boolean);
        for (const r of repos) {
          const [rOwner, rName] = r.split('/');
          if (rOwner && rName) {
            try {
              const response = await octokit.rest.repos.getContent({
                owner: rOwner,
                repo: rName,
                path: 'registry.json',
              });
              if ('content' in response.data && response.data.content) {
                const fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(fileContent);
                if (Array.isArray(parsed)) allTemplates.push(...parsed);
              }
            } catch (e) {
              console.error(`[RepoManager] Error fetching from ${r}:`, e);
            }
          }
        }
      }

      // 3. Fetch from GITLAB_PROJECT_LIST
      const gitlabList = process.env.GITLAB_PROJECT_LIST || '';
      const gitlabToken = process.env.GITLAB_TOKEN || '';
      if (gitlabList) {
        const projects = gitlabList.split(',').map(p => p.trim()).filter(Boolean);
        for (const p of projects) {
          try {
            // Encode project path/id for GitLab API
            const encodedProject = encodeURIComponent(p);
            const headers: any = {};
            if (gitlabToken) headers['PRIVATE-TOKEN'] = gitlabToken;
            
            const response = await axios.get(`https://gitlab.com/api/v4/projects/${encodedProject}/repository/files/registry.json/raw?ref=main`, {
              headers,
              validateStatus: () => true // Don't throw on 404
            });
            
            if (response.status === 200 && Array.isArray(response.data)) {
              allTemplates.push(...response.data);
            }
          } catch (e) {
            console.error(`[RepoManager] Error fetching from GitLab ${p}:`, e);
          }
        }
      }

      return allTemplates;
    } catch (e) {
      console.error('[RepoManager] Error getting merged registry:', e);
      return [];
    }
  },

  getTemplateById: async (id: string): Promise<any> => {
    try {
      const registry = await repoManager.getMergedRegistry();
      return registry.find((t: any) => t.id === id) || null;
    } catch (e) {
      return null;
    }
  },

  uploadTemplate: async (metadata: any): Promise<void> => {
    try {
      const registry = await repoManager.getMergedRegistry();
      registry.push(metadata);
      await repoManager.updateFile('registry.json', JSON.stringify(registry, null, 2));
    } catch (e) {
      console.error('[RepoManager] Error uploading template:', e);
    }
  },

  updateTemplate: async (id: string, metadataUpdates: any): Promise<void> => {
    try {
      const registry = await repoManager.getMergedRegistry();
      const index = registry.findIndex((t: any) => t.id === id);
      if (index !== -1) {
        registry[index] = { ...registry[index], ...metadataUpdates };
        await repoManager.updateFile('registry.json', JSON.stringify(registry, null, 2));
      }
    } catch (e) {
      console.error('[RepoManager] Error updating template:', e);
    }
  },

  deleteTemplate: async (id: string): Promise<void> => {
    try {
      const registry = await repoManager.getMergedRegistry();
      const filtered = registry.filter((t: any) => t.id !== id);
      if (filtered.length !== registry.length) {
        await repoManager.updateFile('registry.json', JSON.stringify(filtered, null, 2));
      }
    } catch (e) {
      console.error('[RepoManager] Error deleting template:', e);
    }
  }
};
