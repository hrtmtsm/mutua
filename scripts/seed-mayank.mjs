/**
 * Creates a fake partner "Mayank" for hrtmtsh@gmail.com with an existing message.
 * Run: node scripts/seed-mayank.mjs
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const TARGET_EMAIL = 'hrtmtsh@gmail.com';

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Find the auth user ──────────────────────────────────────────────────────
const { data: { users }, error: listErr } = await db.auth.admin.listUsers({ perPage: 500 });
if (listErr) { console.error('listUsers failed:', listErr); process.exit(1); }

const authUser = users.find(u => u.email === TARGET_EMAIL);
if (!authUser) { console.error(`No auth user found for ${TARGET_EMAIL}`); process.exit(1); }
console.log(`Found auth user: ${authUser.id}`);

// ── 2. Find their session_id from profiles ────────────────────────────────────
const { data: prof } = await db
  .from('profiles')
  .select('session_id')
  .eq('email', TARGET_EMAIL)
  .maybeSingle();

if (!prof?.session_id) {
  console.error('No session_id found — log in to the app first');
  process.exit(1);
}

const mySessionId = prof.session_id;
const myTimezone  = 'America/Chicago';
console.log(`session_id: ${mySessionId}, timezone: ${myTimezone}`);

// ── 3. Check for existing Mayank match ────────────────────────────────────────
const { data: existing } = await db
  .from('matches')
  .select('id')
  .eq('session_id_a', mySessionId)
  .eq('name_b', 'Mayank')
  .maybeSingle();

if (existing) {
  console.log(`Mayank match already exists (id=${existing.id})`);
  process.exit(0);
}

// ── 4. Create fake partner ─────────────────────────────────────────────────────
const fakeSessionId = crypto.randomUUID();

// ── 5. Insert match ────────────────────────────────────────────────────────────
const { data: match, error: matchErr } = await db.from('matches').insert({
  session_id_a:       mySessionId,
  session_id_b:       fakeSessionId,
  name_a:             authUser.email?.split('@')[0] ?? 'You',
  name_b:             'Mayank',
  email_a:            authUser.email,
  email_b:            'mayank.fake@example.com',
  native_language_a:  'English',
  native_language_b:  'Hindi',
  goal:               'conversation',
  score:              91,
  reasons:            ['Complementary language goals', 'Similar availability'],
  scheduling_state:   'pending_both',
}).select('id').single();

if (matchErr) { console.error('match insert failed:', matchErr); process.exit(1); }
console.log(`Match created: ${match.id}`);

// ── 6. Insert a starter message from Mayank ───────────────────────────────────
const { error: msgErr } = await db.from('messages').insert({
  match_id:   match.id,
  sender_id:  fakeSessionId,
  text:        'Hey! Excited to practice together 😊',
});
if (msgErr) console.warn('message insert warning:', msgErr.message);
else console.log('Starter message inserted');

console.log(`\nDone! Mayank is ready on hrtmtsh@gmail.com's home.`);
