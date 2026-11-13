// Each saved exercise has one primary muscle for weekly set attribution.
// Advanced sequences count as one parent set regardless of extra stages.
import {isAdvancedSet} from './advanced-utils.js';
// Historical secondary tag arrays are obsolete and are removed during migration.
export const MUSCLE_GROUPS=[
 'Chest','Back','Shoulders','Biceps','Triceps','Quadriceps','Hamstrings',
 'Glutes','Calves','Core','Forearms','Traps','Other'
];
const aliases={
 'quad':'Quadriceps','quads':'Quadriceps','quadricep':'Quadriceps',
 'hamstring':'Hamstrings','abs':'Core','abdominals':'Core','abdominal':'Core',
 'delts':'Shoulders','deltoids':'Shoulders','shoulder':'Shoulders',
 'pecs':'Chest','pectoral':'Chest','pectorals':'Chest',
 'lats':'Back','latissimus':'Back','glute':'Glutes','gluteals':'Glutes',
 'calf':'Calves','trapezius':'Traps','trap':'Traps',
 'forearm':'Forearms','bicep':'Biceps','tricep':'Triceps'
};
export function muscleLabel(value){
 const raw=String(value||'').trim();
 if(!raw)return '';
 const canonical=MUSCLE_GROUPS.find(group=>group.toLowerCase()===raw.toLowerCase());
 return canonical||aliases[raw.toLowerCase()]||raw;
}
export function exercisePrimaryMuscle(exercise){
 return muscleLabel(exercise?.muscle);
}
// Drop the discontinued field without changing any recorded training data or
// the exercise's permanent ID, category, primary muscle or progression target.
export function singleMuscleExercise(exercise){
 const record={...exercise};
 delete record.secondaryMuscles;
 return record;
}
export function muscleChoices(exercises){
 const choices=new Set(MUSCLE_GROUPS);
 for(const exercise of exercises||[]){
  const primary=exercisePrimaryMuscle(exercise);
  if(primary)choices.add(primary);
 }
 return [...choices];
}
export function weekStart(date){
 const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const mondayOffset=(day.getDay()+6)%7;
 day.setDate(day.getDate()-mondayOffset);
 return day;
}
const validReps=set=>{
 if(set?.warmup===true)return false;
 const reps=Number(set?.reps);
 if(set?.reps!==''&&set?.reps!==null&&set?.reps!==undefined&&Number.isFinite(reps)&&reps>0)return true;
 return isAdvancedSet(set)&&(set.stages||[]).some(stage=>
  stage.reps!==''&&stage.reps!==null&&stage.reps!==undefined&&Number(stage.reps)>0);
};
export function muscleSetSummary(sessions,exercises,referenceDate=new Date()){
 const byId=new Map((exercises||[]).map(exercise=>[exercise.id,exercise]));
 const currentStart=weekStart(referenceDate);
 const previousStart=new Date(currentStart.getTime());
 previousStart.setDate(previousStart.getDate()-7);
 const nextStart=new Date(currentStart.getTime());
 nextStart.setDate(nextStart.getDate()+7);
 const current=new Map(),previous=new Map();
 for(const session of sessions||[]){
  if(session.status!=='finished'||typeof session.date!=='string')continue;
  const date=new Date(session.date+'T12:00:00');
  if(!Number.isFinite(date.getTime())||date<previousStart||date>=nextStart)continue;
  const bucket=date>=currentStart?current:previous;
  for(const entry of session.exercises||[]){
   const muscle=exercisePrimaryMuscle(byId.get(entry.exerciseId));
   if(!muscle)continue;
   const count=(entry.sets||[]).filter(validReps).length;
   if(count)bucket.set(muscle,(bucket.get(muscle)||0)+count);
  }
 }
 return {
  currentStart,previousStart,
  rows:[...new Set([...current.keys(),...previous.keys()])].sort((a,b)=>
   (current.get(b)||0)-(current.get(a)||0)||a.localeCompare(b))
   .map(muscle=>({muscle,current:current.get(muscle)||0,previous:previous.get(muscle)||0}))
 };
}
