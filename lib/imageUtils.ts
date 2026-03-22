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
  
  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
      url = `https:${url}`;
  }
  
  // Filter out localhost/127.0.0.1 URLs as they will never work in production
  if (url.includes('localhost:') || url.includes('127.0.0.1:')) {
      console.warn(`[getProxiedImageUrl] Filtering out local URL:`, url);
      return 'https://picsum.photos/seed/local/800/600?blur=5'; // Return a placeholder
  }
  
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/')) {
      // If it's a relative path, we should probably prefix it with the app URL in production
      // but for now, we'll just return it as is if it's an internal route
      console.log(`[getProxiedImageUrl] Returning relative URL:`, url);
      return url;
  }
  if (url.includes('/api/proxy?url=')) return url;
  
  if (url.includes('ui-avatars.com')) return url;
  if (url.includes('supabase.co')) return url;
  if (url.includes('unsplash.com')) return url;
  
  console.log(`[getProxiedImageUrl] Returning proxied URL for:`, url);
  return `/api/proxy?url=${encodeURIComponent(url)}`;
};
