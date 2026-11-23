import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
import {SceneDocument} from "./scene.mjs";

const rootDir=process.env.TERRAMIND_TEST_ROOT || ".";
const config={apiUrl:"https://api.example.test/v1/chat/completions",apiKey:"test-key",model:"test-model",timeoutMs:1000};
const server=createServer({rootDir,config,fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:"tool_calls",message:{content:"创建一个绿色球体。",tool_calls:[{type:"function",function:{name:"propose_scene_operations",arguments:JSON.stringify({summary:"创建绿色球体",operations:[{op:"create",id:null,patch:null,entity:{type:"sphere",name:"绿色球体",position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1],material:"custom",color:"#579b69",groupId:null,groupName:null}}]})}}]}}]}),{status:200,headers:{"content-type":"application/json"}}),logger:{error(){}}});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();
const base=`http://127.0.0.1:${address.port}`;
try {
  const health=await fetch(base+"/api/health");
  assert.equal(health.status,200);
  assert.equal((await health.json()).providerConfigured,true);
  const html=await fetch(base+"/");
  assert.equal(html.status,200);
  assert.match(await html.text(),/TERRA/);
  const hidden=await fetch(base+"/server.mjs");
  assert.equal(hidden.status,404,"server implementation must not be served as a static asset");

  const doc=new SceneDocument();
  const response=await fetch(base+"/api/plan",{
    method:"POST",headers:{"content-type":"application/json",origin:base},
    body:JSON.stringify({command:"创建一个绿色球体",sceneSnapshot:doc.snapshot(),context:{targetIds:[],anchorIds:[]},history:[]})
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.plan.summary,"创建绿色球体");
  assert.equal(data.plan.preview.changeCount,1);

  const blocked=await fetch(base+"/api/plan",{
    method:"POST",headers:{"content-type":"application/json",origin:"https://evil.example"},
    body:JSON.stringify({command:"test",sceneSnapshot:doc.snapshot()})
  });
  assert.equal(blocked.status,403);

  const invalid=await fetch(base+"/api/plan",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({command:"test",sceneSnapshot:"not-a-snapshot"})
  });
  assert.equal(invalid.status,400);

  const noConfig=createServer({rootDir,config:{apiUrl:config.apiUrl,apiKey:"",model:"",timeoutMs:1000},fetchImpl:async()=>{throw Error("must not call upstream");},logger:{error(){}}});
  await new Promise(resolve=>noConfig.listen(0,"127.0.0.1",resolve));
  try {
    const noConfigBase=`http://127.0.0.1:${noConfig.address().port}`;
    const health2=await (await fetch(noConfigBase+"/api/health")).json();
    assert.equal(health2.providerConfigured,false);
    const missing=await fetch(noConfigBase+"/api/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({command:"test",sceneSnapshot:doc.snapshot()})});
    assert.equal(missing.status,503);
  } finally { await new Promise(resolve=>noConfig.close(resolve)); }
  console.log("PASS: health, static allowlist, plan endpoint, same-origin guard, invalid snapshot and missing-provider behavior");
} finally {
  await new Promise(resolve=>server.close(resolve));
}
