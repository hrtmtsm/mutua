// Real-service verification for legacy-history-rls-migration.sql, against
// the staging branch only (guarded by staging-test-clients.mjs). Creates a
// session_logs row + a matches row owned by test account A, then checks:
// A (owner/participant) can read; B (match participant, not log owner) can
// read the match but not the log; C (unrelated) and anon can read neither;
// forged writes by non-owners are rejected. Cleans up afterwards.
import { createClient } from '@supabase/supabase-js';
import { admin, env, accounts, clientFor } from './staging-test-clients.mjs';

const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const a = await clientFor(0);
const b = await clientFor(1);
const c = await clientFor(2);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const sidA = accounts[0].id, sidB = accounts[1].id, sidC = accounts[2].id;

// Seed one session_log (owned by A, about a call with B) and one match (A+B) via service role.
const { data: logRow, error: logErr } = await admin.from('session_logs').insert({ user_id: sidA, partner_id: sidB, duration_secs: 321 }).select('id').single();
if (logErr) throw logErr;
const { data: matchRow, error: matchErr } = await admin.from('matches').insert({ session_id_a: sidA, session_id_b: sidB, native_language_a: 'Japanese', native_language_b: 'English', scheduling_state: 'pending' }).select('id').single();
if (matchErr) throw matchErr;

try {
  // --- matches: both participants can read, outsider/anon cannot ---
  { const { data } = await a.client.from('matches').select('id').eq('id', matchRow.id); check('matches: A (participant) can read', (data ?? []).length === 1); }
  { const { data } = await b.client.from('matches').select('id').eq('id', matchRow.id); check('matches: B (participant) can read', (data ?? []).length === 1); }
  { const { data } = await c.client.from('matches').select('id').eq('id', matchRow.id); check('matches: C (unrelated) cannot read', (data ?? []).length === 0); }
  { const { data } = await anon.from('matches').select('id').eq('id', matchRow.id); check('matches: anonymous cannot read', (data ?? []).length === 0); }

  // --- matches: participant can update own match, outsider cannot ---
  { const { data } = await a.client.from('matches').update({ scheduling_state: 'archived' }).eq('id', matchRow.id).select('scheduling_state');
    check('matches: A can archive own match', (data ?? [])[0]?.scheduling_state === 'archived'); }
  { const { error } = await c.client.from('matches').update({ scheduling_state: 'hacked' }).eq('id', matchRow.id);
    const { data: after } = await admin.from('matches').select('scheduling_state').eq('id', matchRow.id).single();
    check('matches: C cannot modify a match they are not in', after?.scheduling_state !== 'hacked', `error=${error?.message ?? 'none, but 0 rows affected expected'}`); }

  // --- matches: participant can create a match naming themself, outsider cannot forge one between others ---
  { const { error } = await a.client.from('matches').insert({ session_id_a: sidA, session_id_b: sidC, native_language_a: 'Japanese', native_language_b: 'English' });
    check('matches: A can create a match naming themself', !error, error?.message); }
  { const { error } = await c.client.from('matches').insert({ session_id_a: sidA, session_id_b: sidB, native_language_a: 'Japanese', native_language_b: 'English' });
    check('matches: C cannot create a match between two other people', !!error, error?.message ?? 'expected RLS rejection, got none'); }

  // --- session_logs: only the row's own user_id can read it — not even the partner ---
  { const { data } = await a.client.from('session_logs').select('id').eq('id', logRow.id); check('session_logs: A (owner) can read own log', (data ?? []).length === 1); }
  { const { data } = await b.client.from('session_logs').select('id').eq('id', logRow.id); check('session_logs: B (partner, not owner) cannot read', (data ?? []).length === 0); }
  { const { data } = await c.client.from('session_logs').select('id').eq('id', logRow.id); check('session_logs: C (unrelated) cannot read', (data ?? []).length === 0); }
  { const { data } = await anon.from('session_logs').select('id').eq('id', logRow.id); check('session_logs: anonymous cannot read', (data ?? []).length === 0); }

  // --- session_logs: nobody can forge a log entry under someone else's user_id ---
  { const { error } = await c.client.from('session_logs').insert({ user_id: sidA, partner_id: sidC, duration_secs: 1 });
    check('session_logs: C cannot insert a forged log as A', !!error, error?.message ?? 'expected RLS rejection, got none'); }
  { const { error } = await b.client.from('session_logs').insert({ user_id: sidB, partner_id: sidA, duration_secs: 42 });
    check('session_logs: B can insert their own log', !error, error?.message); }
} finally {
  // Clean up every row this script touched, regardless of pass/fail.
  await admin.from('session_logs').delete().in('user_id', [sidA, sidB]);
  await admin.from('matches').delete().or(`session_id_a.eq.${sidA},session_id_b.eq.${sidA}`);
  console.log('\nCleanup done.');
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) { console.error('FAILED:', failed.map(f => f.name)); process.exit(1); }
