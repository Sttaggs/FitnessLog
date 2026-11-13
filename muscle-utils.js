// An exercise has one primary muscle for set-count attribution; secondary tags
// describe involvement without multiplying recorded sets across muscle groups.
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
export function exerciseSecondaryMuscles(exercise){
 const primary=exercisePrimaryMuscle(exercise);
 const unique=new Set();
 for(const item of (Array.isArray(exercise?.secondaryMuscles)?exercise.secondaryMuscles:[])){
  const label=muscleLabel(item);
  if(label&&label!==primary)unique.add(label);
 }
 return [...unique];
}
export function muscleChoices(exercises){
 const choices=new Set(MUSCLE_GROUPS);
 for(const exercise of exercises||[]){
  const primary=exercisePrimaryMuscle(exercise);
  if(primary)choices.add(primary);
  for(const secondary of exerciseSecondaryMuscles(exercise))choices.add(secondary);
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
 if(set?.reps===''||set?.reps===null||set?.reps===undefined)return false;
 const value=Number(set.reps);
 return Number.isFinite(value)&&value>0;
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
