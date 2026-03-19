export const getProxiedImageUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  // If it's already a local path, data URI, or blob URI, return as is
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  return `/api/proxy?url=${encodeURIComponent(url)}`;
};
