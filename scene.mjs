const TYPES = new Set(["box","sphere","cylinder","cone"]);
const MATERIALS = new Set(["stone","wood","metal","glass","grass","custom"]);
const finite = Number.isFinite;
const clone = x => JSON.parse(JSON.stringify(x));

export class SceneDocument {
  constructor(){ this.version=1; this.nextId=1; this.entities=[]; }
  create({type="box",name,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],material="stone"}={}) {
    if(!TYPES.has(type)) throw Error("unsupported entity type");
    if(!MATERIALS.has(material)) throw Error("unsupported material");
    for(const [k,v] of Object.entries({position,rotation,scale})) if(!Array.isArray(v)||v.length!==3||!v.every(finite)) throw Error("invalid "+k);
    if(scale.some(v=>v<=0||v>100)) throw Error("scale out of range");
    const e={id:"entity-"+this.nextId++,type,name:String(name||type).slice(0,80),position:[...position],rotation:[...rotation],scale:[...scale],material};
    this.entities.push(e); return clone(e);
  }
  update(id,patch={}) {
    const e=this.entities.find(x=>x.id===id); if(!e) throw Error("entity not found");
    const allowed=new Set(["name","position","rotation","scale","material"]);
    if(Object.keys(patch).some(k=>!allowed.has(k))) throw Error("unsupported property");
    const n={...e,...clone(patch)};
    if(typeof n.name!=="string"||!n.name.length||n.name.length>80) throw Error("invalid name");
    if(!MATERIALS.has(n.material)) throw Error("unsupported material");
    for(const k of ["position","rotation","scale"]) if(!Array.isArray(n[k])||n[k].length!==3||!n[k].every(finite)) throw Error("invalid "+k);
    if(n.scale.some(v=>v<=0||v>100)) throw Error("scale out of range");
    Object.assign(e,n); return clone(e);
  }
  remove(id){const i=this.entities.findIndex(e=>e.id===id);if(i<0)throw Error("entity not found");return this.entities.splice(i,1)[0];}
  get(id){const e=this.entities.find(x=>x.id===id);return e?clone(e):null;}
  snapshot(){return JSON.stringify({version:this.version,nextId:this.nextId,entities:this.entities});}
  static restore(serialized){
    const raw=JSON.parse(serialized);
    if(raw.version!==1||!Number.isInteger(raw.nextId)||!Array.isArray(raw.entities))throw Error("invalid scene document");
    const d=new SceneDocument();d.nextId=raw.nextId;
    for(const e of raw.entities){if(!e||typeof e.id!=="string"||d.entities.some(x=>x.id===e.id))throw Error("invalid or duplicate entity");const c=d.create(e);c.id=e.id;d.entities[d.entities.length-1]=c;}
    d.nextId=raw.nextId;return d;
  }
}
