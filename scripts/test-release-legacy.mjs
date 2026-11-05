import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createClient} from '@supabase/supabase-js';import {env,admin,clientFor} from './staging-test-clients.mjs';
const fixture=JSON.parse(readFileSync(new URL('../.staging-test/release-regression.json',import.meta.url),'utf8'));let n=0;const ok=(name,v)=>{assert.ok(v,name);console.log('PASS',name);n++};const base=process.env.TEST_BASE||'http://localhost:3003';
const make=(token)=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});
for(const [i,f]of fixture.fixtures.entries()){
 const old=make(f.accessToken);let p=await old.from('profiles').select('*').eq('session_id',f.sid);ok(`Legacy ${i}: pre-change session still accesses profile`,p.data?.length===1&&p.data[0].bio===f.profile.bio);
 if(!i){const log=await old.from('session_logs').select('*').eq('id',fixture.log.id);ok('Owner reads pre-change history',log.data?.length===1);}
 const c=make();let refreshed=await c.auth.refreshSession({refresh_token:f.refreshToken});if(!refreshed.data.session){const recovered=await c.auth.signInWithPassword({email:f.email,password:f.password});refreshed=await c.auth.refreshSession({refresh_token:recovered.data.session.refresh_token});}ok(`Legacy ${i}: token refresh`,!!refreshed.data.session);f.refreshToken=refreshed.data.session.refresh_token;writeFileSync(new URL('../.staging-test/release-regression.json',import.meta.url),JSON.stringify(fixture),{mode:0o600});await c.auth.signOut({scope:'local'});
 const login=await c.auth.signInWithPassword({email:f.email,password:f.password});ok(`Legacy ${i}: logout/password re-login`,!!login.data.session);
 const r=await fetch(base+'/api/save-profile',{method:'POST',headers:{Authorization:`Bearer ${login.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({session_id:f.sid,native_language:'Japanese',learning_language:'English'})});ok(`Legacy ${i}: supplements languages`,r.ok);
 p=await c.from('profiles').select('*').eq('session_id',f.sid).single();ok(`Legacy ${i}: profile identity and bio preserved`,p.data?.id===f.profile.id&&p.data?.bio===f.profile.bio&&p.data?.native_language==='Japanese');
 const link=await admin.auth.admin.generateLink({type:'magiclink',email:f.email});if(link.error)throw link.error;
 const magic=await make().auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});ok(`Legacy ${i}: magic-link verification`,magic.data.user?.id===f.id);
 // Save rotated refresh token privately so a repeated regression run remains valid.
 if(refreshed.data.session)f.refreshToken=refreshed.data.session.refresh_token;
}
writeFileSync(new URL('../.staging-test/release-regression.json',import.meta.url),JSON.stringify(fixture),{mode:0o600});
const partner=make();await partner.auth.signInWithPassword(fixture.fixtures[1]);const partnerLog=await partner.from('session_logs').select('*').eq('id',fixture.log.id);ok('Partner cannot read owner-only legacy history',partnerLog.data?.length===0);
const other=await clientFor(2);for(const c of[other.client,make()]){const logs=await c.from('session_logs').select('*').eq('id',fixture.log.id);ok('Outsider/anonymous old history denied',!!logs.error||logs.data?.length===0);}
const cards=await other.client.from('public_profile_cards').select('session_id,name').eq('session_id',fixture.fixtures[0].sid);ok('Legacy partner display survives via safe view',cards.data?.length===1);const leak=await other.client.from('public_profile_cards').select('email');ok('Safe profile view has no private email',!!leak.error);
console.log(`RESULT ${n} assertions. Magic-link backend verified; email delivery and browser redirect require separate checks.`);
