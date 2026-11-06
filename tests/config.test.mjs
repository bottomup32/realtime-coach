import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../src/app/api/coach/config/route.ts';
const names=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_LIVE_MODEL','GEMINI_COACH_MODEL'];
const saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
function configure() {for(const name of names)process.env[name]='test-only';process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';}
function restore(){for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}}
test('runtime config sees values added after module/build initialization without exposing server key',async()=>{
 try{
  for(const name of names)delete process.env[name];
  assert.equal((await (await GET()).json()).supabase,null);
  configure();process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='sb_publishable_test';
  const data=await(await GET()).json();assert.equal(data.aiReady,true);assert.equal(data.supabase.url,'https://test.supabase.co');
  assert.deepEqual(Object.keys(data).sort(),['aiReady','diarizationReady','invalidPublicConfig','missing','supabase']);
  assert.deepEqual(Object.keys(data.supabase).sort(),['anonKey','url']);
 }finally{restore();}
});
test('service-role and malformed keys are never returned to browser',async()=>{
 try{
  configure();for(const key of ['sb_secret_test','head.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.sig','broken']){
   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=key;const data=await(await GET()).json();assert.equal(data.supabase,null);assert.equal(data.invalidPublicConfig,true);
  }
 }finally{restore();}
});
