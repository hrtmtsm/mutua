const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;

function loadHook(getUserMedia) {
 const calls=[];
 const source=ts.transpileModule(fs.readFileSync('src/hooks/useLiveAudio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const sandbox={exports,require:(id)=>{
  if(id==='react')return React;
  if(id==='@/lib/supabase')return {supabase:{}};
  if(id==='@/lib/liveExchange')return {liveAction:async(...args)=>{calls.push(args);}};
  throw new Error(id);
 },navigator:{mediaDevices:{getUserMedia}},setInterval,clearInterval,setTimeout,clearTimeout,DOMException,AbortSignal,
 fetch:async()=>({ok:true,json:async()=>[]}),RTCPeerConnection:class{constructor(){throw new Error('Must not create a peer connection without a microphone');}}};
 vm.runInNewContext(source,sandbox,{filename:'useLiveAudio.js'});
 return {useLiveAudio:exports.useLiveAudio,calls};
}

test('microphone denial reports failure, requests audio only, and never starts signaling',async()=>{
 let requested;
 const {useLiveAudio,calls}=loadHook(async constraints=>{requested=JSON.parse(JSON.stringify(constraints));throw new DOMException('Permission denied','NotAllowedError');});
 const failures=[];let value,tree;
 function Probe(){value=useLiveAudio({callId:'call',conversationId:'chat',myId:'a',partnerId:'b',muted:false,onFailure:reason=>failures.push(reason)});return null;}
 await act(async()=>{tree=Renderer.create(React.createElement(Probe));await new Promise(setImmediate);});
 assert.deepEqual(requested,{audio:true,video:false});
 assert.equal(value.state,'failed');assert.equal(failures.length,1);assert.match(failures[0],/拒否/);assert.equal(calls.length,0);
 await act(async()=>tree.unmount());
});

test('leaving before a pending microphone grant stops the late stream and sends no old signals',async()=>{
 let grant;let stopped=0;
 const pending=new Promise(resolve=>{grant=resolve;});
 const {useLiveAudio,calls}=loadHook(()=>pending);
 let tree;
 function Probe(){useLiveAudio({callId:'old-call',conversationId:'chat',myId:'a',partnerId:'b',muted:false,onFailure:()=>assert.fail('unmounted call must not fail a new call')});return null;}
 await act(async()=>{tree=Renderer.create(React.createElement(Probe));});
 await act(async()=>tree.unmount());
 await act(async()=>{grant({getTracks:()=>[{stop:()=>stopped++}]});await new Promise(setImmediate);});
 assert.equal(stopped,1);assert.equal(calls.length,0);
});
