const TYPE_ALIASES = [
  {type:"box", keys:["立方体","方块","正方体","盒子"]},
  {type:"sphere", keys:["球体","球"]},
  {type:"cylinder", keys:["圆柱体","圆柱"]},
  {type:"cone", keys:["圆锥体","圆锥"]}
];
const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[\s，。！？、,.!?；;：:]/g, "");
const GROUP_ALIASES = {"石桥":["桥","桥梁"],"城堡":["城堡"]};
const unique = values => [...new Set(values)];

export class SceneSemanticIndex {
  constructor(document) {
    this.document = document;
    this.groups = new Map();
    for (const entity of document.entities) {
      if (!entity.groupId) continue;
      if (!this.groups.has(entity.groupId)) this.groups.set(entity.groupId, {id:entity.groupId,name:entity.groupName,entities:[]});
      this.groups.get(entity.groupId).entities.push(entity);
    }
  }

  groupByName(text, excludedIds=[]) {
    const query = normalize(text);
    if(!query)return {ids:[],ambiguous:false,candidates:[]};
    const excluded = new Set(excludedIds);
    const matches = [...this.groups.values()].filter(group => {
      const name = normalize(group.name);
      const aliases=GROUP_ALIASES[group.name]??[];
      return name && (query.includes(name) || (name.length > 1 && name.includes(query)) || aliases.some(alias=>query.includes(normalize(alias)))) && group.entities.some(entity => !excluded.has(entity.id));
    }).sort((a,b)=>normalize(b.name).length-normalize(a.name).length);
    if (!matches.length) return {ids:[],ambiguous:false,candidates:[]};
    const bestLength = normalize(matches[0].name).length;
    const best = matches.filter(group=>normalize(group.name).length===bestLength);
    if (best.length > 1) return {ids:[],ambiguous:true,candidates:best.map(group=>group.name)};
    return {ids:best[0].entities.filter(entity=>!excluded.has(entity.id)).map(entity=>entity.id),ambiguous:false,candidates:[]};
  }

  resolveTarget(text, {selectedId=null, contextTargetIds=[]}={}) {
    const query = normalize(text);
    const validContext = unique(contextTargetIds).filter(id=>this.document.get(id));
    const pronoun = /它|这个|那个|刚才|上一个|再|继续|当前物体|选中物体/.test(query);
    if(/最后一个|最后创建/.test(query) && this.document.entities.length){
      const last=this.document.entities.at(-1);
      const members=last.groupId?this.document.entities.filter(entity=>entity.groupId===last.groupId):[last];
      return {ids:members.map(entity=>entity.id),ambiguous:false,reason:"last-created"};
    }

    const named = this.document.entities
      .filter(entity => normalize(entity.name).length > 1 && query.includes(normalize(entity.name)))
      .sort((a,b)=>normalize(b.name).length-normalize(a.name).length);
    if (named.length) return {ids:[named[0].id],ambiguous:false,reason:"explicit-name"};

    const group = this.groupByName(query);
    if (group.ambiguous) return {...group,reason:"ambiguous-group"};
    if (group.ids.length) return {...group,reason:"group-name"};

    if (pronoun && validContext.length) return {ids:validContext,ambiguous:false,reason:"conversation-context"};
    if (pronoun && selectedId && this.document.get(selectedId)) return {ids:[selectedId],ambiguous:false,reason:"selection"};

    const typeMatch = TYPE_ALIASES.find(item=>item.keys.some(key=>query.includes(normalize(key))));
    if (typeMatch) {
      const matches = this.document.entities.filter(entity=>entity.type===typeMatch.type);
      if (matches.length===1) return {ids:[matches[0].id],ambiguous:false,reason:"type-alias"};
      if (matches.length>1) {
        if (selectedId && matches.some(entity=>entity.id===selectedId)) return {ids:[selectedId],ambiguous:false,reason:"selected-type"};
        return {ids:[],ambiguous:true,candidates:matches.map(entity=>entity.name),reason:"ambiguous-type"};
      }
    }
    if (selectedId && this.document.get(selectedId) && /选中|当前物体/.test(query)) return {ids:[selectedId],ambiguous:false,reason:"selection"};
    return {ids:[],ambiguous:false,reason:"not-found"};
  }

  resolveAnchor(text, excludedIds=[]) {
    const result=this.groupByName(text,excludedIds);
    if(result.ids.length || result.ambiguous) return result;
    const query=normalize(text);
    const named=this.document.entities.filter(entity=>!excludedIds.includes(entity.id) && normalize(entity.name).length>1 && query.includes(normalize(entity.name)));
    if(named.length===1) return {ids:[named[0].id],ambiguous:false,candidates:[]};
    if(named.length>1) return {ids:[],ambiguous:true,candidates:named.map(entity=>entity.name)};
    return {ids:[],ambiguous:false,candidates:[]};
  }
}

export function summarizeTargets(document, ids) {
  return unique(ids).map(id=>document.get(id)).filter(Boolean).map(entity=>entity.name);
}
