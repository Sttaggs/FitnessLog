// Templates contain exercise identity, order, set counts, optional technique plans
// and superset links only; never actual performance measurements.
import {templatePlanForSet,normalizeSetPlan,blankSetFromPlan,cleanSupersets} from './advanced-utils.js';
// They never contain recorded performance values or constitute completed workouts.
export const MAX_TEMPLATE_EXERCISES=50;
export const MAX_TEMPLATE_SETS=20;
export function validSetCount(value){
 const number=Number(value);
 return Number.isInteger(number)&&number>=1&&number<=MAX_TEMPLATE_SETS?number:null;
}
export function cleanTemplateName(value){
 return String(value??'').trim().replace(/\s+/g,' ').slice(0,100);
}
export function templateFromWorkout(session,id,now=new Date().toISOString()){
 return {
  id,name:cleanTemplateName(session?.name)||'Workout template',createdAt:now,updatedAt:now,
  exercises:cleanSupersets((session?.exercises||[]).slice(0,MAX_TEMPLATE_EXERCISES).map(entry=>{
   const sets=(entry.sets||[]).slice(0,MAX_TEMPLATE_SETS);
   const item={exerciseId:String(entry.exerciseId||''),
    name:String(entry.name||'Exercise').trim(),
    sets:Math.max(1,sets.length)};
   if(sets.some(set=>templatePlanForSet(set).technique!=='standard'))
    item.setPlans=sets.map(templatePlanForSet);
   if(entry.supersetId)item.supersetId=String(entry.supersetId);
   return item;
  })),
 };
}
export function sanitizedTemplate(template){
 if(!template||typeof template!=='object'||typeof template.id!=='string'||!template.id.trim())return null;
 const exercises=Array.isArray(template.exercises)?template.exercises:[];
 return {
  id:template.id,
  name:cleanTemplateName(template.name)||'Workout template',
  createdAt:typeof template.createdAt==='string'?template.createdAt:'',
  updatedAt:typeof template.updatedAt==='string'?template.updatedAt:'',
  exercises:cleanSupersets(exercises.slice(0,MAX_TEMPLATE_EXERCISES).filter(item=>item&&typeof item==='object')
   .map(item=>{
    const sets=validSetCount(item.sets)||1;
    const cleaned={exerciseId:String(item.exerciseId||''),
      name:String(item.name||'Exercise').trim().slice(0,120),sets};
    if(Array.isArray(item.setPlans)){
     const plans=Array.from({length:sets},(_,i)=>normalizeSetPlan(item.setPlans[i]));
     if(plans.some(plan=>plan.technique!=='standard'))cleaned.setPlans=plans;
    }
    if(typeof item.supersetId==='string'&&item.supersetId.trim())cleaned.supersetId=item.supersetId;
    return cleaned;
   }))
 };
}
export function templateToEntries(template,library,newId){
 const byId=new Map((library||[]).map(ex=>[ex.id,ex]));
 const source=sanitizedTemplate(template);
 const supersetMap=new Map();
 return (source?.exercises||[]).map(item=>{
  const master=byId.get(item.exerciseId);
  const entry={
   id:newId(),exerciseId:master?.id||item.exerciseId,
   name:master?.name||item.name,technique:'Standard',notes:'',
   sets:Array.from({length:item.sets},(_,index)=>blankSetFromPlan(item.setPlans?.[index],newId))
  };
  if(item.supersetId){
   if(!supersetMap.has(item.supersetId))supersetMap.set(item.supersetId,newId());
   entry.supersetId=supersetMap.get(item.supersetId);
  }
  return entry;
 });
}
export function templateSummary(template){
 const parts=template?.exercises||[];
 const sets=parts.reduce((n,ex)=>n+(validSetCount(ex.sets)||1),0);
 return parts.length+' '+(parts.length===1?'exercise':'exercises')+' · '+sets+' sets';
}
