import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createWorker } from '../cloud/worker.mjs';
import { demoTurn, WORLDS } from '../lib/catalog.mjs';
class LocalD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql'))) this.db.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const statement = this.db.prepare(sql); let values = [];
    const handle = {
      bind(...input) { values = input; return handle; },
      async first() { return statement.get(...values) ?? null; },
      async run() { const result = statement.run(...values); return { success: true, meta: { changes: result.changes } }; },
    };
    return handle;
  }
}
const generated = s => ({...s.scene,choices:s.scene.choices.length?s.scene.choices:WORLDS[0].opening.choices,summary:'模拟 AI 开场',memory:s.memory,quest:s.quest,inventoryAdd:[],inventoryRemove:[],loot:[],encounter:null,ended:false});
const settings = {name:'试玩公主',worldId:'fantasy',roleId:'wanderer',difficulty:'balanced'};
function fixture(t, extra = {}, options = {}) {
  const DB = new LocalD1(); t.after(() => DB.db.close());
  const env = { DB, DEEPSEEK_API_KEY:'private-test-api-key', PLAYTEST_CODE:'PRIVATE-FRIEND-CODE', TRIAL_SIGNING_KEY:'test-only-signing-key-long-enough', ASSETS:{fetch:async()=>new Response('asset')}, ...extra };
  let calls=0;
  const worker=createWorker({dice:()=>20,provider:async(s,action,roll,options)=>{calls++;return action?demoTurn(s,action,roll):generated(s);},...options});
  const request=async(path,{data,cookie,token,headers={}}={})=>{
    const req=new Request('https://playtest.example'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const response=await worker.fetch(req,env);return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
  };
  const login=async()=>{const r=await request('/api/playtest/login',{data:{code:env.PLAYTEST_CODE}});assert.equal(r.status,200);return r.cookie;};
  return{env,request,login,calls:()=>calls,DB};
}
test('cloud trial gates paid APIs, signs a secure cookie, and never returns secrets',async t=>{
  const f=fixture(t); const config=await f.request('/api/config');
  assert.equal(config.body.playtest.authorized,false); assert.equal(config.body.playtest.required,true);
  assert.ok(!JSON.stringify(config.body).includes(f.env.DEEPSEEK_API_KEY)); assert.ok(!JSON.stringify(config.body).includes(f.env.PLAYTEST_CODE));
  assert.equal((await f.request('/api/sessions',{data:settings})).status,401);assert.equal(f.calls(),0);
  assert.equal((await f.request('/api/playtest/login',{data:{code:'wrong-code'}})).status,403);
  const login=await f.request('/api/playtest/login',{data:{code:f.env.PLAYTEST_CODE}});
  assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await f.request('/api/config',{cookie:login.cookie})).body.playtest.authorized,true);
  const forged=login.cookie.slice(0,-1)+(login.cookie.at(-1)==='a'?'b':'a');
  assert.equal((await f.request('/api/sessions',{data:settings,cookie:forged})).status,401);
});
test('cloud sessions, equipment and story turns persist with idempotency and independent credentials',async t=>{
  const f=fixture(t),cookie=await f.login();
  const created=await f.request('/api/sessions',{data:settings,cookie});assert.equal(created.status,201);
  const{session,token}=created.body;
  assert.equal((await f.request('/api/sessions/'+session.id,{cookie})).status,404);
  const equip={version:0,type:'equip',itemId:'moonblade',requestId:randomUUID()};
  const first=await f.request('/api/sessions/'+session.id+'/rpg',{data:equip,cookie,token});
  assert.equal(first.status,200);assert.equal(first.body.session.character.modifiers.might,2);assert.equal(f.calls(),1);
  const duplicate=await f.request('/api/sessions/'+session.id+'/rpg',{data:equip,cookie,token});assert.equal(duplicate.body.session.version,1);
  const data={version:1,action:'寻找母后的线索',skill:'insight',requestId:randomUUID()};
  const turn=await f.request('/api/sessions/'+session.id+'/turn',{data,cookie,token});
  assert.equal(turn.status,200);assert.equal(turn.body.session.version,2);assert.equal(turn.body.session.storyTurns,1);
  assert.equal((await f.request('/api/sessions/'+session.id+'/turn',{data,cookie,token})).body.session.version,2);
  assert.equal(f.calls(),2);
  const latest=await f.request('/api/sessions/'+session.id,{cookie,token});assert.equal(latest.body.session.rpg.equipment.weapon,'moonblade');
});
test('daily reservations are persistent and never call AI after the limit',async t=>{
  const f=fixture(t,{PLAYTEST_USER_DAILY_LIMIT:'1',PLAYTEST_GLOBAL_DAILY_LIMIT:'2'}),cookie=await f.login();
  assert.equal((await f.request('/api/sessions',{data:settings,cookie})).status,201);
  assert.equal((await f.request('/api/sessions',{data:settings,cookie})).status,429);assert.equal(f.calls(),1);
  const cookie2=await f.login();assert.equal((await f.request('/api/sessions',{data:settings,cookie:cookie2})).status,201);
  const cookie3=await f.login();assert.equal((await f.request('/api/sessions',{data:settings,cookie:cookie3})).status,429);assert.equal(f.calls(),2);
});
test('parallel cloud turns are leased and cannot overwrite or double-charge a save',async t=>{
  let release,start;const started=new Promise(r=>start=r),blocked=new Promise(r=>release=r);let calls=0;
  const f=fixture(t,{}, {provider:async(s,action,roll)=>{if(!action)return generated(s);calls++;start();await blocked;return demoTurn(s,action,roll);}});
  const cookie=await f.login();const{session,token}=(await f.request('/api/sessions',{data:settings,cookie})).body;
  const data={version:0,action:'探索灯塔',skill:'insight',requestId:randomUUID()};
  const first=f.request('/api/sessions/'+session.id+'/turn',{data,cookie,token});await started;
  const second=await f.request('/api/sessions/'+session.id+'/turn',{data:{...data,requestId:randomUUID()},cookie,token});release();
  assert.equal(second.status,409);assert.equal((await first).body.session.version,1);assert.equal(calls,1);
});
test('failed cloud AI preserves state, releases the lease, and a retry can commit',async t=>{
  let fail=false;const f=fixture(t,{}, {provider:async(s,action,roll)=>{if(!action)return generated(s);if(fail)return{title:'invalid'};return demoTurn(s,action,roll);}});
  const cookie=await f.login();const{session,token}=(await f.request('/api/sessions',{data:settings,cookie})).body;fail=true;
  const data={version:0,action:'探索灯塔',skill:'insight',requestId:randomUUID()};
  assert.equal((await f.request('/api/sessions/'+session.id+'/turn',{data,cookie,token})).status,502);
  assert.equal((await f.request('/api/sessions/'+session.id,{cookie,token})).body.session.version,0);
  fail=false;assert.equal((await f.request('/api/sessions/'+session.id+'/turn',{data,cookie,token})).body.session.version,1);
});
test('cloud login rejects cross-origin requests and throttles guessing without spending AI',async t=>{
  const f=fixture(t);
  assert.equal((await f.request('/api/playtest/login',{data:{code:f.env.PLAYTEST_CODE},headers:{Origin:'https://untrusted.example'}})).status,403);
  for(let i=0;i<10;i++)assert.equal((await f.request('/api/playtest/login',{data:{code:'wrong'}})).status,403);
  assert.equal((await f.request('/api/playtest/login',{data:{code:f.env.PLAYTEST_CODE}})).status,429);
  assert.equal(f.calls(),0);
});

test('cloud trial safely derives cookie signing when only the provided API secret is configured',async t=>{
  const f=fixture(t,{TRIAL_SIGNING_KEY:undefined});
  const cookie=await f.login();
  assert.ok(!cookie.includes(f.env.DEEPSEEK_API_KEY));
  assert.equal((await f.request('/api/config',{cookie})).body.playtest.authorized,true);
  f.env.DEEPSEEK_API_KEY='rotated-test-api-key';
  assert.equal((await f.request('/api/config',{cookie})).body.playtest.authorized,false);
});
