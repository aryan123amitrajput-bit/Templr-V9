export const DEFAULT_AVATARS = [
  'https://i.imageupload.app/6ecf1b3511dc6873b369.png',
  'https://i.imageupload.app/4e3f7466ca960ff9a04e.png',
  'https://i.imageupload.app/69263b7ea6907dc13228.png',
  'https://i.imageupload.app/6d34075d016122b5895c.png',
  'https://i.imageupload.app/705e4fe7627a07493e0d.jpeg',
  'https://i.imageupload.app/758ff53eeb7633c224c2.jpeg'
];

export const getRandomAvatar = (seed?: string) => {
  if (!seed) {
    return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
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
