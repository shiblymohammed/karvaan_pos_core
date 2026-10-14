import { getServerUrl } from './serverConfig';

// Keep stored upload paths relative so they also work on other terminals.
export function resolveMediaUrl(url?: string): string | undefined {
  if (!url || !url.startsWith('/uploads/')) return url;
  return `${getServerUrl().replace(/\/+$/, '')}${url}`;
}
