/** Fail closed on a cross-project/misconfigured deployment, not on a hardcoded production ID. */
export function liveConfigurationError(env:NodeJS.ProcessEnv=process.env):string|null {
 if(env.LIVE_EXCHANGE_ENABLED!=='true')return 'live_exchange_disabled';
 const ref=env.LIVE_EXCHANGE_PROJECT_REF;
 const allowed=(env.LIVE_EXCHANGE_ALLOWED_PROJECT_REFS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!ref||!allowed.includes(ref)||env.NEXT_PUBLIC_SUPABASE_URL!==`https://${ref}.supabase.co`)return 'live_project_not_allowed';
 if(!env.NEXT_PUBLIC_SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return 'live_auth_not_configured';
 if(env.NODE_ENV==='production'&&!env.METERED_API_KEY&&!(env.TURN_URLS&&env.TURN_USERNAME&&env.TURN_CREDENTIAL))return 'live_relay_not_configured';
 return null;
}
export const CONSENT_VERSION='voice-log-v1';
export const VOICE_TOPICS=['Casual conversation','Travel','Work','Culture','Daily life'] as const;
export const PRACTICE_LEVELS=['','Beginner','Intermediate','Advanced'] as const;
