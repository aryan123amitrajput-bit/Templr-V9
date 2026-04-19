
import axios from 'axios';

export interface HostAudit {
  name: string;
  type: string;
  isReachable: boolean;
  latency: number;
  lastChecked: string;
  apiKey?: string;
}

export class TraffService {
  private hosts: HostAudit[] = [];
  
  private targetHosts = [
    { name: 'Telegram Bot', type: 'Messaging', url: 'https://api.telegram.org', apiKey: process.env.TELEGRAM_BOT_TOKENS || '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo' },
    { name: 'Supabase', type: 'Database', url: process.env.SUPABASE_URL || 'https://risynxckpsgqgprnaccr.supabase.co', apiKey: 'eyJhbGciOiJIUzI...VsrpROVoak' },
    { name: 'GitHub', type: 'Repository', url: 'https://api.github.com', apiKey: process.env.GITHUB_TOKEN ? 'TOKEN_SET' : 'PUBLIC' },
    { name: 'Catbox', type: 'Storage', url: 'https://catbox.moe', apiKey: 'ANONYMOUS' },
    { name: 'ImgBB', type: 'Image', url: 'https://api.imgbb.com/1/upload', apiKey: process.env.IMGBB_API_KEY || 'HIDDEN' },
    { name: 'BeeIMG', type: 'Image', url: 'https://beeimg.com', apiKey: '098dccd10fb840e72711cdf846b50222' },
    { name: 'ImgHippo', type: 'Image', url: 'https://api.imghippo.com', apiKey: '0bd1d234918f906d353775d006d2b771' },
    { name: 'Paste.rs', type: 'Text', url: 'https://paste.rs', apiKey: 'PUBLIC_STORAGE' }
  ];

  async auditHosts(): Promise<HostAudit[]> {
    const results = await Promise.all(this.targetHosts.map(async (host) => {
      const start = Date.now();
      let isReachable = false;
      try {
        if (host.url) {
          await axios.get(host.url, { timeout: 3000, validateStatus: () => true });
          isReachable = true;
        }
      } catch (e) {
        isReachable = false;
      }
      return {
        name: host.name,
        type: host.type,
        isReachable,
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        apiKey: host.apiKey
      };
    }));
    this.hosts = results;
    return results;
  }

  getHosts(): HostAudit[] {
    return this.hosts;
  }
}

export const traffService = new TraffService();
