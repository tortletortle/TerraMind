import assert from "node:assert/strict";
import {SceneDocument} from "./scene.mjs";
import {preparePlan,commitPlan,createConversationContext,validateToolProposal} from "./assistant.mjs";
import {TERRAMIND_FUNCTION} from "./llm-contract.mjs";

let doc=new SceneDocument(),context=createConversationContext();
let plan=preparePlan("创建一座红色城堡",doc,context);
assert.equal(doc.entities.length,0,"planning must not mutate the scene");
assert.equal(plan.preview.changeCount,10);
doc=commitPlan(plan,doc);context=plan.contextAfter;
const castleIds=context.targetIds;
assert.equal(doc.entities.length,10);

plan=preparePlan("在城堡旁边建一座桥",doc,context);
assert.equal(plan.preview.changeCount,5);
assert.equal(doc.entities.length,10);
doc=commitPlan(plan,doc);context=plan.contextAfter;
assert.equal(doc.entities.length,15);
assert.equal(context.targetIds.length,5);
assert.equal(context.anchorIds.length,10);
const bridgeIds=context.targetIds;
const secondBridgePlan=preparePlan("在城堡旁边建一座桥",doc,context);
assert.deepEqual(secondBridgePlan.anchorIds,castleIds,"a second bridge must still resolve the castle, not the existing bridge alias");
const bridgeY=doc.get(bridgeIds[0]).position[1];
plan=preparePlan("再高一点",doc,context);
doc=commitPlan(plan,doc);context=plan.contextAfter;
assert.equal(doc.get(bridgeIds[0]).position[1],bridgeY+.5,"pronoun/continuation should target last created bridge");

plan=preparePlan("把桥改成蓝色",doc,context);
doc=commitPlan(plan,doc);context=plan.contextAfter;
assert.ok(bridgeIds.every(id=>doc.get(id).color==="#5b91d1"));
plan=preparePlan("让桥靠近城堡一点",doc,context);
const oldBridgeCenter=bridgeIds.map(id=>doc.get(id).position[0]).reduce((a,b)=>a+b,0)/bridgeIds.length;
doc=commitPlan(plan,doc);context=plan.contextAfter;
const newBridgeCenter=bridgeIds.map(id=>doc.get(id).position[0]).reduce((a,b)=>a+b,0)/bridgeIds.length;
assert.ok(newBridgeCenter<oldBridgeCenter,"bridge should move toward castle anchor");
plan=preparePlan("把桥放到城堡旁边",doc,context);
const beforeSideMove=bridgeIds.map(id=>doc.get(id).position[0]);
doc=commitPlan(plan,doc);context=plan.contextAfter;
assert.notDeepEqual(bridgeIds.map(id=>doc.get(id).position[0]),beforeSideMove,"explicit relative placement should reposition the target group");

const stale=preparePlan("再高一点",doc,context);
doc.create({type:"sphere",name:"外部新增球体"});
assert.throws(()=>commitPlan(stale,doc),/场景已发生变化/);

const twoSpheres=new SceneDocument();
twoSpheres.create({type:"sphere",name:"蓝色球体"});twoSpheres.create({type:"sphere",name:"红色球体"});
assert.throws(()=>preparePlan("把球改成白色",twoSpheres,createConversationContext()),/多个可能的目标/);

assert.equal(TERRAMIND_FUNCTION.name,"propose_scene_operations");
assert.equal(TERRAMIND_FUNCTION.strict,true);
const safe=new SceneDocument();
const valid=validateToolProposal({summary:"创建一个球",operations:[{op:"create",id:null,patch:null,entity:{type:"sphere",name:"模型球",position:null,rotation:null,scale:null,material:null,color:null,groupId:null,groupName:null}}]},safe);
assert.equal(valid.preview.changeCount,1);
assert.equal(safe.entities.length,0);
assert.throws(()=>validateToolProposal({summary:"执行代码",operations:[{op:"create",id:null,patch:null,entity:{type:"box",name:"x"},javascript:"alert(1)"}]},safe),/未授权字段/);
assert.throws(()=>validateToolProposal({summary:"越权字段",operations:[{op:"create",id:null,patch:null,entity:{type:"box",name:"x"}}],javascript:"alert(1)"},safe),/顶层字段/);
assert.throws(()=>validateToolProposal({summary:"非法类型",operations:[{op:"create",id:null,patch:null,entity:{type:"dragon",name:"龙"}}]},safe));
const modelEntity=safe.create({type:"sphere",name:"模型目标"});
const updateProposal=validateToolProposal({summary:"修改模型目标颜色",operations:[{op:"update",id:modelEntity.id,entity:null,patch:{name:null,position:null,rotation:null,scale:null,material:null,color:"#ffffff"}}]},safe);
assert.equal(updateProposal.operations[0].patch.color,"#ffffff");
console.log("PASS: semantic planning, relative placement, multi-turn context, preview/confirm, stale-plan rejection and LLM proposal validation");
