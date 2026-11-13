// Workout templates contain exercise identities, order and set counts only.
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
  exercises:(session?.exercises||[]).slice(0,MAX_TEMPLATE_EXERCISES).map(entry=>({
   exerciseId:String(entry.exerciseId||''),
   name:String(entry.name||'Exercise').trim(),
   sets:Math.min(MAX_TEMPLATE_SETS,Math.max(1,(entry.sets||[]).length)),
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
  exercises:exercises.slice(0,MAX_TEMPLATE_EXERCISES).filter(item=>item&&typeof item==='object')
   .map(item=>({
    exerciseId:String(item.exerciseId||''),
    name:String(item.name||'Exercise').trim().slice(0,120),
    sets:validSetCount(item.sets)||1
   }))
 };
}
export function templateToEntries(template,library,newId){
 const byId=new Map((library||[]).map(ex=>[ex.id,ex]));
 const source=sanitizedTemplate(template);
 return (source?.exercises||[]).map(item=>{
  const master=byId.get(item.exerciseId);
  return {
   id:newId(),exerciseId:master?.id||item.exerciseId,
   name:master?.name||item.name,technique:'Standard',notes:'',
   sets:Array.from({length:item.sets},()=>({id:newId(),weight:'',reps:'',rpe:''}))
  };
 });
}
export function templateSummary(template){
 const parts=template?.exercises||[];
 const sets=parts.reduce((n,ex)=>n+(validSetCount(ex.sets)||1),0);
 return parts.length+' '+(parts.length===1?'exercise':'exercises')+' · '+sets+' sets';
}
