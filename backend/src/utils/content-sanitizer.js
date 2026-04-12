const sanitizeHtml = require('sanitize-html');

const BIOGRAPHY_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3',
];

function sanitizeBiographyHtml(html) {
  if (html === undefined || html === null) return '';
  return sanitizeHtml(String(html), {
    allowedTags: BIOGRAPHY_ALLOWED_TAGS,
    allowedAttributes: {},
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).trim();
}

function sanitizePlainText(value, maxLength = null) {
  if (value === undefined || value === null) return '';
  let sanitized = String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    .trim();

  if (typeof maxLength === 'number') {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

module.exports = {
  sanitizeBiographyHtml,
  sanitizePlainText,
};
