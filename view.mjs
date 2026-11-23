import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TransformControls} from "three/addons/controls/TransformControls.js";
import {SceneDocument} from "./scene.mjs";
import {preparePlan,commitPlan,createConversationContext} from "./assistant.mjs";

const $=selector=>document.querySelector(selector);
const viewport=$("#viewport");
let documentModel=new SceneDocument(),selectedId=null;
let undoStack=[],redoStack=[],meshById=new Map(),editableMeshes=[];
let conversationContext=createConversationContext(),pendingPlan=null,pendingMeta=null,conversationHistory=[];
const scene=new THREE.Scene();
scene.background=new THREE.Color("#101d22");scene.fog=new THREE.Fog("#101d22",35,110);
const camera=new THREE.PerspectiveCamera(45,1,.1,300);camera.position.set(10,9,12);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;viewport.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1,0);orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xd9f0ff,0x3d493d,2.1));
const sun=new THREE.DirectionalLight(0xffe2bd,3.2);sun.position.set(-8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:"#263b3a",roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(40,40,"#55706a","#344b49");grid.position.y=-.02;scene.add(grid);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());
transform.addEventListener("dragging-changed",event=>{orbit.enabled=!event.value;});
let transformBefore=null;
transform.addEventListener("mouseDown",()=>{if(selectedId)transformBefore=documentModel.snapshot();});
transform.addEventListener("objectChange",()=>{
  if(!selectedId)return;const mesh=meshById.get(selectedId);if(!mesh)return;
  try{documentModel.update(selectedId,{position:mesh.position.toArray(),rotation:mesh.rotation.toArray().slice(0,3),scale:mesh.scale.toArray()});}catch(error){setStatus(error.message,true);}
});
transform.addEventListener("mouseUp",()=>{if(transformBefore&&transformBefore!==documentModel.snapshot()){pushUndo(transformBefore);conversationContext={...conversationContext,targetIds:selectedId?[selectedId]:[],anchorIds:[]};persist();}transformBefore=null;renderEntityList();refreshInspector();});

function setStatus(message,error=false){$("#status").textContent=message;$("#status").style.color=error?"#e99a85":"#8fd6ac";}
function pushUndo(snapshot){undoStack.push(snapshot);if(undoStack.length>80)undoStack.shift();redoStack=[];updateHistoryButtons();}
function updateHistoryButtons(){$("#undo").disabled=!undoStack.length;$("#redo").disabled=!redoStack.length;}
function persist(){try{localStorage.setItem("terramind-scene-v1",documentModel.snapshot());}catch(error){setStatus("浏览器本地保存不可用："+error.message,true);}}
function materialFor(entity){const options={color:entity.color,roughness:.72,metalness:0};if(entity.material==="metal"){options.roughness=.28;options.metalness=.72;}if(entity.material==="glass"){options.roughness=.12;options.transparent=true;options.opacity=.58;}return new THREE.MeshStandardMaterial(options);}
function geometryFor(type){if(type==="sphere")return new THREE.SphereGeometry(.5,32,24);if(type==="cylinder")return new THREE.CylinderGeometry(.5,.5,1,28);if(type==="cone")return new THREE.ConeGeometry(.5,1,28);return new THREE.BoxGeometry(1,1,1);}
function buildMesh(entity){const mesh=new THREE.Mesh(geometryFor(entity.type),materialFor(entity));mesh.name=entity.name;mesh.userData.entityId=entity.id;mesh.position.set(...entity.position);mesh.rotation.set(...entity.rotation);mesh.scale.set(...entity.scale);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function rebuildView(){transform.detach();for(const mesh of editableMeshes){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}editableMeshes=[];meshById.clear();for(const entity of documentModel.entities){const mesh=buildMesh(entity);scene.add(mesh);editableMeshes.push(mesh);meshById.set(entity.id,mesh);}if(selectedId&&meshById.has(selectedId))transform.attach(meshById.get(selectedId));else selectedId=null;renderEntityList();refreshInspector();updateHistoryButtons();}
function selectEntity(id){
  selectedId=id&&meshById.has(id)?id:null;
  if(selectedId){transform.attach(meshById.get(selectedId));conversationContext={...conversationContext,targetIds:[selectedId],anchorIds:[]};}
  else transform.detach();renderEntityList();refreshInspector();
}
function renderEntityList(){const list=$("#entityList");list.replaceChildren();$("#entityCount").textContent=String(documentModel.entities.length);for(const entity of documentModel.entities){const button=document.createElement("button");button.className="entity-item"+(entity.id===selectedId?" active":"");button.textContent=entity.name+" · "+entity.type;button.onclick=()=>selectEntity(entity.id);list.appendChild(button);}}
function refreshInspector(){const entity=selectedId?documentModel.get(selectedId):null;$("#inspector").hidden=!!entity;$("#propertyForm").hidden=!entity;if(!entity)return;$("#propName").value=entity.name;$("#propColor").value=entity.color;$("#posX").value=entity.position[0];$("#posY").value=entity.position[1];$("#posZ").value=entity.position[2];}
function hidePlanPreview(){pendingPlan=null;pendingMeta=null;$("#planPreview").hidden=true;$("#planChanges").replaceChildren();}
function formatValue(value){if(Array.isArray(value))return "("+value.map(v=>Number(v).toFixed(2)).join(", ")+")";if(value&&typeof value==="object")return JSON.stringify(value);return String(value);}
function showPlanPreview(plan,meta={}){pendingPlan=plan;pendingMeta=meta;$("#planMode").textContent=meta.source==="ai"?"AI 模型提案":"本地规则回退";$("#planSummary").textContent=plan.summary+" · "+plan.preview.changeCount+" 项操作";const list=$("#planChanges");list.replaceChildren();for(const change of plan.preview.changes){const item=document.createElement("li");let detail=change.action+"："+change.label;if(change.fields?.length){detail+="（"+change.fields.map(key=>key+" "+formatValue(change.before?.[key])+" → "+formatValue(change.after?.[key])).join("；")+"）";}else if(change.after?.position){detail+=" · 位置 "+formatValue(change.after.position);}item.textContent=detail;list.appendChild(item);}$("#planPreview").hidden=false;}
async function refreshModelStatus(){try{const response=await fetch("/api/health",{cache:"no-store"});if(!response.ok)throw Error("AI 网关不可用");const health=await response.json();$("#modelStatus").textContent=health.providerConfigured?"AI 已配置 · "+(health.model||"模型就绪"):"AI 未配置 · 本地规则可用";}catch{$("#modelStatus").textContent="未连接 AI 网关 · 本地规则可用";}}
async function previewCommand(text){const command=String(text??"").trim();if(!command)return;hidePlanPreview();$("#execute").disabled=true;setStatus("正在理解指令并分析当前场景…");try{const response=await fetch("/api/plan",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({command,sceneSnapshot:documentModel.snapshot(),selectedId,context:conversationContext,history:conversationHistory.slice(-8)})});const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw Object.assign(Error("未检测到 TerraMind AI 网关；请运行 node server.mjs。"),{code:"api_unavailable"});}if(!response.ok)throw Object.assign(Error(data.error?.message||"AI 规划请求失败"),{code:data.error?.code||"api_error",status:response.status});if(!data.plan||!Array.isArray(data.plan.operations)||!data.plan.preview||!Array.isArray(data.plan.preview.changes))throw Object.assign(Error("AI 网关返回的计划结构无效。"),{code:"invalid_plan"});showPlanPreview(data.plan,{source:"ai",command,reply:data.reply||""});setStatus("AI 规划完成 · "+(data.model||"模型服务")+"；请检查预览。");}catch(error){const canFallback=error instanceof TypeError||["api_unavailable","provider_not_configured","provider_network_error","provider_timeout","not_found"].includes(error.code);if(canFallback){try{const plan=preparePlan(command,documentModel,conversationContext,selectedId);showPlanPreview(plan,{source:"local",command});setStatus("AI 服务未就绪，本次使用本地规则规划器；该模式只支持有限指令。");}catch(localError){hidePlanPreview();setStatus("AI 服务不可用："+error.message+"；本地规则也无法解析："+localError.message,true);}}else{hidePlanPreview();setStatus(error.message,true);}}finally{$("#execute").disabled=false;}}
function confirmPendingPlan(){if(!pendingPlan)return;try{const before=documentModel.snapshot(),plan=pendingPlan,meta=pendingMeta??{},next=commitPlan(plan,documentModel);pushUndo(before);documentModel=next;conversationContext=plan.contextAfter;selectedId=plan.targetIds.find(id=>documentModel.get(id))??null;if(meta.command){conversationHistory.push({role:"user",content:meta.command},{role:"assistant",content:plan.summary});conversationHistory=conversationHistory.slice(-8);}hidePlanPreview();rebuildView();persist();setStatus("已应用："+plan.summary);}catch(error){hidePlanPreview();setStatus(error.message,true);}}
$("#execute").onclick=()=>previewCommand($("#command").value);
$("#command").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();previewCommand($("#command").value);}});
document.querySelectorAll("[data-create]").forEach(button=>button.addEventListener("click",()=>previewCommand(button.dataset.create)));
$("#confirmPlan").onclick=confirmPendingPlan;$("#cancelPlan").onclick=()=>{hidePlanPreview();setStatus("已取消本次预览");};
$("#applyProperties").onclick=()=>{if(!selectedId)return;try{const before=documentModel.snapshot();documentModel.update(selectedId,{name:$("#propName").value,color:$("#propColor").value,position:[$("#posX").valueAsNumber,$("#posY").valueAsNumber,$("#posZ").valueAsNumber]});if(documentModel.snapshot()!==before){pushUndo(before);conversationContext={...conversationContext,targetIds:[selectedId],anchorIds:[]};rebuildView();persist();setStatus("物体属性已更新");}}catch(error){setStatus(error.message,true);}};
$("#deleteSelected").onclick=()=>{if(selectedId){const entity=documentModel.get(selectedId);previewCommand("删除"+entity.name);}};
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{transform.setMode(button.dataset.mode);setStatus("当前工具："+button.textContent);}));
$("#undo").onclick=()=>{if(!undoStack.length)return;redoStack.push(documentModel.snapshot());documentModel=SceneDocument.restore(undoStack.pop());selectedId=null;conversationContext=createConversationContext();conversationHistory=[];hidePlanPreview();rebuildView();persist();setStatus("已撤销");};
$("#redo").onclick=()=>{if(!redoStack.length)return;undoStack.push(documentModel.snapshot());documentModel=SceneDocument.restore(redoStack.pop());selectedId=null;conversationContext=createConversationContext();conversationHistory=[];hidePlanPreview();rebuildView();persist();setStatus("已重做");};
$("#save").onclick=()=>{const blob=new Blob([documentModel.snapshot()],{type:"application/json"});const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="terramind-scene.json";link.click();URL.revokeObjectURL(url);setStatus("场景文件已导出");};
$("#load").onclick=()=>$("#fileInput").click();
$("#fileInput").onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{const loaded=SceneDocument.restore(await file.text());pushUndo(documentModel.snapshot());documentModel=loaded;selectedId=null;conversationContext=createConversationContext();conversationHistory=[];hidePlanPreview();rebuildView();persist();setStatus("场景已载入："+file.name);}catch(error){setStatus("载入失败："+error.message,true);}event.target.value="";};
$("#undo").disabled=$("#redo").disabled=true;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown",event=>{if(event.button!==0||transform.dragging)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(editableMeshes,false)[0];if(hit)selectEntity(hit.object.userData.entityId);else if(!event.shiftKey)selectEntity(null);});
const resize=new ResizeObserver(()=>{const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(viewport);
try{const saved=localStorage.getItem("terramind-scene-v1");if(saved)documentModel=SceneDocument.restore(saved);}catch(error){setStatus("本地场景恢复失败，已创建空场景",true);}
rebuildView();refreshModelStatus();renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera);});
