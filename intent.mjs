import {applyOperations} from "./scene.mjs";

const COLORS={
  红色:"#d65c55",橙色:"#e58a45",黄色:"#e5c45b",绿色:"#579b69",
  蓝色:"#5b91d1",紫色:"#9472c8",白色:"#e8e9e4",黑色:"#30383c",
  棕色:"#966443",粉色:"#df91ad"
};
const SHAPES=[
  {keys:["立方体","方块","正方体"],type:"box",label:"立方体"},
  {keys:["球体","球"],type:"sphere",label:"球体"},
  {keys:["圆柱体","圆柱"],type:"cylinder",label:"圆柱体"},
  {keys:["圆锥体","圆锥"],type:"cone",label:"圆锥体"}
];
const pickColor=text=>Object.keys(COLORS).map(name=>({name,index:text.lastIndexOf(name)})).filter(item=>item.index>=0).sort((a,b)=>b.index-a.index)[0]?.name;
const findTarget=(text,document,selectedId)=>{
  if(/选中|当前物体/.test(text)&&selectedId&&document.get(selectedId)) return selectedId;
  if(/最后一个|最后创建|刚才的物体/.test(text)) return document.entities.at(-1)?.id;
  const named=document.entities.find(entity=>text.includes(entity.name));
  if(named) return named.id;
  const kind=SHAPES.find(shape=>shape.keys.some(key=>text.includes(key)));
  if(kind) return document.entities.find(entity=>entity.type===kind.type)?.id;
  if(text.includes("城堡")) return document.entities.find(entity=>entity.name.includes("城堡"))?.id;
  return selectedId&&document.get(selectedId)?selectedId:undefined;
};
const findTargets=(text,document,selectedId)=>{
  if(text.includes("城堡")){
    const group=document.entities.filter(entity=>entity.name.includes("城堡"));
    if(group.length)return group.map(entity=>entity.id);
  }
  const id=findTarget(text,document,selectedId);
  return id?[id]:[];
};
const entity=(type,name,color,position,scale=[1,1,1])=>({type,name,material:"custom",color,position,scale});

function castleEntities(color){
  const towers=[[-1.45,1.05,-1.1],[1.45,1.05,-1.1],[-1.45,1.05,1.1],[1.45,1.05,1.1]];
  const entities=[entity("box","城堡主楼",color,[0,1.1,0],[2.4,2.2,2])];
  towers.forEach((position,index)=>{
    entities.push(entity("cylinder","城堡塔楼"+(index+1),color,position,[.48,2.1,.48]));
    entities.push(entity("cone","城堡塔尖"+(index+1),color,[position[0],2.45,position[2]],[.62,.7,.62]));
  });
  entities.push(entity("box","城堡大门","#493b35",[0,.45,1.06],[.55,.9,.08]));
  return entities;
}

export function parseIntent(input,document,selectedId=null){
  const text=String(input||"").trim();
  if(!text) throw Error("先输入一句场景指令");
  const colorName=pickColor(text), color=colorName?COLORS[colorName]:COLORS.棕色;
  const createVerb=/创建|生成|添加|放置|建造|放一|摆放/.test(text);

  if(createVerb && text.includes("城堡")){
    return {summary:"创建一座由基础几何体组成的城堡",operations:castleEntities(color).map(item=>({op:"create",entity:item}))};
  }
  const shape=SHAPES.find(item=>item.keys.some(key=>text.includes(key)));
  if(createVerb && shape){
    const name=(colorName||"默认")+" "+shape.label;
    return {summary:"创建"+name,operations:[{op:"create",entity:entity(shape.type,name,color,[0,.5,0])}]};
  }

  const targetIds=findTargets(text,document,selectedId);
  if(/删除|移除/.test(text)){
    if(!targetIds.length) throw Error("没有找到要删除的物体；请先选中物体或指定名称");
    return {summary:"删除物体",operations:targetIds.map(id=>({op:"delete",id}))};
  }
  if(/改成|变成|换成|涂成|颜色/.test(text) && colorName){
    if(!targetIds.length) throw Error("没有找到要修改的物体；请先选中物体或指定名称");
    return {summary:"将物体颜色改为"+colorName,operations:targetIds.map(id=>({op:"update",id,patch:{color}}))};
  }
  if(/放大|缩小/.test(text)){
    if(!targetIds.length) throw Error("没有找到要缩放的物体");
    const factor=/放大一倍|扩大一倍/.test(text)?2:/缩小一半|缩小一倍/.test(text)?.5:1.2;
    return {summary:factor>1?"放大物体":"缩小物体",operations:targetIds.map(id=>{const current=document.get(id);return {op:"update",id,patch:{scale:current.scale.map(v=>v*factor)}};})};
  }
  if(/移动|挪到|移到|放到/.test(text)){
    if(!targetIds.length) throw Error("没有找到要移动的物体");
    const delta=[0,0,0];
    if(/左边|左侧/.test(text)) delta[0]=-2;
    else if(/右边|右侧/.test(text)) delta[0]=2;
    else if(/上方|上面/.test(text)) delta[1]=1;
    else if(/下方|下面/.test(text)) delta[1]=-1;
    else if(/前面|前方/.test(text)) delta[2]=2;
    else if(/后面|后方/.test(text)) delta[2]=-2;
    else throw Error("目前支持左、右、上、下、前、后六个方向");
    return {summary:"移动物体",operations:targetIds.map(id=>{const current=document.get(id);return {op:"update",id,patch:{position:current.position.map((v,i)=>v+delta[i])}};})};
  }
  throw Error("暂不支持这条指令。试试：创建红色立方体、创建一座蓝色城堡、把最后一个物体改成白色、把最后一个物体移动到左边、删除最后一个物体。");
}

export function executeIntent(input,document,selectedId=null){
  const plan=parseIntent(input,document,selectedId);
  return {plan,document:applyOperations(document,plan.operations)};
}
