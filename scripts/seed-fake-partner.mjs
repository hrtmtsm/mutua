/**
 * Creates a fake partner match for hrtmtsh@gmail.com so you can test the UI.
 * Run: node scripts/seed-fake-partner.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://jrdnhjzvmyuslziodhpm.supabase.co';
const SERVICE_ROLE_KEY = 'REDACTED_SUPABASE_SERVICE_ROLE_KEY';
const TARGET_EMAIL     = 'hrtmtsh@gmail.com';

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Find the auth user ──────────────────────────────────────────────────────
const { data: { users }, error: listErr } = await db.auth.admin.listUsers({ perPage: 500 });
if (listErr) { console.error('listUsers failed:', listErr); process.exit(1); }

const authUser = users.find(u => u.email === TARGET_EMAIL);
if (!authUser) { console.error(`No auth user found for ${TARGET_EMAIL}`); process.exit(1); }
console.log(`Found auth user: ${authUser.id}`);

// ── 2. Find their session_id from user_availability ────────────────────────────
const { data: avail } = await db
  .from('user_availability')
  .select('session_id, timezone')
  .eq('user_id', authUser.id)
  .limit(1)
  .maybeSingle();

if (!avail?.session_id) {
  console.error('No user_availability row found — log in and save availability first');
  process.exit(1);
}
const mySessionId = avail.session_id;
const myTimezone  = avail.timezone ?? 'America/Chicago';
console.log(`session_id: ${mySessionId}, timezone: ${myTimezone}`);

// ── 3. Check for existing fake match ──────────────────────────────────────────
const { data: existing } = await db
  .from('matches')
  .select('id')
  .eq('session_id_a', mySessionId)
  .eq('name_b', 'Yuki Tanaka')
  .maybeSingle();

if (existing) {
  console.log(`Fake match already exists (id=${existing.id}) — delete it first if you want a fresh one`);
  process.exit(0);
}

// ── 4. Create a fake partner session_id & availability ────────────────────────
const fakeSessionId = crypto.randomUUID();
const fakeAuthId    = crypto.randomUUID(); // not a real auth user, just for user_availability

// Give the fake partner overlapping slots in the same timezone (Mon, Wed, Fri 9:00–10:00 AM)
const fakeSlots = [
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 0, start_minute: 540, timezone: myTimezone }, // Mon 9:00
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 0, start_minute: 570, timezone: myTimezone }, // Mon 9:30
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 2, start_minute: 540, timezone: myTimezone }, // Wed 9:00
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 2, start_minute: 570, timezone: myTimezone }, // Wed 9:30
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 4, start_minute: 540, timezone: myTimezone }, // Fri 9:00
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 4, start_minute: 570, timezone: myTimezone }, // Fri 9:30
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 6, start_minute: 1200, timezone: myTimezone }, // Sun 8:00 PM
  { session_id: fakeSessionId, user_id: fakeAuthId, day_of_week: 6, start_minute: 1230, timezone: myTimezone }, // Sun 8:30 PM
];

const { error: slotErr } = await db.from('user_availability').insert(fakeSlots);
if (slotErr) console.warn('user_availability insert warning:', slotErr.message);
else console.log('Fake partner availability inserted');

// ── 5. Insert the match ────────────────────────────────────────────────────────
const { data: match, error: matchErr } = await db.from('matches').insert({
  session_id_a:       mySessionId,
  session_id_b:       fakeSessionId,
  name_a:             authUser.email?.split('@')[0] ?? 'You',
  name_b:             'Yuki Tanaka',
  email_a:            authUser.email,
  email_b:            'yuki.fake@example.com',
  native_language_a:  'English',
  native_language_b:  'Japanese',
  goal:               'conversation',
  score:              87,
  reasons:            ['Both want to improve conversational fluency', 'Similar learning pace'],
  scheduling_state:   'pending_both',
}).select('id').single();

if (matchErr) { console.error('match insert failed:', matchErr); process.exit(1); }

console.log(`\nDone! Match created: ${match.id}`);
console.log(`Partner: Yuki Tanaka (Japanese ↔ English)`);
console.log(`State: pending_both — open the app and you should see the partner card`);
