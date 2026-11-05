import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const values = Object.fromEntries(readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8')
 .split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
if (values.NEXT_PUBLIC_SUPABASE_URL !== 'https://yuponpfvhclhfqtihuok.supabase.co' || values.LIVE_EXCHANGE_PROJECT_REF !== 'yuponpfvhclhfqtihuok') throw new Error('Refusing non-staging environment');
const port = process.argv[2] || '3002';
// Both browser origins share a single server build, avoiding .next corruption.
const env = { ...process.env, ...values, LIVE_EXCHANGE_ENABLED:'true',LIVE_EXCHANGE_ALLOWED_PROJECT_REFS:'yuponpfvhclhfqtihuok',PAIRED_DIST_DIR: port==='3002'?'.next-staging':`.next-staging-${port}`, WATCHPACK_POLLING: 'true' };
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','-p',port], { env, stdio:'inherit' });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
