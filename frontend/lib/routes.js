const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hriatrengna.in';

export function normalizeAlbumType(type) {
  return type === 'wedding' ? 'wedding' : 'memorial';
}

export function getPublicAlbumPath(type, slug) {
  const base = normalizeAlbumType(type) === 'wedding' ? 'wedding' : 'album';
  return `/${base}/${slug}`;
}

export function getPublicAlbumUrl(type, slug, appUrl = APP_URL) {
  return `${String(appUrl || APP_URL).replace(/\/+$/, '')}${getPublicAlbumPath(type, slug)}`;
}
