import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TransformControls} from "three/addons/controls/TransformControls.js";
import {SceneDocument,applyOperations} from "./scene.mjs";
import {executeIntent} from "./intent.mjs";

const $=selector=>document.querySelector(selector);
const viewport=$("#viewport");
let documentModel=new SceneDocument(),selectedId=null;
let undoStack=[],redoStack=[],meshById=new Map(),editableMeshes=[];
const scene=new THREE.Scene();
scene.background=new THREE.Color("#101d22");
scene.fog=new THREE.Fog("#101d22",35,110);
const camera=new THREE.PerspectiveCamera(45,1,.1,300);
camera.position.set(10,9,12);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,1,0);orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xd9f0ff,0x3d493d,2.1));
const sun=new THREE.DirectionalLight(0xffe2bd,3.2);
sun.position.set(-8,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:"#263b3a",roughness:.92}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(40,40,"#55706a","#344b49");grid.position.y=-.02;scene.add(grid);
const transform=new TransformControls(camera,renderer.domElement);
scene.add(transform.getHelper());
transform.addEventListener("dragging-changed",event=>{orbit.enabled=!event.value;});
let transformBefore=null;
transform.addEventListener("mouseDown",()=>{if(selectedId)transformBefore=documentModel.snapshot();});
transform.addEventListener("objectChange",()=>{
  if(!selectedId)return;
  const mesh=meshById.get(selectedId);if(!mesh)return;
  try{documentModel.update(selectedId,{position:mesh.position.toArray(),rotation:mesh.rotation.toArray().slice(0,3),scale:mesh.scale.toArray()});}
  catch(error){setStatus(error.message,true);}
});
transform.addEventListener("mouseUp",()=>{
  if(transformBefore&&transformBefore!==documentModel.snapshot()){pushUndo(transformBefore);persist();}
  transformBefore=null;renderEntityList();refreshInspector();
});

function setStatus(message,error=false){$("#status").textContent=message;$("#status").style.color=error?"#e99a85":"#8fd6ac";}
function pushUndo(snapshot){undoStack.push(snapshot);if(undoStack.length>80)undoStack.shift();redoStack=[];updateHistoryButtons();}
function updateHistoryButtons(){$("#undo").disabled=!undoStack.length;$("#redo").disabled=!redoStack.length;}
function persist(){try{localStorage.setItem("terramind-scene-v1",documentModel.snapshot());}catch(error){setStatus("浏览器本地保存不可用："+error.message,true);}}
function materialFor(entity){
  const options={color:entity.color,roughness:.72,metalness:0};
  if(entity.material==="metal"){options.roughness=.28;options.metalness=.72;}
  if(entity.material==="glass"){options.roughness=.12;options.transparent=true;options.opacity=.58;}
  return new THREE.MeshStandardMaterial(options);
}
function geometryFor(type){
  if(type==="sphere")return new THREE.SphereGeometry(.5,32,24);
  if(type==="cylinder")return new THREE.CylinderGeometry(.5,.5,1,28);
  if(type==="cone")return new THREE.ConeGeometry(.5,1,28);
  return new THREE.BoxGeometry(1,1,1);
}
function buildMesh(entity){
  const mesh=new THREE.Mesh(geometryFor(entity.type),materialFor(entity));
  mesh.name=entity.name;mesh.userData.entityId=entity.id;
  mesh.position.set(...entity.position);mesh.rotation.set(...entity.rotation);mesh.scale.set(...entity.scale);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function rebuildView(){
  transform.detach();
  for(const mesh of editableMeshes){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  editableMeshes=[];meshById.clear();
  for(const entity of documentModel.entities){
    const mesh=buildMesh(entity);scene.add(mesh);editableMeshes.push(mesh);meshById.set(entity.id,mesh);
  }
  if(selectedId&&meshById.has(selectedId))transform.attach(meshById.get(selectedId));else selectedId=null;
  renderEntityList();refreshInspector();updateHistoryButtons();
}
function selectEntity(id){
  selectedId=id&&meshById.has(id)?id:null;
  if(selectedId)transform.attach(meshById.get(selectedId));else transform.detach();
  renderEntityList();refreshInspector();
}
function renderEntityList(){
  const list=$("#entityList");list.replaceChildren();
  $("#entityCount").textContent=String(documentModel.entities.length);
  for(const entity of documentModel.entities){
    const button=document.createElement("button");button.className="entity-item"+(entity.id===selectedId?" active":"");
    button.textContent=entity.name+" · "+entity.type;button.onclick=()=>selectEntity(entity.id);list.appendChild(button);
  }
}
function refreshInspector(){
  const entity=selectedId?documentModel.get(selectedId):null;
  $("#inspector").hidden=!!entity;$("#propertyForm").hidden=!entity;
  if(!entity)return;
  $("#propName").value=entity.name;$("#propColor").value=entity.color;
  $("#posX").value=entity.position[0];$("#posY").value=entity.position[1];$("#posZ").value=entity.position[2];
}
function applyPlan(plan){
  const before=documentModel.snapshot();
  const next=applyOperations(documentModel,plan.operations);
  if(next.snapshot()===before){setStatus("没有产生场景变化");return;}
  pushUndo(before);documentModel=next;
  const lastCreated=[...plan.operations].reverse().find(op=>op.op==="create");
  if(lastCreated)selectedId=documentModel.entities.at(-1)?.id;
  else{
    const updated=[...plan.operations].reverse().find(op=>op.op==="update");
    selectedId=updated?.id??(documentModel.get(selectedId)?selectedId:null);
  }
  rebuildView();persist();setStatus("完成："+plan.summary);
}
function runCommand(text){
  try{const result=executeIntent(text,documentModel,selectedId);applyPlan(result.plan);}
  catch(error){setStatus(error.message,true);}
}
$("#execute").onclick=()=>runCommand($("#command").value);
$("#command").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();runCommand($("#command").value);}});
document.querySelectorAll("[data-create]").forEach(button=>button.addEventListener("click",()=>runCommand(button.dataset.create)));
$("#applyProperties").onclick=()=>{
  if(!selectedId)return;
  try{
    const before=documentModel.snapshot();
    documentModel.update(selectedId,{name:$("#propName").value,color:$("#propColor").value,position:[$("#posX").valueAsNumber,$("#posY").valueAsNumber,$("#posZ").valueAsNumber]});
    if(documentModel.snapshot()!==before){pushUndo(before);rebuildView();persist();setStatus("物体属性已更新");}
  }catch(error){setStatus(error.message,true);}
};
$("#deleteSelected").onclick=()=>{if(selectedId)applyPlan({summary:"删除物体",operations:[{op:"delete",id:selectedId}]});};
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{transform.setMode(button.dataset.mode);setStatus("当前工具："+button.textContent);}));
$("#undo").onclick=()=>{
  if(!undoStack.length)return;
  redoStack.push(documentModel.snapshot());documentModel=SceneDocument.restore(undoStack.pop());selectedId=null;rebuildView();persist();setStatus("已撤销");
};
$("#redo").onclick=()=>{
  if(!redoStack.length)return;
  undoStack.push(documentModel.snapshot());documentModel=SceneDocument.restore(redoStack.pop());selectedId=null;rebuildView();persist();setStatus("已重做");
};
$("#save").onclick=()=>{
  const blob=new Blob([documentModel.snapshot()],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="terramind-scene.json";link.click();URL.revokeObjectURL(url);setStatus("场景文件已导出");
};
$("#load").onclick=()=>$("#fileInput").click();
$("#fileInput").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{const loaded=SceneDocument.restore(await file.text());pushUndo(documentModel.snapshot());documentModel=loaded;selectedId=null;rebuildView();persist();setStatus("场景已载入："+file.name);}
  catch(error){setStatus("载入失败："+error.message,true);}
  event.target.value="";
};
$("#undo").disabled=$("#redo").disabled=true;

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown",event=>{
  if(event.button!==0||transform.dragging)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(editableMeshes,false)[0];
  if(hit)selectEntity(hit.object.userData.entityId);
  else if(!event.shiftKey)selectEntity(null);
});
const resize=new ResizeObserver(()=>{
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(!width||!height)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
});
resize.observe(viewport);
try{
  const saved=localStorage.getItem("terramind-scene-v1");
  if(saved)documentModel=SceneDocument.restore(saved);
}catch(error){setStatus("本地场景恢复失败，已创建空场景",true);}
rebuildView();
renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera);});
