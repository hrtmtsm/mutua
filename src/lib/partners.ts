import type { SavedPartner, UserProfile } from './types';

const KEY = 'mutua_partners';
export const PARTNER_LIMIT = 3;

export function getPartners(): SavedPartner[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

export function addPartner(partner: SavedPartner): { ok: boolean } {
  const existing = getPartners();
  if (existing.length >= PARTNER_LIMIT) return { ok: false };
  if (existing.some(p => p.partner_id === partner.partner_id)) return { ok: true };
  localStorage.setItem(KEY, JSON.stringify([...existing, partner]));
  return { ok: true };
}

export function removePartner(partnerId: string): void {
  const existing = getPartners();
  localStorage.setItem(KEY, JSON.stringify(existing.filter(p => p.partner_id !== partnerId)));
}

export function profileToSavedPartner(profile: UserProfile): SavedPartner {
  return {
    partner_id:        profile.session_id,
    name:              profile.name ?? 'Your partner',
    native_language:   profile.native_language,
    learning_language: profile.learning_language,
    goal:              profile.goal,
    comm_style:        profile.comm_style,
    availability:      profile.availability,
    saved_at:          new Date().toISOString(),
  };
}
