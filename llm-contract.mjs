// Provider-neutral function-calling contract. A server-side adapter must send this
// definition to the selected model and pass its arguments through validateToolProposal.
export const TERRAMIND_FUNCTION = Object.freeze({
  type:"function",
  name:"propose_scene_operations",
  description:"Propose bounded 3D scene operations. Never return executable code. The host validates the proposal and asks the user to confirm before applying it.",
  strict:true,
  parameters:{
    type:"object",
    additionalProperties:false,
    properties:{
      summary:{type:"string",description:"Short Chinese description of the intended scene change."},
      operations:{
        type:"array",minItems:1,maxItems:100,
        items:{
          type:"object",additionalProperties:false,
          properties:{
            op:{type:"string",enum:["create","update","delete"]},
            id:{type:["string","null"]},
            entity:{type:["object","null"],additionalProperties:false,properties:{
              type:{type:"string",enum:["box","sphere","cylinder","cone"]},
              name:{type:["string","null"]},position:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},
              rotation:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},
              scale:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},
              material:{type:["string","null"],enum:["stone","wood","metal","glass","grass","custom",null]},
              color:{type:["string","null"]},groupId:{type:["string","null"]},groupName:{type:["string","null"]}
            },required:["type","name","position","rotation","scale","material","color","groupId","groupName"]},
            patch:{type:["object","null"],additionalProperties:false,properties:{
              name:{type:["string","null"]},position:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},
              rotation:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},scale:{type:["array","null"],items:{type:"number"},minItems:3,maxItems:3},
              material:{type:["string","null"],enum:["stone","wood","metal","glass","grass","custom",null]},color:{type:["string","null"]}
            },required:["name","position","rotation","scale","material","color"]}
          },required:["op","id","entity","patch"]
        }
      }
    },
    required:["summary","operations"]
  }
});
