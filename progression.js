// Pure, conservative progression analysis. All values come from recorded sets.
// RPE is interpreted as effort context, never inserted into the e1RM formula.
import {numericValue} from './analytics.js';

export function performedSet(set){
 const weight=numericValue(set?.weight), reps=numericValue(set?.reps);
 if(weight===null||weight<=0||reps===null||!Number.isInteger(reps)||reps<=0)return null;
 return {weight,reps,rpe:validRpe(set?.rpe),warmup:set?.warmup===true};
}
export function validRpe(value){
 const rpe=numericValue(value);
 return rpe!==null&&rpe>=1&&rpe<=10?rpe:null;
}
export function estimatedMax(set){
 if(set?.warmup===true)return null;
 const performance=performedSet(set);
 if(!performance||performance.reps>10)return null;
 const {weight,reps}=performance;
 return reps===1?weight:weight*(1+reps/30);
}
const rounded=(n,places=1)=>Math.round(n*10**places)/10**places;
export function sessionStrength(record){
 if(!record)return null;
 const eligible=(record.sets||[]).map(set=>({set,estimate:estimatedMax(set)}))
  .filter(x=>x.estimate!==null);
 if(!eligible.length)return null;
 eligible.sort((a,b)=>b.estimate-a.estimate);
 const best=eligible[0];
 return {date:record.date,sessionId:record.sessionId,value:rounded(best.estimate),weight:Number(best.set.weight),
  reps:Number(best.set.reps),rpe:validRpe(best.set.rpe)};
}
export function strengthSessions(history){
 return (history||[]).map(sessionStrength).filter(Boolean);
}
function median(values){
 const sorted=[...values].sort((a,b)=>a-b);
 return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
}
export function progressionTrend(history){
 const points=strengthSessions(history);
 const count=points.length;
 const latest=points.at(-1)||null;
 const previous=points.at(-2)||null;
 const sessionChange=latest&&previous&&previous.value>0?rounded((latest.value/previous.value-1)*100):null;
 if(count<6){
  return {status:'baseline',label:'Building baseline',change:null,sessionChange,count,latest,previous,
   description:count>=2?'Latest estimate compared with the previous session is shown below. Six measured sessions are needed for a longer-term trend.':'Log weight and 1–10 repetitions in completed workouts to build a strength trend.'};
 }
 const older=median(points.slice(-6,-3).map(p=>p.value));
 const newer=median(points.slice(-3).map(p=>p.value));
 const change=rounded((newer/older-1)*100);
 const status=change>3?'improving':change< -3?'declining':'steady';
 return {status,label:status==='improving'?'Progressing':status==='declining'?'Possible regression':'Holding steady',
  change,sessionChange,count,latest,previous,
  description:'Median of the three most recent measured sessions versus the preceding three. Changes within ±3% are treated as stable.'};
}
export function rangeFilter(history,range='90',referenceDate=new Date()){
 if(range==='all')return [...(history||[])];
 const days=Number(range);
 if(!Number.isFinite(days)||days<1)return [];
 const cutoff=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate());
 cutoff.setDate(cutoff.getDate()-days+1);
 return (history||[]).filter(record=>new Date(record.date+'T12:00:00')>=cutoff);
}
export function strengthChartPoints(history,range='90',referenceDate=new Date()){
 return strengthSessions(rangeFilter(history,range,referenceDate));
}
export function availableWeights(history){
 return [...new Set((history||[]).flatMap(record=>(record.sets||[])
  .filter(s=>s?.warmup!==true).map(s=>performedSet(s)?.weight).filter(w=>w!==undefined)))]
  .sort((a,b)=>a-b);
}
export function comparisonPoints(history,kind,filter,range='90',referenceDate=new Date()){
 const selected=Number(filter);
 if(!Number.isFinite(selected)||selected<=0)return [];
 return rangeFilter(history,range,referenceDate).map(record=>{
  const performances=(record.sets||[]).filter(s=>s?.warmup!==true).map(performedSet).filter(Boolean);
  const matches=kind==='weightAtReps'?
   performances.filter(p=>p.reps>=selected).map(p=>p.weight):
   performances.filter(p=>p.weight===selected).map(p=>p.reps);
  if(!matches.length)return null;
  return {...record,value:Math.max(...matches)};
 }).filter(Boolean);
}
export function latestWorkingPerformance(record){
 if(!record)return null;
 const options=(record.sets||[]).filter(s=>s?.warmup!==true)
  .map(performedSet).filter(Boolean);
 if(!options.length)return null;
 options.sort((a,b)=>{
  const aEstimate=a.reps<=10?a.weight*(1+a.reps/30):0;
  const bEstimate=b.reps<=10?b.weight*(1+b.reps/30):0;
  return bEstimate-aEstimate||b.weight-a.weight||b.reps-a.reps;
 });
 return options[0];
}
export function comparableEffort(history){
 const last=(history||[]).at(-1);
 const latest=latestWorkingPerformance(last);
 if(!latest||latest.rpe===null)return null;
 for(let i=(history||[]).length-2;i>=0;i--){
  const comparable=(history[i].sets||[]).filter(s=>s?.warmup!==true)
   .map(performedSet).find(p=>p&&p.weight===latest.weight&&p.reps===latest.reps&&p.rpe!==null);
  if(comparable)return {weight:latest.weight,reps:latest.reps,current:latest.rpe,previous:comparable.rpe,
   delta:rounded(latest.rpe-comparable.rpe),priorDate:history[i].date};
 }
 return null;
}
export function normalizedTarget(exercise){
 const raw=exercise?.progressTarget||{};
 const integer=(v,min,max)=>v===''||v===null||v===undefined?null:
  Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
 const sets=integer(raw.sets,1,12);
 const reps=integer(raw.reps,1,30);
 const increment=numericValue(raw.increment);
 const rpe=validRpe(raw.rpeCeiling);
 return {sets,reps,increment:increment!==null&&increment>=0.5&&increment<=50?increment:null,rpeCeiling:rpe};
}
export function nextSessionAdvice(record,exercise){
 const target=normalizedTarget(exercise);
 if(!target.sets||!target.reps||!target.increment){
  return {kind:'not-set',label:'Set an optional exercise target',description:'Choose working sets, reps and weight increment under More in a workout. Progress analysis works without targets.',suggested:null};
 }
 if(!record)return {kind:'missing',label:'Awaiting a completed session',description:'A finished workout with this exercise is needed before suggesting an adjustment.',suggested:null};
 const entries=(record.sets||[]).filter(s=>s?.warmup!==true)
  .filter(s=>['weight','reps','rpe'].some(key=>s?.[key]!==''&&s?.[key]!==null&&s?.[key]!==undefined));
 const measured=entries.map(performedSet);
 if(entries.length!==target.sets||measured.some(p=>p===null)){
  return {kind:'missing',label:'Not enough comparable working sets',
   description:'Record '+target.sets+' working sets with weight and repetitions. Mark warm-ups under More to exclude them.',suggested:null};
 }
 const load=measured[0].weight;
 if(!measured.every(p=>p.weight===load)){
  return {kind:'mixed',label:'Review mixed working weights',description:'Working-set weights varied, so the app will not recommend a single new load.',suggested:null};
 }
 const hits=measured.filter(p=>p.reps>=target.reps).length;
 if(hits<target.sets)return {kind:'build',label:'Build repetitions',description:hits+' of '+target.sets+' working sets reached '+target.reps+' repetitions at '+load+' lb. Maintain the load and work toward the target.',suggested:load};
 if(target.rpeCeiling!==null){
  if(measured.some(p=>p.rpe===null))return {kind:'uncertain',label:'Target met; effort unconfirmed',
   description:'All repetitions were achieved, but some sets lack RPE. Keep the current load or review effort before increasing.',suggested:null};
  if(measured.some(p=>p.rpe>target.rpeCeiling))return {kind:'hold',label:'Keep the current load',
   description:'All repetitions were achieved, but at least one set exceeded the RPE ceiling of '+target.rpeCeiling+'.',suggested:load};
 }
 const next=rounded(load+target.increment,2);
 return {kind:'increase',label:'Consider '+next+' lb next time',
  description:'All '+target.sets+' working sets reached '+target.reps+' repetitions at '+load+' lb'+(target.rpeCeiling!==null?' without exceeding RPE '+target.rpeCeiling:'')+'. The '+target.increment+' lb increase is optional.',suggested:next};
}
