import {applyOperations} from "./scene.mjs";
import {SceneSemanticIndex, summarizeTargets} from "./semantic-index.mjs";

const COLORS={红色:"#d65c55",橙色:"#e58a45",黄色:"#e5c45b",绿色:"#579b69",蓝色:"#5b91d1",紫色:"#9472c8",白色:"#e8e9e4",黑色:"#30383c",棕色:"#966443",粉色:"#df91ad"};
const SHAPES=[
  {keys:["立方体","方块","正方体"],type:"box",label:"立方体"},
  {keys:["球体","球"],type:"sphere",label:"球体"},
  {keys:["圆柱体","圆柱"],type:"cylinder",label:"圆柱体"},
  {keys:["圆锥体","圆锥"],type:"cone",label:"圆锥体"}
];
const clone=value=>JSON.parse(JSON.stringify(value));
const centerOf=entities=>entities.reduce((sum,e)=>sum.map((v,i)=>v+e.position[i]),[0,0,0]).map(v=>v/entities.length);
const boundsOf=entities=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const entity of entities) for(let i=0;i<3;i++){
    const radius=(entity.scale?.[i]??1)/2;
    min[i]=Math.min(min[i],entity.position[i]-radius);max[i]=Math.max(max[i],entity.position[i]+radius);
  }
  return {min,max,center:min.map((v,i)=>(v+max[i])/2)};
};
const entity=(type,name,color,position,scale=[1,1,1],groupId,groupName)=>({type,name,material:"custom",color,position,scale,...(groupId?{groupId,groupName}:{})});

function castleEntities(color,groupId){
  const towers=[[-1.45,1.05,-1.1],[1.45,1.05,-1.1],[-1.45,1.05,1.1],[1.45,1.05,1.1]];
  const entities=[entity("box","城堡主楼",color,[0,1.1,0],[2.4,2.2,2])];
  towers.forEach((position,index)=>{
    entities.push(entity("cylinder","城堡塔楼"+(index+1),color,position,[.48,2.1,.48]));
    entities.push(entity("cone","城堡塔尖"+(index+1),color,[position[0],2.45,position[2]],[.62,.7,.62]));
  });
  entities.push(entity("box","城堡大门","#493b35",[0,.45,1.06],[.55,.9,.08]));
  return entities.map(item=>({...item,groupId,groupName:"城堡"}));
}
function bridgeEntities(anchorEntities,groupId){
  const bounds=boundsOf(anchorEntities),x=bounds.max[0]+2.1,z=bounds.center[2];
  return [
    entity("box","桥面","#9b8c73",[x+1,.28,z],[3,.28,1.35],groupId,"石桥"),
    entity("box","桥侧栏左","#777f7b",[x+1,.55,z-.62],[3,.18,.12],groupId,"石桥"),
    entity("box","桥侧栏右","#777f7b",[x+1,.55,z+.62],[3,.18,.12],groupId,"石桥"),
    entity("box","桥墩左","#777f7b",[x,.0,z],[.32,.7,1.5],groupId,"石桥"),
    entity("box","桥墩右","#777f7b",[x+2,.0,z],[.32,.7,1.5],groupId,"石桥")
  ];
}
function describeChange(document,after,operation,createdOffset=0){
  if(operation.op==="create"){
    const created=after.entities[document.entities.length+createdOffset];
    return {action:"创建",label:created?.name??"新物体",after:created?{name:created.name,position:created.position,color:created.color}:null};
  }
  if(operation.op==="delete"){
    const before=document.get(operation.id);return {action:"删除",label:before?.name??operation.id,before};
  }
  const before=document.get(operation.id),next=after.get(operation.id);
  const fields=Object.keys(operation.patch??{});
  return {action:"修改",label:before?.name??operation.id,fields,before:Object.fromEntries(fields.map(key=>[key,before?.[key]])),after:Object.fromEntries(fields.map(key=>[key,next?.[key]]))};
}
function makePlan(document,operations,{summary,targetIds=[],anchorIds=[]}={}){
  const after=applyOperations(document,operations);
  let createdOffset=0;
  const changes=operations.map(operation=>{const offset=operation.op==="create"?createdOffset++:0;return describeChange(document,after,operation,offset);});
  const survivingTargets=targetIds.filter(id=>after.get(id));
  const createdIds=after.entities.slice(document.entities.length).map(entity=>entity.id);
  const nextTargetIds=survivingTargets.length?survivingTargets:createdIds;
  return {
    summary,operations:clone(operations),baseSnapshot:document.snapshot(),
    targetIds:nextTargetIds,anchorIds:anchorIds.filter(id=>after.get(id)),
    preview:{changeCount:operations.length,changes,affectedNames:summarizeTargets(document,targetIds)},
    contextAfter:{targetIds:nextTargetIds,anchorIds:anchorIds.filter(id=>after.get(id)),lastSummary:summary}
  };
}
function requireTargets(resolution,verb="修改"){
  if(resolution.ambiguous) throw new Error("场景中有多个可能的目标（"+resolution.candidates.join("、")+"），请指定名称或先在视口中选中一个。");
  if(!resolution.ids.length) throw new Error("没有找到要"+verb+"的物体。请明确物体名称，或先选中物体。");
  return resolution.ids;
}
function directionDelta(text){
  if(/左边|左侧|向左|往左/.test(text))return [-.5,0,0];
  if(/右边|右侧|向右|往右/.test(text))return [.5,0,0];
  if(/上方|上面|高一点|再高/.test(text))return [0,.5,0];
  if(/下方|下面|低一点|再低/.test(text))return [0,-.5,0];
  if(/前面|前方|向前|往前/.test(text))return [0,0,.5];
  if(/后面|后方|向后|往后/.test(text))return [0,0,-.5];
  return null;
}

export function createConversationContext(){return {targetIds:[],anchorIds:[],lastSummary:null};}

export function preparePlan(input,document,context=createConversationContext(),selectedId=null){
  const text=String(input??"").trim();if(!text)throw new Error("请输入场景指令");
  const index=new SceneSemanticIndex(document),colorName=Object.keys(COLORS).map(name=>({name,index:text.lastIndexOf(name)})).filter(item=>item.index>=0).sort((a,b)=>b.index-a.index)[0]?.name,color=colorName?COLORS[colorName]:"#9b6842";
  const createVerb=/创建|生成|添加|放置|建造|搭建|建|放一|摆放/.test(text);

  if(createVerb&&/桥/.test(text)){
    const anchor=index.resolveAnchor(text);
    const anchorIds=requireTargets(anchor,"定位参照物");
    const anchorEntities=anchorIds.map(id=>document.get(id)).filter(Boolean);
    const groupId="group-bridge-"+document.nextId;
    const operations=bridgeEntities(anchorEntities,groupId).map(item=>({op:"create",entity:item}));
    return makePlan(document,operations,{summary:"在"+(anchorEntities[0].groupName??anchorEntities[0].name)+"旁边创建一座石桥",anchorIds});
  }
  if(createVerb&&text.includes("城堡")){
    const groupId="group-castle-"+document.nextId;
    const operations=castleEntities(color,groupId).map(item=>({op:"create",entity:item}));
    return makePlan(document,operations,{summary:"创建一座由基础几何体组成的城堡"});
  }
  const shape=SHAPES.find(item=>item.keys.some(key=>text.includes(key)));
  if(createVerb&&shape){
    const name=(colorName||"默认")+" "+shape.label;
    const operation={op:"create",entity:entity(shape.type,name,color,[0,.5,0])};
    return makePlan(document,[operation],{summary:"创建"+name});
  }

  let targetQuery=text,relationAnchorQuery=null;
  const relationMatch=text.match(/靠近|远离|旁边|附近/);
  if(relationMatch){
    const relationIndex=relationMatch.index,relation=relationMatch[0];
    if(relation==="靠近"||relation==="远离"){
      targetQuery=text.slice(0,relationIndex);
      relationAnchorQuery=text.slice(relationIndex+relation.length);
    }else{
      const prefix=text.slice(0,relationIndex);
      const split=prefix.match(/(?:放到|移到|挪到|移动到|到|向|朝)([^]*)$/);
      if(split){targetQuery=prefix.slice(0,split.index);relationAnchorQuery=split[1];}
      else targetQuery=prefix;
    }
  }
  const targetResolution=index.resolveTarget(targetQuery,{selectedId,contextTargetIds:context.targetIds});
  const targetIds=requireTargets(targetResolution,/删除|移除/.test(text)?"删除":"定位");
  const targetEntities=targetIds.map(id=>document.get(id)).filter(Boolean);

  if(/删除|移除/.test(text)){
    return makePlan(document,targetIds.map(id=>({op:"delete",id})),{summary:"删除"+targetEntities.map(e=>e.name).join("、"),targetIds});
  }
  if(/改成|变成|换成|涂成|颜色/.test(text)&&colorName){
    const operations=targetIds.map(id=>({op:"update",id,patch:{color}}));
    return makePlan(document,operations,{summary:"将"+targetEntities.length+"个物体改为"+colorName,targetIds});
  }
  if(/放大|缩小|大一点|小一点/.test(text)){
    const factor=/放大一倍|扩大一倍/.test(text)?2:/缩小一半|缩小一倍/.test(text)?.5:1.1;
    const bounds=boundsOf(targetEntities),groupCenter=bounds.center;
    const operations=targetIds.map(id=>{const current=document.get(id),patch={scale:current.scale.map(v=>v*factor)};if(targetIds.length>1)patch.position=current.position.map((v,i)=>groupCenter[i]+(v-groupCenter[i])*factor);return {op:"update",id,patch};});
    return makePlan(document,operations,{summary:"将"+targetEntities.length+"个物体"+(factor>1?"放大":"缩小"),targetIds,anchorIds:context.anchorIds??[]});
  }
  if(/移动|挪到|移到|放到|高一点|低一点|靠近|远离|向左|向右|向前|向后|往左|往右|往前|往后|旁边|附近/.test(text)){
    if(/旁边|附近/.test(text) && !/靠近|远离/.test(text)){
      const anchor=index.resolveAnchor(relationAnchorQuery??text,targetIds),anchorIds=requireTargets(anchor,"定位参照物");
      const anchorEntities=anchorIds.map(id=>document.get(id)),anchorBounds=boundsOf(anchorEntities),targetBounds=boundsOf(targetEntities);
      const destination=[anchorBounds.max[0]+(targetBounds.max[0]-targetBounds.min[0])/2+1, targetBounds.center[1], anchorBounds.center[2]];
      const delta=destination.map((v,i)=>v-targetBounds.center[i]);
      const operations=targetIds.map(id=>{const current=document.get(id);return {op:"update",id,patch:{position:current.position.map((v,i)=>v+delta[i])}};});
      return makePlan(document,operations,{summary:"将物体移动到参照物旁边",targetIds,anchorIds});
    }
    if(/靠近|远离/.test(text)){
      const anchor=index.resolveAnchor(relationAnchorQuery??text,targetIds),anchorIds=requireTargets(anchor,"定位参照物");
      const targetCenter=centerOf(targetEntities),anchorEntities=anchorIds.map(id=>document.get(id)),anchorCenter=centerOf(anchorEntities);
      const vector=anchorCenter.map((v,i)=>v-targetCenter[i]),length=Math.hypot(...vector)||1,amount=/远离/.test(text)?-.5:.5;
      const delta=vector.map(v=>v/length*amount);
      const operations=targetIds.map(id=>{const current=document.get(id);return {op:"update",id,patch:{position:current.position.map((v,i)=>v+delta[i])}};});
      return makePlan(document,operations,{summary:(amount>0?"让":"使")+targetEntities.length+"个物体"+(amount>0?"靠近":"远离")+"参照物",targetIds,anchorIds});
    }
    const delta=directionDelta(text);if(!delta)throw new Error("请说明移动方向：左、右、上、下、前或后。");
    const operations=targetIds.map(id=>{const current=document.get(id);return {op:"update",id,patch:{position:current.position.map((v,i)=>v+delta[i])}};});
    return makePlan(document,operations,{summary:"移动"+targetEntities.length+"个物体",targetIds,anchorIds:context.anchorIds??[]});
  }
  throw new Error("暂不理解这条指令。可试：在城堡旁边建一座桥、把它改成白色、再高一点、让桥靠近城堡一点。");
}

export function commitPlan(plan,document){
  if(!plan||typeof plan.baseSnapshot!=="string")throw new Error("修改预览无效");
  if(plan.baseSnapshot!==document.snapshot())throw new Error("场景已发生变化，旧预览已失效。请重新生成预览。");
  return applyOperations(document,plan.operations);
}

export function validateToolProposal(proposal,document){
  if(typeof proposal==="string")proposal=JSON.parse(proposal);
  if(!proposal||typeof proposal!=="object"||Array.isArray(proposal))throw new Error("模型提案必须是对象");
  if(Object.keys(proposal).some(key=>!["summary","operations"].includes(key)))throw new Error("模型提案包含未授权顶层字段");
  if(typeof proposal.summary!=="string"||!proposal.summary.trim()||proposal.summary.length>160)throw new Error("模型提案摘要无效");
  if(!Array.isArray(proposal.operations)||proposal.operations.length<1||proposal.operations.length>100)throw new Error("模型提案操作数量无效");
  const allowedEntity=new Set(["type","name","position","rotation","scale","material","color","groupId","groupName"]);
  const allowedPatch=new Set(["name","position","rotation","scale","material","color"]);
  const operations=proposal.operations.map(operation=>{
    if(!operation||typeof operation!=="object"||Array.isArray(operation))throw new Error("模型操作格式无效");
    if(operation.op==="create"){
      if(Object.keys(operation).some(key=>!["op","id","entity","patch"].includes(key))||operation.id!==null||operation.patch!==null||!operation.entity||typeof operation.entity!=="object"||Array.isArray(operation.entity)||Object.keys(operation.entity).some(key=>!allowedEntity.has(key)))throw new Error("模型创建操作包含未授权字段或格式错误");
      const entity=Object.fromEntries(Object.entries(operation.entity).filter(([,value])=>value!==null));
      if(!entity.type)throw new Error("模型创建操作缺少物体类型");
      return {op:"create",entity};
    }
    if(operation.op==="update"){
      if(Object.keys(operation).some(key=>!["op","id","entity","patch"].includes(key))||operation.entity!==null||typeof operation.id!=="string"||!operation.patch||typeof operation.patch!=="object"||Array.isArray(operation.patch)||Object.keys(operation.patch).some(key=>!allowedPatch.has(key)))throw new Error("模型修改操作包含未授权字段或格式错误");
      const patch=Object.fromEntries(Object.entries(operation.patch).filter(([,value])=>value!==null));
      if(!Object.keys(patch).length)throw new Error("模型修改操作没有有效属性");
      return {op:"update",id:operation.id,patch};
    }
    if(operation.op==="delete"){
      if(Object.keys(operation).some(key=>!["op","id","entity","patch"].includes(key))||operation.entity!==null||operation.patch!==null||typeof operation.id!=="string")throw new Error("模型删除操作格式无效");
      return {op:"delete",id:operation.id};
    }
    throw new Error("模型提案包含不支持的操作");
  });
  return makePlan(document,operations,{summary:proposal.summary,targetIds:operations.filter(operation=>operation.op==="update").map(operation=>operation.id)});
}
