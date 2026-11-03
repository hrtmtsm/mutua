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
