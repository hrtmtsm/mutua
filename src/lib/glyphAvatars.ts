export const GLYPH_AVATARS = Array.from({ length: 24 }, (_, index) =>
  `/avatars/glyphs/${String(index + 1).padStart(2, '0')}.svg`,
);

export const DEFAULT_AVATARS = ['adventurer', 'adventurer-neutral'].flatMap(style =>
  Array.from({ length: 12 }, (_, index) => `/avatars/${style}/${String(index + 1).padStart(2, '0')}.svg`),
);
export const AVATAR_OPTIONS = [...DEFAULT_AVATARS, ...GLYPH_AVATARS];
export function defaultAvatarFor(id: string) {
  const hash = Array.from(id).reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

/** Google Meet–style fallback initials: first+last word initial, or the first two chars of a single word. */
export function initialsFor(name?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  const parts = n.split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : n.slice(0, 2)).toUpperCase();
}

/** True only for a real uploaded photo — never one of our own stock glyph icons
 *  (picked from the profile page's icon grid, or an unset default). */
export function isRealPhoto(url?: string | null): url is string {
  return !!url && !url.startsWith('/avatars/');
}
