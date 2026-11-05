import {NextResponse} from 'next/server';
import {requireAuth} from '@/lib/presenceAuth';
export async function GET(request:Request){
 const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const urls=(process.env.TURN_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(urls.length&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL)return NextResponse.json([{urls,username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL}],{headers:{'Cache-Control':'private, no-store'}});
 if(process.env.METERED_API_KEY){try{
  const app=process.env.METERED_APP_NAME||'mutua';if(!/^[a-z0-9-]+$/i.test(app))throw Error();
  const response=await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(process.env.METERED_API_KEY)}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(response.ok){const servers=await response.json();if(Array.isArray(servers)&&servers.some(s=>JSON.stringify(s.urls).includes('turn:')||JSON.stringify(s.urls).includes('turns:')))return NextResponse.json(servers,{headers:{'Cache-Control':'private, no-store'}});}
 }catch{/* Fail closed in production; no shared public relay credentials. */}}
 if(process.env.NODE_ENV==='production')return NextResponse.json({error:'relay_not_configured'},{status:503});
 return NextResponse.json([{urls:'stun:stun.l.google.com:19302'}],{headers:{'Cache-Control':'no-store','X-ICE-Limitation':'development-stun-only'}});
}
