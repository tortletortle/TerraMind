const TYPES = new Set(["box","sphere","cylinder","cone"]);
const MATERIALS = new Set(["stone","wood","metal","glass","grass","custom"]);
const DEFAULT_COLORS = {stone:"#aeb8b2",wood:"#9b6842",metal:"#8796a0",glass:"#76b9cf",grass:"#4f9b62",custom:"#d65c55"};
const isFiniteNumber = Number.isFinite;
const clone = value => JSON.parse(JSON.stringify(value));
const validVector = value => Array.isArray(value) && value.length === 3 && value.every(v => isFiniteNumber(v) && Math.abs(v) <= 10000);
const validColor = value => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

export class SceneDocument {
  constructor(){ this.version=1; this.nextId=1; this.entities=[]; }
  create({type="box",name,position=[0,0.5,0],rotation=[0,0,0],scale=[1,1,1],material="stone",color}={}) {
    if(!TYPES.has(type)) throw Error("不支持的物体类型");
    if(!MATERIALS.has(material)) throw Error("不支持的材质");
    if(!validVector(position)||!validVector(rotation)||!validVector(scale)) throw Error("位置、旋转和缩放必须是三个有限数字");
    if(scale.some(v=>v<=0||v>100)) throw Error("缩放范围必须大于 0 且不超过 100");
    color = color ?? DEFAULT_COLORS[material];
    if(!validColor(color)) throw Error("颜色必须是 #RRGGBB 格式");
    const entity={id:"entity-"+this.nextId++,type,name:String(name||type).slice(0,80),position:[...position],rotation:[...rotation],scale:[...scale],material,color};
    this.entities.push(entity);
    return clone(entity);
  }
  update(id,patch={}) {
    const entity=this.entities.find(e=>e.id===id);
    if(!entity) throw Error("找不到指定物体");
    if(!patch || typeof patch!=="object" || Array.isArray(patch)) throw Error("修改参数无效");
    const allowed=new Set(["name","position","rotation","scale","material","color"]);
    if(Object.keys(patch).some(k=>!allowed.has(k))) throw Error("不允许修改该属性");
    const next={...entity,...clone(patch)};
    if(typeof next.name!=="string"||!next.name.length||next.name.length>80) throw Error("物体名称长度必须为 1–80 个字符");
    if(!MATERIALS.has(next.material)) throw Error("不支持的材质");
    if(!validColor(next.color)) throw Error("颜色必须是 #RRGGBB 格式");
    for(const key of ["position","rotation","scale"]) if(!validVector(next[key])) throw Error(key+" 参数无效");
    if(next.scale.some(v=>v<=0||v>100)) throw Error("缩放范围必须大于 0 且不超过 100");
    Object.assign(entity,next);
    return clone(entity);
  }
  remove(id){
    const index=this.entities.findIndex(e=>e.id===id);
    if(index<0) throw Error("找不到指定物体");
    return this.entities.splice(index,1)[0];
  }
  get(id){const entity=this.entities.find(e=>e.id===id);return entity?clone(entity):null;}
  snapshot(){return JSON.stringify({version:this.version,nextId:this.nextId,entities:this.entities});}
  static restore(serialized){
    const raw=JSON.parse(serialized);
    if(!raw||raw.version!==1||!Number.isInteger(raw.nextId)||raw.nextId<1||!Array.isArray(raw.entities)) throw Error("场景文件格式无效");
    const doc=new SceneDocument(); let maxId=0;
    for(const entity of raw.entities){
      if(!entity||typeof entity.id!=="string"||!/^entity-\d+$/.test(entity.id)||doc.entities.some(e=>e.id===entity.id)) throw Error("场景中存在无效或重复的物体 ID");
      const created=doc.create(entity); created.id=entity.id; doc.entities[doc.entities.length-1]=created;
      maxId=Math.max(maxId,Number(entity.id.slice(7)));
    }
    if(raw.nextId<=maxId) throw Error("场景 ID 序列无效");
    doc.nextId=raw.nextId;
    return doc;
  }
}

export function applyOperations(document,operations){
  if(!Array.isArray(operations)||operations.length<1||operations.length>100) throw Error("操作列表无效");
  const next=SceneDocument.restore(document.snapshot());
  for(const operation of operations){
    if(!operation||typeof operation!=="object") throw Error("操作格式无效");
    if(operation.op==="create") next.create(operation.entity);
    else if(operation.op==="update") next.update(operation.id,operation.patch);
    else if(operation.op==="delete") next.remove(operation.id);
    else throw Error("不支持的场景操作");
  }
  return next;
}
