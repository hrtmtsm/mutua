import assert from 'node:assert/strict';
import { accounts,admin,clientFor } from './staging-test-clients.mjs';
const people=await Promise.all([0,1,2,3].map(clientFor));
const [a,b,c,d]=people.map(p=>p.client);
const report=[];
async function action(client,name,data={}) {
 const {data:result,error}=await client.rpc('live_exchange',{p_action:name,p_data:data});
 if(error)throw new Error(`${name}: ${error.message}`);if(result?.error)throw new Error(result.error);return result;
}
async function reset() {
 for(const client of [a,b,c,d]) await action(client,'cancel');
}
async function match(kind='text') {
 const waiting=await action(a,'join',{kind});assert(waiting.queue);
 const result=await action(b,'join',{kind});assert(result.conversation?.status==='active');
 const peer=await action(a,'state');assert.equal(peer.conversation.id,result.conversation.id);
 return peer;
}
function pass(name){report.push(name);console.log(`PASS ${name}`);}
try {
 await reset();
 const state=await match();const cid=state.conversation.id;
 pass('Two authenticated accounts pair into the same text conversation');
 let eventReceived;
 const realtime=new Promise(resolve=>{eventReceived=resolve;});
 let postgresReady;
 const subscribed = new Promise(resolve => { postgresReady=resolve; });
 const channel=b.channel('test-message-'+Date.now()).on('system',{},event=>{ if(event.extension==='postgres_changes' && event.status==='ok') postgresReady(); }).on('postgres_changes',{event:'INSERT',schema:'public',table:'live_messages',filter:`conversation_id=eq.${cid}`},event=>eventReceived(event.new));
 await new Promise((resolve,reject)=>{channel.subscribe(status=>{if(status==='SUBSCRIBED')resolve();if(status==='CHANNEL_ERROR')reject(new Error(status));});setTimeout(()=>reject(new Error('Realtime subscribe timed out')),12000).unref();});
 await Promise.race([subscribed,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Postgres subscription timed out')),10000).unref())]);
 const clientId=crypto.randomUUID();
 await action(a,'message',{conversationId:cid,body:'こんにちは — from A',clientId});
 await Promise.race([realtime,new Promise((_,reject)=>{setTimeout(()=>reject(new Error('Realtime delivery timed out')),12000).unref();})]);
 await b.removeChannel(channel);pass('Realtime INSERT delivered to the other account under RLS');
 await action(a,'message',{conversationId:cid,body:'duplicate',clientId});
 await action(b,'message',{conversationId:cid,body:'Hello — from B',clientId:crypto.randomUUID()});
 const chat=await action(a,'state');assert.equal(chat.messages.length,2);pass('Bidirectional persisted messages and idempotent client IDs');
 for(const table of ['live_conversations','live_calls','live_messages']) {
  const result=await c.from(table).select('*').eq(table==='live_conversations'?'id':'conversation_id',cid);assert.ifError(result.error);assert.equal(result.data.length,0,table);
 }
 const forbidden=await c.rpc('live_exchange',{p_action:'message',p_data:{conversationId:cid,body:'intrusion',clientId:crypto.randomUUID()}});assert(forbidden.error);const hiddenProfile=await a.from('profiles').select('email').eq('email',accounts[1].email);assert.equal(hiddenProfile.data.length,0);
 pass('Third account cannot read or write another conversation; profiles are owner-only');
 const invited=await action(a,'invite',{conversationId:cid});const callId=invited.call.id;
 assert.equal((await action(b,'state')).call.id,callId);
 const accepted=await action(b,'accept',{conversationId:cid,callId});assert.equal(accepted.call.status,'accepted');
 await action(a,'signal',{conversationId:cid,callId,event:'ready',payload:{}});
 const signals=await b.from('live_signals').select('*').eq('call_id',callId);assert.equal(signals.data.length,1);
 const outsiderSignals=await c.from('live_signals').select('*').eq('call_id',callId);assert.equal(outsiderSignals.data.length,0);
 pass('Invitation, recipient acceptance and authorized signaling');
 const endedCall=await action(b,'end_call',{conversationId:cid,callId});assert.equal(endedCall.conversation.status,'active');assert.equal(endedCall.call.status,'ended');
 await action(a,'message',{conversationId:cid,body:'Chat after hangup',clientId:crypto.randomUUID()});pass('Ending voice retains the conversation and chat');
 await action(a,'end',{conversationId:cid});assert.equal((await action(b,'state')).conversation.status,'ended');
 await assert.rejects(()=>action(b,'accept',{conversationId:cid,callId}));
 await assert.rejects(()=>action(a,'signal',{conversationId:cid,callId,event:'ready',payload:{}}));pass('Conversation end propagates and rejects stale accept/signaling');
 await reset();
 await action(a,'join',{kind:'text'});await action(b,'join',{kind:'voice'});
 assert((await action(a,'state')).queue);assert((await action(b,'state')).queue);pass('Text and direct-voice queues never cross-match');
 await reset();const direct=await match('voice');assert.equal(direct.call.status,'accepted');pass('Direct voice callers pair with accepted call consent');
 await reset();await action(a,'join',{kind:'text'});await action(a,'cancel');const next=await action(b,'join',{kind:'text'});assert(next.queue);pass('Waiting cancellation prevents subsequent matching');
 await reset();let expired=await match();let invite=await action(a,'invite',{conversationId:expired.conversation.id});
 await admin.from('live_calls').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',invite.call.id);
 await assert.rejects(()=>action(b,'accept',{conversationId:expired.conversation.id,callId:invite.call.id}));
 assert.equal((await action(a,'state')).call.status,'expired');pass('Expired invitation rejected and cleanup remains committed');
 await reset();await action(a,'join',{kind:'text'});
 await admin.from('live_queue').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('user_id',accounts[0].id);
 assert.equal((await action(a,'state')).queue,null);pass('Queue expires without automatically rejoining');
 await reset();await match();
 await admin.from('live_members').update({last_seen:new Date(Date.now()-60000).toISOString()}).eq('user_id',accounts[1].id);
 assert.equal((await action(a,'state')).conversation.ended_reason,'peer_left');pass('Peer departure lease expires and ends the conversation');
 await reset();
 const results=await Promise.all([a,b,c,d].map(client=>action(client,'join',{kind:'text'})));
 const states=await Promise.all([a,b,c,d].map(client=>action(client,'state')));
 const ids=states.map(s=>s.conversation?.id);assert(ids.every(Boolean));assert.equal(new Set(ids).size,2);
 for(const id of new Set(ids)) assert.equal(ids.filter(x=>x===id).length,2);
 pass('Four concurrent joins produce exactly two disjoint pairs');
 await reset();
 await action(a,'join',{kind:'text'});
 await Promise.all([action(a,'cancel'),action(b,'join',{kind:'text'})]);
 const cancelledRace=await action(a,'state');assert.equal(cancelledRace.queue,null);assert(cancelledRace.conversation?.status!=='active');
 pass('Cancel racing a match leaves no hidden active conversation');
 await reset();const fresh=await match();
 await assert.rejects(()=>action(b,'accept',{conversationId:cid,callId}));
 assert.equal((await action(a,'state')).conversation.id,fresh.conversation.id);
 assert.equal((await action(b,'state')).conversation.status,'active');
 pass('Old invitations cannot attach to a new conversation');
 const directInsert=await c.from('live_messages').insert({conversation_id:fresh.conversation.id,sender_id:accounts[0].id,client_id:crypto.randomUUID(),body:'spoof'});
 assert(directInsert.error);pass('Direct table writes cannot bypass participant and sender checks');
 await reset();
 const anon=await fetch('http://localhost:3002/api/live-exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'state',data:{}})});
 assert.equal(anon.status,401);pass('App API rejects unauthenticated calls');
 console.log(`${report.length} checks passed`);
} finally { await reset(); for(const person of people)await person.client.auth.signOut({scope:'local'}); }
