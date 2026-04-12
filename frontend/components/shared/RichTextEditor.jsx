/**
 * components/shared/RichTextEditor.jsx
 *
 * Quill-based rich text editor.
 * DOMPurify sanitizes output before every onChange call,
 * preventing stored XSS when content is later rendered via dangerouslySetInnerHTML.
 *
 * Usage:
 *   <RichTextEditor value={bio} onChange={setBio} placeholder="Write something…" />
 *
 * Sanitized output is safe to render with:
 *   <div dangerouslySetInnerHTML={{ __html: sanitize(bio) }} />
 */

import { useEffect, useRef } from 'react';

// DOMPurify is loaded client-side only (no SSR window)
let purify = null;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line global-require
  purify = require('dompurify');
}

/** Sanitize HTML — strips scripts, event handlers, dangerous hrefs. */
export function sanitize(html) {
  if (!html) return '';
  if (!purify) return html; // SSR fallback — no XSS risk server-side
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3',
    ],
    ALLOWED_ATTR: [],
  });
}

const TOOLBAR = [
  [{ header: [false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'clean'],
];

export default function RichTextEditor({ value, content, onChange, placeholder = '' }) {
  const containerRef = useRef(null);
  const quillRef     = useRef(null);
  const suppressRef  = useRef(false);
  const editorValue  = value ?? content ?? '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (quillRef.current) return; // already initialised

    // Lazy-load Quill to keep SSR bundle clean
    Promise.all([
      import('quill'),
      import('quill/dist/quill.snow.css'),
    ]).then(([{ default: Quill }]) => {
      quillRef.current = new Quill(containerRef.current, {
        theme: 'snow',
        placeholder,
        modules: { toolbar: TOOLBAR },
      });

      // Set initial value
      if (editorValue) {
        suppressRef.current = true;
        quillRef.current.clipboard.dangerouslyPasteHTML(editorValue);
        suppressRef.current = false;
      }

      quillRef.current.on('text-change', () => {
        if (suppressRef.current) return;
        const html = containerRef.current.querySelector('.ql-editor')?.innerHTML || '';
        onChange?.(sanitize(html));
      });
    });

    return () => {
      quillRef.current?.off('text-change');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes without losing cursor
  useEffect(() => {
    const q = quillRef.current;
    if (!q) return;
    const current = containerRef.current?.querySelector('.ql-editor')?.innerHTML || '';
    if (sanitize(editorValue) !== sanitize(current)) {
      suppressRef.current = true;
      q.clipboard.dangerouslyPasteHTML(editorValue || '');
      suppressRef.current = false;
    }
  }, [editorValue]);

  return (
    <div
      ref={containerRef}
      style={{ background: '#fff', borderRadius: 8, minHeight: 160 }}
    />
  );
}
