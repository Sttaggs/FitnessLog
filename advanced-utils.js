// Optional advanced resistance-set structures. Each advanced set is one parent
// working set. Stages/mini-sets are retained for review but not counted as
// additional conventional sets or used for estimated strength calculations.
export const ADVANCED_TYPES=['drop','myo','ladder'];
export const TECHNIQUE_LABELS={standard:'Standard',drop:'Drop set',myo:'Myo-reps',ladder:'Ladder'};
export const MAX_STAGES=12;
export function setTechnique(set){
 const type=set?.technique;
 return ADVANCED_TYPES.includes(type)?type:'standard';
}
export function isAdvancedSet(set){return setTechnique(set)!=='standard';}
export function techniqueLabel(value){
 const type=typeof value==='string'?value:setTechnique(value);
 return TECHNIQUE_LABELS[type]||'Standard';
}
export function stageCount(set){
 return Array.isArray(set?.stages)?set.stages.length:0;
}
export function newAdvancedSet(type,newId,stageTotal=2){
 if(!ADVANCED_TYPES.includes(type))throw new Error('Unknown advanced set type');
 const total=Number.isInteger(stageTotal)?Math.max(1,Math.min(MAX_STAGES,stageTotal)):2;
 return {id:newId(),weight:'',reps:'',rpe:'',technique:type,
  stages:Array.from({length:total},()=>({id:newId(),weight:'',reps:'',rpe:''}))};
}
export function setTechniqueOnExisting(set,type,newId){
 if(!set||!['standard',...ADVANCED_TYPES].includes(type))return false;
 if(type==='standard'){
  delete set.technique;
  delete set.stages;
  return true;
 }
 if(setTechnique(set)===type)return true;
 set.technique=type;
 set.stages=Array.from({length:2},()=>({id:newId(),weight:'',reps:'',rpe:''}));
 return true;
}
export function hasRecordedStages(set){
 return (set?.stages||[]).some(stage=>['weight','reps','rpe'].some(field=>
  stage[field]!==''&&stage[field]!==null&&stage[field]!==undefined));
}
export function templatePlanForSet(set){
 const type=setTechnique(set);
 return {technique:type,stages:type==='standard'?0:Math.max(1,Math.min(MAX_STAGES,stageCount(set)||2))};
}
export function normalizeSetPlan(plan){
 const type=ADVANCED_TYPES.includes(plan?.technique)?plan.technique:'standard';
 const numeric=Number(plan?.stages);
 return {technique:type,stages:type==='standard'?0:
  Number.isInteger(numeric)&&numeric>=1&&numeric<=MAX_STAGES?numeric:2};
}
export function blankSetFromPlan(plan,newId){
 const clean=normalizeSetPlan(plan);
 if(clean.technique==='standard')return {id:newId(),weight:'',reps:'',rpe:''};
 return newAdvancedSet(clean.technique,newId,clean.stages);
}
// Superset link is a shared group ID on exactly two independent exercises.
// Joining/unlinking never alters exercise IDs or the content of their sets.
export function removeSuperset(entries,index){
 const group=entries?.[index]?.supersetId;
 if(!group)return;
 for(const item of entries)if(item.supersetId===group)delete item.supersetId;
}
export function linkSuperset(entries,first,second,newId){
 if(!Array.isArray(entries)||first===second||first<0||second<0||
  first>=entries.length||second>=entries.length)return false;
 removeSuperset(entries,first);
 removeSuperset(entries,second);
 const group=newId();
 entries[first].supersetId=group;
 entries[second].supersetId=group;
 return true;
}
export function cleanSupersets(entries){
 const counts=new Map();
 for(const entry of entries||[]){
  if(entry.supersetId)counts.set(entry.supersetId,(counts.get(entry.supersetId)||0)+1);
 }
 for(const entry of entries||[]){
  if(entry.supersetId&&counts.get(entry.supersetId)!==2)delete entry.supersetId;
 }
 return entries;
}
