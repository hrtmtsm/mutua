import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {admin,clientFor,accounts,env} from './staging-test-clients.mjs';
import {createClient} from '@supabase/supabase-js';
const file=new URL('../.staging-test/release-regression.json',import.meta.url);
if(existsSync(file)){console.log('Existing regression fixtures retained');process.exit(0);}
const fixtures=[];
for(let i=0;i<2;i++){
 const sid=randomUUID(),email=`release-legacy-${i}-${Date.now()}@example.com`,password=randomBytes(24).toString('base64url');
 const r=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{mutua_legacy_session_ids:[sid]}});if(r.error)throw r.error;
 const profile={session_id:sid,email,name:`Legacy fixture ${i+1}`,native_language:i?'':'Japanese',learning_language:i?'':'English',bio:'Legacy bio must survive',goal:'Travel',availability:'Flexible'};
 const p=await admin.from('profiles').insert(profile).select('*').single();if(p.error)throw p.error;
 const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
 fixtures.push({id:r.data.user.id,email,password,sid,profile:p.data,accessToken:login.data.session.access_token,refreshToken:login.data.session.refresh_token});
}
const log=await admin.from('session_logs').insert({user_id:fixtures[0].sid,partner_id:fixtures[1].sid,duration_secs:123,ended_at:new Date(Date.now()-86400000).toISOString()}).select('*').single();if(log.error)throw log.error;
const m=await admin.from('matches').insert({session_id_a:fixtures[0].sid,session_id_b:fixtures[1].sid,native_language_a:'Japanese',native_language_b:'English',status:'matched',scheduling_state:'archived'}).select('id').single();if(m.error)throw m.error;
const msg=await admin.from('messages').insert({match_id:m.data.id,sender_id:fixtures[0].sid,text:'Legacy conversation must remain private'}).select('id').single();if(msg.error)throw msg.error;
writeFileSync(file,JSON.stringify({fixtures,log:log.data,matchId:m.data.id,messageId:msg.data.id,seededAt:new Date().toISOString()}),{mode:0o600});
console.log('Seeded 2 pre-migration legacy identities, 1 private history, 1 match/message; tokens stored privately');
