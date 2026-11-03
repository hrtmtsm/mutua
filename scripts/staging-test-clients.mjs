import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const env = Object.fromEntries(readFileSync(new URL('../.env.staging.local', import.meta.url),'utf8').trim().split('\n').map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
if (env.NEXT_PUBLIC_SUPABASE_URL !== 'https://yuponpfvhclhfqtihuok.supabase.co') throw new Error('Refusing non-staging project');
export const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const path=new URL('../.staging-test/accounts.json',import.meta.url);
mkdirSync(new URL('../.staging-test/',import.meta.url),{recursive:true});
let accounts=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
if (!accounts.length) {
 for (let i=0;i<4;i++) {
  const email=`live-test-${i+1}-${Date.now()}@example.com`;const password=randomBytes(18).toString('base64url');
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
  const user=data.user;
  const profile={session_id:user.id,email,name:`Test ${String.fromCharCode(65+i)}`,native_language:i%2===0?'Japanese':'English',learning_language:i%2===0?'English':'Japanese',availability:'Flexible',country_code:i%2===0?'JP':'US',avatar_url:`/avatars/adventurer/0${i+1}.svg`};
  const result=await admin.from('profiles').insert(profile);if(result.error)throw result.error;
  accounts.push({id:user.id,email,password});
 }
 writeFileSync(path,JSON.stringify(accounts,null,2),{mode:0o600});
}
export {accounts};
export async function clientFor(index) {
 const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.signInWithPassword(accounts[index]);if(error)throw error;
 return {client,user:data.user,token:data.session.access_token};
}
