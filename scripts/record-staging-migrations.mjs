// Records the already-applied staging migrations; never targets the parent project.
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const ref = 'yuponpfvhclhfqtihuok';
const envText=readFileSync(new URL('../.env.staging.local',import.meta.url),'utf8');
if (!envText.includes(`NEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\n`)) throw new Error('Staging guard failed');
const migrations = [
 ['20261101052000','live_exchange','20261101052000_live_exchange.sql'],
 ['20261101052100','profile_rls','20261101052100_profile_rls.sql'],
];
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const sql = migrations.map(([version,name,file])=>{
 const source=readFileSync(new URL('../supabase-local/supabase/migrations/'+file,import.meta.url),'utf8');
 return `insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]) on conflict(version) do update set statements=excluded.statements,name=excluded.name;`;
}).join('\n');
const file=new URL('../.staging-test/record-migrations.sql',import.meta.url);writeFileSync(file,sql);
const result=spawnSync('supabase',['db','query','--linked','--project-ref',ref,'--file',file.pathname,'--output','json'],{stdio:'inherit'});
process.exit(result.status ?? 1);
