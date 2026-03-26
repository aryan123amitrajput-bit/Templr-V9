
import { Octokit } from 'octokit';

export interface RepoConfig {
  type: 'github' | 'gitlab';
  owner?: string;
  repo?: string;
  projectId?: string;
  token: string;
}

export interface TemplateMetadata {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  tags: string[];
  [key: string]: any;
}

export class RepoManager {
  private githubRepos: { owner: string; repo: string }[] = [];
  private gitlabProjects: string[] = [];
  private githubToken: string;
  private gitlabToken: string;
  private threshold: number;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN || '';
    this.gitlabToken = process.env.GITLAB_TOKEN || '';
    this.threshold = parseInt(process.env.REPO_THRESHOLD || '1000');

    const githubList = process.env.GITHUB_REPO_LIST || '';
    this.githubRepos = githubList.split(',').filter(Boolean).map(item => {
      const trimmed = item.trim();
      let owner = '';
      let repo = '';

      // Handle full URLs like https://github.com/owner/repo
      if (trimmed.startsWith('http')) {
        try {
          const url = new URL(trimmed);
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            owner = parts[0];
            repo = parts[1];
          }
        } catch (e) {
          console.error(`Invalid GitHub URL in GITHUB_REPO_LIST: ${trimmed}`);
        }
      } else {
        // Handle owner/repo format
        const parts = trimmed.split('/').filter(Boolean);
        if (parts.length === 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }

      if (owner && repo) {
        // Strip .git suffix if present
        if (repo.endsWith('.git')) {
          repo = repo.slice(0, -4);
        }
        return { owner, repo };
      }
      return null;
    }).filter((item): item is { owner: string; repo: string } => item !== null);

    const gitlabList = process.env.GITLAB_PROJECT_LIST || '';
    this.gitlabProjects = gitlabList.split(',').filter(Boolean).map(item => {
      const trimmed = item.trim();
      
      // Handle SSH format: git@gitlab.com:owner/repo.git
      if (trimmed.startsWith('git@')) {
        const pathPart = trimmed.split(':').pop();
        if (pathPart) {
          let projectPath = pathPart;
          if (projectPath.endsWith('.git')) {
            projectPath = projectPath.slice(0, -4);
          }
          return projectPath;
        }
      }

      // Handle HTTP format: https://gitlab.com/owner/repo
      if (trimmed.startsWith('http')) {
        try {
          const url = new URL(trimmed);
          let projectPath = url.pathname.split('/').filter(Boolean).join('/');
          if (projectPath.endsWith('.git')) {
            projectPath = projectPath.slice(0, -4);
          }
          return projectPath;
        } catch (e) {
          console.error(`Invalid GitLab URL in GITLAB_PROJECT_LIST: ${trimmed}`);
        }
      }

      // Handle owner/repo format
      let projectPath = trimmed;
      if (projectPath.endsWith('.git')) {
        projectPath = projectPath.slice(0, -4);
      }
      return projectPath;
    }).filter(Boolean);

    if (this.githubRepos.length === 0 && this.gitlabProjects.length === 0) {
      console.log('No repositories configured, adding default template repository.');
      this.githubRepos.push({ owner: 'templr-app', repo: 'templates' });
    }
  }

  async getAllRepos(): Promise<RepoConfig[]> {
    const repos: RepoConfig[] = [];
    
    this.githubRepos.forEach(r => {
      repos.push({ type: 'github', owner: r.owner, repo: r.repo, token: this.githubToken });
    });

    this.gitlabProjects.forEach(p => {
      repos.push({ type: 'gitlab', projectId: p, token: this.gitlabToken });
    });

    return repos;
  }

  async getActiveRepo(): Promise<RepoConfig> {
    const repos = await this.getAllRepos();
    if (repos.length === 0) {
      throw new Error("No repositories configured.");
    }

    // Iterate through repos to find the first one below threshold
    for (const repo of repos) {
      const count = await this.getTemplateCount(repo);
      if (count < this.threshold) {
        return repo;
      }
    }

    // Fallback to the last repo if all are full
    return repos[repos.length - 1];
  }

  private async getTemplateCount(repo: RepoConfig): Promise<number> {
    try {
      const registry = await this.getRegistry(repo);
      return registry.length;
    } catch (e) {
      return 0; // If registry doesn't exist, count is 0
    }
  }

  private registryCache: Map<string, { data: TemplateMetadata[], timestamp: number }> = new Map();
  private CACHE_TTL = 60000; // 1 minute

  async getRegistry(repo: RepoConfig, useCache = true): Promise<TemplateMetadata[]> {
    if (repo.type === 'github' && (!repo.owner || !repo.repo)) {
      console.error('GitHub repo config missing owner or repo:', repo);
      return [];
    }
    const cacheKey = repo.type === 'github' ? `${repo.owner}/${repo.repo}` : repo.projectId!;
    
    if (useCache) {
      const cached = this.registryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    let data: TemplateMetadata[] = [];
    if (repo.type === 'github') {
      if (!useCache) {
        // Bypass CDN when useCache is false to get the freshest data
        const octokit = new Octokit({ auth: repo.token });
        try {
          const { data: fileData }: any = await octokit.rest.repos.getContent({
            owner: repo.owner!,
            repo: repo.repo!,
            path: 'registry.json'
          });
          const content = Buffer.from(fileData.content, 'base64').toString();
          data = JSON.parse(content);
          console.log(`[RepoManager] Successfully fetched from Octokit (CDN bypassed). Found ${data.length} templates.`);
        } catch (octoErr: any) {
          if (octoErr.status === 404) {
            console.warn(`[RepoManager] Octokit 404 for registry.json`);
            data = [];
          } else {
            throw octoErr;
          }
        }
      } else {
        // Use jsDelivr CDN for faster public access
        const url = `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.repo}/registry.json`;
        try {
          console.log(`[RepoManager] Fetching registry from CDN: ${url}`);
          const response = await fetch(url);
          if (response.ok) {
            data = await response.json();
            console.log(`[RepoManager] Successfully fetched from CDN. Found ${data.length} templates.`);
          } else if (response.status === 404) {
            console.warn(`[RepoManager] CDN 404 for ${url}. Trying Octokit...`);
            // File not found on CDN, could be new or private
            // Fallback to Octokit if CDN fails or for private repos
            const octokit = new Octokit({ auth: repo.token });
            try {
              const { data: fileData }: any = await octokit.rest.repos.getContent({
                owner: repo.owner!,
                repo: repo.repo!,
                path: 'registry.json'
              });
              const content = Buffer.from(fileData.content, 'base64').toString();
              data = JSON.parse(content);
              console.log(`[RepoManager] Successfully fetched from Octokit. Found ${data.length} templates.`);
            } catch (octoErr: any) {
              if (octoErr.status === 404) {
                console.warn(`[RepoManager] Octokit 404 for registry.json`);
                data = [];
              } else {
                throw octoErr;
              }
            }
          } else {
            throw new Error(`CDN error: ${response.statusText}`);
          }
        } catch (e: any) {
          console.error(`GitHub registry fetch error for ${cacheKey}:`, e);
          return [];
        }
      }
    } else {
      // GitLab Raw URL
      const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/registry.json/raw?ref=main`;
      try {
        console.log(`[RepoManager] Fetching registry from GitLab: ${url}`);
        const response = await fetch(url, {
          headers: { 'PRIVATE-TOKEN': repo.token }
        });
        if (response.ok) {
          data = await response.json();
          console.log(`[RepoManager] Successfully fetched from GitLab. Found ${data.length} templates.`);
        } else if (response.status === 404) {
          console.warn(`[RepoManager] GitLab 404 for ${url}`);
          data = [];
        } else {
          throw new Error(`GitLab error: ${response.statusText}`);
        }
      } catch (e) {
        console.error(`GitLab registry fetch error for ${cacheKey}:`, e);
        return [];
      }
    }

    if (useCache) {
      this.registryCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    return data;
  }

  async uploadTemplate(template: TemplateMetadata): Promise<void> {
    const repo = await this.getActiveRepo();
    const templateId = template.id;
    const filePath = `templates/${templateId}.json`;
    const content = JSON.stringify(template, null, 2);

    if (repo.type === 'github') {
      const octokit = new Octokit({ auth: repo.token });
      
      // 1. Upload template file
      let sha: string | undefined;
      try {
        const { data }: any = await octokit.rest.repos.getContent({
          owner: repo.owner!,
          repo: repo.repo!,
          path: filePath
        });
        sha = data.sha;
      } catch (e) {}

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repo.owner!,
        repo: repo.repo!,
        path: filePath,
        message: `Add template ${templateId}`,
        content: Buffer.from(content).toString('base64'),
        sha
      });

      // 2. Update registry
      const registry = await this.getRegistry(repo, false);
      const existingIndex = registry.findIndex(t => t.id === templateId);
      
      const registryEntry = {
        id: template.id,
        title: template.title,
        author: template.author,
        author_id: template.author_id,
        thumbnail: template.thumbnail,
        category: template.category,
        created_at: template.created_at || new Date().toISOString(),
        tags: template.tags || []
      };

      if (existingIndex >= 0) {
        registry[existingIndex] = registryEntry;
      } else {
        registry.unshift(registryEntry);
      }

      let regSha: string | undefined;
      try {
        const { data: registryFile }: any = await octokit.rest.repos.getContent({
          owner: repo.owner!,
          repo: repo.repo!,
          path: 'registry.json'
        });
        regSha = registryFile.sha;
      } catch (e) {}

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repo.owner!,
        repo: repo.repo!,
        path: 'registry.json',
        message: `Update registry for ${templateId}`,
        content: Buffer.from(JSON.stringify(registry, null, 2)).toString('base64'),
        sha: regSha
      });

      // Invalidate and pre-populate cache with new registry
      const cacheKey = `${repo.owner}/${repo.repo}`;
      this.registryCache.set(cacheKey, { data: registry, timestamp: Date.now() });
      
      // Purge jsDelivr cache
      try {
        await fetch(`https://purge.jsdelivr.net/gh/${repo.owner}/${repo.repo}/registry.json`);
        console.log(`[RepoManager] Purged jsDelivr cache for ${cacheKey}`);
      } catch (e) {
        console.error(`[RepoManager] Failed to purge jsDelivr cache:`, e);
      }
    } else {
      // GitLab API
      // 1. Upload template file
      const fileUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(filePath)}`;
      
      const checkRes = await fetch(`${fileUrl}?ref=main`, {
        headers: { 'PRIVATE-TOKEN': repo.token }
      });

      const method = checkRes.ok ? 'PUT' : 'POST';
      const uploadRes = await fetch(fileUrl, {
        method,
        headers: {
          'PRIVATE-TOKEN': repo.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: 'main',
          content,
          commit_message: `Add template ${templateId}`
        })
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`GitLab upload failed: ${err}`);
      }

      // 2. Update registry
      const registry = await this.getRegistry(repo, false);
      const existingIndex = registry.findIndex(t => t.id === templateId);
      
      const registryEntry = {
        id: template.id,
        title: template.title,
        author: template.author,
        author_id: template.author_id,
        thumbnail: template.thumbnail,
        category: template.category,
        created_at: template.created_at || new Date().toISOString(),
        tags: template.tags || []
      };

      if (existingIndex >= 0) {
        registry[existingIndex] = registryEntry;
      } else {
        registry.unshift(registryEntry);
      }

      const regUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/registry.json`;
      const regCheckRes = await fetch(`${regUrl}?ref=main`, {
        headers: { 'PRIVATE-TOKEN': repo.token }
      });

      const regMethod = regCheckRes.ok ? 'PUT' : 'POST';
      const regUploadRes = await fetch(regUrl, {
        method: regMethod,
        headers: {
          'PRIVATE-TOKEN': repo.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: 'main',
          content: JSON.stringify(registry, null, 2),
          commit_message: `Update registry for ${templateId}`
        })
      });

      if (!regUploadRes.ok) {
        const err = await regUploadRes.text();
        throw new Error(`GitLab registry update failed: ${err}`);
      }
    }
  }

  async getTemplateById(templateId: string): Promise<TemplateMetadata | null> {
    const repos = await this.getAllRepos();
    for (const repo of repos) {
      const registry = await this.getRegistry(repo);
      if (registry.some(t => t.id === templateId)) {
        const filePath = `templates/${templateId}.json`;
        if (repo.type === 'github') {
          const octokit = new Octokit({ auth: repo.token });
          try {
            const { data }: any = await octokit.rest.repos.getContent({
              owner: repo.owner!,
              repo: repo.repo!,
              path: filePath
            });
            const content = Buffer.from(data.content, 'base64').toString();
            return JSON.parse(content);
          } catch (e) {
            continue;
          }
        } else {
          const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=main`;
          const response = await fetch(url, {
            headers: { 'PRIVATE-TOKEN': repo.token }
          });
          if (response.ok) {
            return await response.json();
          }
        }
      }
    }
    return null;
  }

  async getMergedRegistry(): Promise<TemplateMetadata[]> {
    const repos = await this.getAllRepos();
    console.log(`[RepoManager] Found ${repos.length} repos:`, JSON.stringify(repos));
    
    // Fetch all registries in parallel
    const registryPromises = repos.map(repo => 
      this.getRegistry(repo).catch(e => {
        console.error(`Failed to fetch registry for ${repo.type}:`, e);
        return [] as TemplateMetadata[];
      })
    );

    const registries = await Promise.all(registryPromises);
    console.log(`[RepoManager] Fetched ${registries.length} registries. Total templates:`, registries.reduce((acc, r) => acc + r.length, 0));
    
    // Merge registries while respecting priority (GitHub > GitLab)
    // and maintaining the order within those groups.
    const allTemplates: TemplateMetadata[] = [];
    for (const registry of registries) {
      allTemplates.push(...registry);
    }

    // Remove duplicates by ID, keeping the first occurrence (highest priority)
    const uniqueTemplates: TemplateMetadata[] = [];
    const seenIds = new Set();
    for (const t of allTemplates) {
      if (t && t.id && !seenIds.has(t.id)) {
        uniqueTemplates.push(t);
        seenIds.add(t.id);
      }
    }
    
    console.log(`[RepoManager] Returning ${uniqueTemplates.length} unique templates.`);
    return uniqueTemplates;
  }

  async updateTemplate(templateId: string, updates: Partial<TemplateMetadata>): Promise<void> {
    const repos = await this.getAllRepos();
    for (const repo of repos) {
      const registry = await this.getRegistry(repo, false);
      const index = registry.findIndex(t => t.id === templateId);
      if (index >= 0) {
        const currentMetadata = await this.getTemplateById(templateId);
        if (!currentMetadata) continue;

        const newMetadata = { ...currentMetadata, ...updates };
        const content = JSON.stringify(newMetadata, null, 2);
        const filePath = `templates/${templateId}.json`;

        if (repo.type === 'github') {
          const octokit = new Octokit({ auth: repo.token });
          
          // Try both sharded and direct paths for backward compatibility
          const shardedPath = `templates/${templateId.substring(0, 2)}/${templateId.substring(2, 4)}/${templateId}.json`;
          const directPath = `templates/${templateId}.json`;
          
          let actualPath = directPath;
          let sha: string | undefined;

          try {
            const { data: file }: any = await octokit.rest.repos.getContent({
              owner: repo.owner!,
              repo: repo.repo!,
              path: directPath
            });
            sha = file.sha;
          } catch (e) {
            try {
              const { data: file }: any = await octokit.rest.repos.getContent({
                owner: repo.owner!,
                repo: repo.repo!,
                path: shardedPath
              });
              sha = file.sha;
              actualPath = shardedPath;
            } catch (e2) {}
          }

          // Try to update the file
          try {
            await octokit.rest.repos.createOrUpdateFileContents({
              owner: repo.owner!,
              repo: repo.repo!,
              path: actualPath,
              message: `Update template ${templateId}`,
              content: Buffer.from(content).toString('base64'),
              sha
            });
          } catch (e: any) {
            if (e.status === 409 || e.message.includes('does not match')) {
              console.log(`[RepoManager] SHA mismatch for ${actualPath}, retrying...`);
              // Re-fetch SHA
              const { data: file }: any = await octokit.rest.repos.getContent({
                owner: repo.owner!,
                repo: repo.repo!,
                path: actualPath
              });
              await octokit.rest.repos.createOrUpdateFileContents({
                owner: repo.owner!,
                repo: repo.repo!,
                path: actualPath,
                message: `Update template ${templateId}`,
                content: Buffer.from(content).toString('base64'),
                sha: file.sha
              });
            } else {
              throw e;
            }
          }

          // Update registry entry
          const entry = registry[index];
          if (updates.title) entry.title = updates.title;
          if (updates.thumbnail) entry.thumbnail = updates.thumbnail;
          if (updates.category) entry.category = updates.category;
          if (updates.tags) entry.tags = updates.tags;
          registry[index] = entry;

          const { data: regFile }: any = await octokit.rest.repos.getContent({
            owner: repo.owner!,
            repo: repo.repo!,
            path: 'registry.json'
          });

          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repo.owner!,
            repo: repo.repo!,
            path: 'registry.json',
            message: `Update registry: ${templateId}`,
            content: Buffer.from(JSON.stringify(registry, null, 2)).toString('base64'),
            sha: regFile.sha
          });

          // Invalidate and pre-populate cache with new registry
          const cacheKey = `${repo.owner}/${repo.repo}`;
          this.registryCache.set(cacheKey, { data: registry, timestamp: Date.now() });
          
          // Purge jsDelivr cache
          try {
            await fetch(`https://purge.jsdelivr.net/gh/${repo.owner}/${repo.repo}/registry.json`);
            console.log(`[RepoManager] Purged jsDelivr cache for ${cacheKey}`);
          } catch (e) {
            console.error(`[RepoManager] Failed to purge jsDelivr cache:`, e);
          }
        } else {
          const fileUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(filePath)}`;
          await fetch(fileUrl, {
            method: 'PUT',
            headers: {
              'PRIVATE-TOKEN': repo.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: 'main',
              content,
              commit_message: `Update template ${templateId}`
            })
          });

          // Update registry
          const entry = registry[index];
          if (updates.title) entry.title = updates.title;
          if (updates.thumbnail) entry.thumbnail = updates.thumbnail;
          if (updates.category) entry.category = updates.category;
          if (updates.tags) entry.tags = updates.tags;
          registry[index] = entry;

          const regUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/registry.json`;
          await fetch(regUrl, {
            method: 'PUT',
            headers: {
              'PRIVATE-TOKEN': repo.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: 'main',
              content: JSON.stringify(registry, null, 2),
              commit_message: `Update registry: ${templateId}`
            })
          });
        }
        return;
      }
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const repos = await this.getAllRepos();
    for (const repo of repos) {
      const registry = await this.getRegistry(repo, false);
      if (registry.some(t => t.id === templateId)) {
        // Found the repo containing the template
        if (repo.type === 'github') {
          const octokit = new Octokit({ auth: repo.token });
          // Try both sharded and direct paths for backward compatibility
          const shardedPath = `templates/${templateId.substring(0, 2)}/${templateId.substring(2, 4)}/${templateId}.json`;
          const directPath = `templates/${templateId}.json`;
          
          for (const filePath of [directPath, shardedPath]) {
            try {
              const { data: file }: any = await octokit.rest.repos.getContent({
                owner: repo.owner!,
                repo: repo.repo!,
                path: filePath
              });
              await octokit.rest.repos.deleteFile({
                owner: repo.owner!,
                repo: repo.repo!,
                path: filePath,
                message: `Delete template ${templateId}`,
                sha: file.sha
              });
            } catch (e) {}
          }

          const newRegistry = registry.filter(t => t.id !== templateId);
          const { data: regFile }: any = await octokit.rest.repos.getContent({
            owner: repo.owner!,
            repo: repo.repo!,
            path: 'registry.json'
          });

          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repo.owner!,
            repo: repo.repo!,
            path: 'registry.json',
            message: `Remove ${templateId} from registry`,
            content: Buffer.from(JSON.stringify(newRegistry, null, 2)).toString('base64'),
            sha: regFile.sha
          });
          
          // Invalidate and pre-populate cache with new registry
          const cacheKey = `${repo.owner}/${repo.repo}`;
          this.registryCache.set(cacheKey, { data: newRegistry, timestamp: Date.now() });
          
          // Purge jsDelivr cache
          try {
            await fetch(`https://purge.jsdelivr.net/gh/${repo.owner}/${repo.repo}/registry.json`);
            console.log(`[RepoManager] Purged jsDelivr cache for ${cacheKey}`);
          } catch (e) {
            console.error(`[RepoManager] Failed to purge jsDelivr cache:`, e);
          }
        } else {
          // GitLab Delete
          const filePath = `templates/${templateId}.json`;
          const fileUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(filePath)}`;
          
          await fetch(fileUrl, {
            method: 'DELETE',
            headers: {
              'PRIVATE-TOKEN': repo.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: 'main',
              commit_message: `Delete template ${templateId}`
            })
          });

          const newRegistry = registry.filter(t => t.id !== templateId);
          const regUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/registry.json`;
          
          await fetch(regUrl, {
            method: 'PUT',
            headers: {
              'PRIVATE-TOKEN': repo.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: 'main',
              content: JSON.stringify(newRegistry, null, 2),
              commit_message: `Remove ${templateId} from registry`
            })
          });
          
          // Invalidate and pre-populate cache with new registry
          this.registryCache.set(repo.projectId!, { data: newRegistry, timestamp: Date.now() });
        }
        return;
      }
    }
  }

  async getFile(path: string): Promise<string | null> {
    const repo = await this.getActiveRepo();
    if (repo.type === 'github') {
      const octokit = new Octokit({ auth: repo.token });
      try {
        const { data }: any = await octokit.rest.repos.getContent({
          owner: repo.owner!,
          repo: repo.repo!,
          path: path
        });
        return Buffer.from(data.content, 'base64').toString();
      } catch (e) {
        return null;
      }
    } else {
      const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(path)}/raw?ref=main`;
      const response = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': repo.token }
      });
      if (response.ok) {
        return await response.text();
      }
      return null;
    }
  }

  async updateFile(path: string, content: string): Promise<void> {
    const repo = await this.getActiveRepo();
    if (repo.type === 'github') {
      const octokit = new Octokit({ auth: repo.token });
      let sha: string | undefined;
      try {
        const { data }: any = await octokit.rest.repos.getContent({
          owner: repo.owner!,
          repo: repo.repo!,
          path: path
        });
        sha = data.sha;
      } catch (e) {}

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repo.owner!,
        repo: repo.repo!,
        path: path,
        message: `Update ${path}`,
        content: Buffer.from(content).toString('base64'),
        sha
      });
    } else {
      const fileUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(path)}`;
      const checkRes = await fetch(`${fileUrl}?ref=main`, {
        headers: { 'PRIVATE-TOKEN': repo.token }
      });
      const method = checkRes.ok ? 'PUT' : 'POST';
      await fetch(fileUrl, {
        method,
        headers: {
          'PRIVATE-TOKEN': repo.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: 'main',
          content,
          commit_message: `Update ${path}`
        })
      });
    }
  }

  async uploadAsset(buffer: Buffer, path: string, mimetype: string): Promise<string> {
    const repo = await this.getActiveRepo();
    if (repo.type === 'github') {
      const octokit = new Octokit({ auth: repo.token });
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repo.owner!,
        repo: repo.repo!,
        path: path,
        message: `Add asset ${path}`,
        content: buffer.toString('base64')
      });
      return `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.repo}/${path}`;
    } else {
      const fileUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo.projectId!)}/repository/files/${encodeURIComponent(path)}`;
      await fetch(fileUrl, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': repo.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: 'main',
          content: buffer.toString('base64'),
          encoding: 'base64',
          commit_message: `Add asset ${path}`
        })
      });
      return `https://gitlab.com/${repo.projectId}/-/raw/main/${path}`;
    }
  }
}

export const repoManager = new RepoManager();
