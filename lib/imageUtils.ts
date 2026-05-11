export const DEFAULT_AVATARS = [
  'https://imageupload.app/i/6ecf1b3511dc6873b369',
  'https://imageupload.app/en/i/4e3f7466ca960ff9a04e',
  'https://imageupload.app/en/i/69263b7ea6907dc13228',
  'https://imageupload.app/en/i/6d34075d016122b5895c',
  'https://imageupload.app/en/i/705e4fe7627a07493e0d',
  'https://imageupload.app/en/i/758ff53eeb7633c224c2'
];

export const getRandomAvatar = (seed?: string) => {
  const name = seed ? encodeURIComponent(seed) : 'User';
  return `https://ui-avatars.com/api/?name=${name}&background=random`;
};

export const resolveImageUrl = (url: string | null | undefined, seed?: string): string => {
  if (!url) return getRandomAvatar(seed);
  
  let parsedUrl = url;
  if (parsedUrl.startsWith('https://https://')) parsedUrl = parsedUrl.replace('https://https://', 'https://');
  if (parsedUrl.startsWith('http://http://')) parsedUrl = parsedUrl.replace('http://http://', 'http://');

  if (parsedUrl.startsWith('tg://')) {
      return `/api/tg-file/${parsedUrl.replace('tg://', '')}`;
  }
  
  if (parsedUrl.startsWith('http://') && !parsedUrl.includes('localhost') && !parsedUrl.includes('127.0.0.1')) {
      return `/api/proxy/image?url=${encodeURIComponent(parsedUrl)}`;
  }

  const problematicHosts = ['catbox.moe', 'beeimg.com', 'gifyu.com', 'imghippo.com', 'uguu.se', 'api.telegram.org'];
  if (problematicHosts.some(h => parsedUrl.includes(h)) && !parsedUrl.includes('/api/proxy/image')) {
      return `/api/proxy/image?url=${encodeURIComponent(parsedUrl)}`;
  }
  
  return parsedUrl;
};

export const getProxiedImageUrl = (url: string | { src: string } | undefined | null): string => {
  if (!url) return '';
  console.log(`[getProxiedImageUrl] Processing URL:`, url);
  
  // Handle object with src property
  if (typeof url === 'object' && 'src' in url) {
    url = url.src;
  }
  
  // Handle JSON stringified object (possibly with query params)
  if (typeof url === 'string') {
      const trimmedUrl = url.trim();
      const [baseUrl, query] = trimmedUrl.split('?');
      console.log(`[getProxiedImageUrl] baseUrl:`, baseUrl, `query:`, query);
      if (baseUrl.startsWith('{') && baseUrl.endsWith('}')) {
          try {
              const parsed = JSON.parse(baseUrl);
              console.log(`[getProxiedImageUrl] Parsed JSON:`, parsed);
              if (parsed.src) {
                  url = parsed.src + (query ? `?${query}` : '');
                  console.log(`[getProxiedImageUrl] Extracted URL:`, url);
              }
          } catch (e) {
              console.error(`[getProxiedImageUrl] JSON parse error:`, e);
              // ignore
          }
      }
  }
  
  if (typeof url !== 'string') return '';
  
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/')) {
      console.log(`[getProxiedImageUrl] Returning relative URL:`, url);
      return url;
  }
  if (url.includes('/api/proxy?url=')) return url;
  
  if (url.includes('ui-avatars.com')) return url;
  if (url.includes('supaimg.com')) return url;
  if (url.includes('imageupload.app')) return url;
  if (url.includes('supabase.co')) return url;
  if (url.includes('unsplash.com')) return url;
  
  console.log(`[getProxiedImageUrl] Returning proxied URL for:`, url);
  return `/api/proxy?url=${encodeURIComponent(url)}`;
};
