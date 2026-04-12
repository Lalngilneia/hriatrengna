'use strict';

const APP_URL = process.env.APP_URL || 'https://hriatrengna.in';

function normalizeAlbumType(type) {
  return type === 'wedding' ? 'wedding' : 'memorial';
}

function getPublicAlbumPath(type, slug) {
  const base = normalizeAlbumType(type) === 'wedding' ? 'wedding' : 'album';
  return `/${base}/${slug}`;
}

function getPublicAlbumUrl(type, slug, appUrl = APP_URL) {
  return `${String(appUrl || APP_URL).replace(/\/+$/, '')}${getPublicAlbumPath(type, slug)}`;
}

module.exports = {
  normalizeAlbumType,
  getPublicAlbumPath,
  getPublicAlbumUrl,
};
