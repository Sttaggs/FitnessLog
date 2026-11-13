import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatedMax,progressionTrend,comparisonPoints,nextSessionAdvice,comparableEffort,strengthSessions} from '../progression.js';
import {muscleSetSummary} from '../muscle-utils.js';
import {renderProgressView} from '../progress-ui.js';

const record=(date,sets)=>({sessionId:date,date,sessionName:'Workout',createdAt:date,sets,notes:''});
const set=(weight,reps,rpe='',warmup=false)=>({weight,reps,rpe,warmup});
const target={progressTarget:{sets:2,reps:5,increment:5,rpeCeiling:9}};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('estimated strength uses recorded weight/reps but never unrecorded values or RPE',()=>{
 assert.equal(estimatedMax(set(185,1)),185);
 assert.equal(estimatedMax(set(185,5)),185*(1+5/30));
 assert.equal(estimatedMax(set(185,5,10)),estimatedMax(set(185,5,7)));
 for(const bad of [set('',5),set(185,''),set(185,11),set(0,5),set(185,0),set(185,2.5),set(185,5,8,true)]){
  assert.equal(estimatedMax(bad),null);
 }
});
test('trend requires six eligible sessions and compares medians, not one bad result',()=>{
 const samples=[100,100,100,106,106,106].map((w,i)=>record('2026-10-'+String(i+1).padStart(2,'0'),[set(w,5)]));
 assert.equal(progressionTrend(samples.slice(0,5)).status,'baseline');
 assert.equal(progressionTrend(samples).status,'improving');
 const stable=samples.map((item,i)=>i>=3?{...item,sets:[set(102,5)]}:item);
 assert.equal(progressionTrend(stable).status,'steady');
 const declining=samples.map((item,i)=>i>=3?{...item,sets:[set(94,5)]}:item);
 assert.equal(progressionTrend(declining).status,'declining');
});
test('a missing set does not discard other valid measured sets',()=>{
 const hist=[record('2026-11-01',[set('',5),set(135,5),set(135,''),set(200,12)])];
 assert.equal(strengthSessions(hist).length,1);
 assert.equal(strengthSessions(hist)[0].value,157.5);
});
test('load advice requires full matched working sets and only recorded values',()=>{
 const success=record('2026-11-01',[set(135,5,8),set(135,5,9)]);
 assert.equal(nextSessionAdvice(success,target).kind,'increase');
 assert.equal(nextSessionAdvice(success,target).suggested,140);
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,8)]),target).kind,'missing');
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,8),set('',5)]),target).kind,'missing');
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,8),set(140,5,8)]),target).kind,'mixed');
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,8),set(135,4,8)]),target).kind,'build');
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,10),set(135,5,9)]),target).kind,'hold');
 assert.equal(nextSessionAdvice(record('2026-11-01',[set(135,5,''),set(135,5,9)]),target).kind,'uncertain');
 assert.equal(nextSessionAdvice(success,{}).kind,'not-set');
 assert.equal(nextSessionAdvice(null,target).kind,'missing');
});
test('explicit warmup marking keeps warmups out of advice, trends and muscle totals',()=>{
 const workout=record('2026-11-12',[set(95,10,6,true),set(135,5,8),set(135,5,8)]);
 assert.equal(nextSessionAdvice(workout,target).kind,'increase');
 assert.equal(strengthSessions([workout])[0].weight,135);
 const sessions=[{status:'finished',date:'2026-11-12',exercises:[{exerciseId:'bench',sets:workout.sets}]}];
 const summary=muscleSetSummary(sessions,[{id:'bench',muscle:'Chest'}],new Date('2026-11-13T12:00:00'));
 assert.equal(summary.rows.find(r=>r.muscle==='Chest')?.current,2);
 assert.equal(summary.rows.length,1);
});
test('RPE 10 without a ceiling still prevents an unqualified weight increase',()=>{
 const advice=nextSessionAdvice(record('2026-11-01',[set(135,5,10),set(135,5,9)]),
  {progressTarget:{sets:2,reps:5,increment:5}});
 assert.equal(advice.kind,'hold');
});
test('fixed-weight reps and weight at rep threshold are not mixed',()=>{
 const history=[
  record('2026-11-02',[set(135,8),set(150,5)]),
  record('2026-11-04',[set(135,10),set(155,4)])
 ];
 assert.deepEqual(comparisonPoints(history,'repsAtWeight',135,'all').map(x=>x.value),[8,10]);
 assert.deepEqual(comparisonPoints(history,'weightAtReps',5,'all').map(x=>x.value),[150,135]);
});
test('RPE is compared only when matching both weight and reps',()=>{
 const hist=[record('2026-11-01',[set(135,5,9)]),record('2026-11-02',[set(135,5,8)])];
 assert.equal(comparableEffort(hist).delta,-1);
 assert.equal(comparableEffort([hist[0],record('2026-11-02',[set(140,5,8)])]),null);
});
test('Progress renders selected section only, with expandable history and comparison',()=>{
 const entries=[2,3,4,5,6,7].map((day,i)=>({
  id:'w'+day,status:'finished',date:'2026-11-'+String(day).padStart(2,'0'),name:'Training',
  exercises:[{exerciseId:'bench',sets:[set(135+i*5,5,8),set(135+i*5,5,9)]}]
 }));
 const state={sessions:entries,exercises:[{id:'bench',name:'Bench Press',muscle:'Chest',progressTarget:{sets:2,reps:5,increment:5,rpeCeiling:9}}],
  progressExercise:'bench',progressSection:'exercises',progressRange:'all',progressWeight:'all',progressRepTarget:'5',
  progressCompareType:'repsAtWeight',progressCompareOpen:false,progressTargetOpen:false,photos:[],photoView:'Front'};
 const render=()=>renderProgressView({state,e:esc,displayDate:x=>x,photoUrl:()=>''});
 const first=render();
 assert.match(first,/Progressing/);
 assert.match(first,/Best set · latest workout/);
 assert.match(first,/Estimated 1RM/);
 assert.match(first,/NEXT WORKOUT/);
 assert.match(first,/Compare performance another way/);
 assert.match(first,/Recorded sessions \(6\)/);
 assert.doesNotMatch(first,/Progress Photos/);
 state.progressSection='muscles';
 assert.match(render(),/Weekly muscle sets/);
 assert.doesNotMatch(render(),/Estimated strength/);
 state.progressSection='photos';
 assert.match(render(),/Progress Photos/);
 assert.doesNotMatch(render(),/Estimated 1RM/);
});

test('Progress exercise picker is searchable, accessible, and never creates exercises',()=>{
 const sessions=[{id:'s1',status:'finished',date:'2026-11-11',name:'Workout',exercises:[{exerciseId:'a',sets:[{weight:'100',reps:'8'}]}]}];
 const base={sessions,exercises:[{id:'a',name:'Cable lateral raise',muscle:'Shoulders'},{id:'b',name:'Seated cable row',muscle:'Back'}],
  progressExercise:'a',progressSection:'exercises',progressRange:'all',progressWeight:'all',progressRepTarget:'5',
  progressCompareType:'repsAtWeight',progressCompareOpen:false,progressTargetOpen:false,photos:[],photoView:'Front'};
 const html=renderProgressView({state:base,e:esc,displayDate:x=>x,photoUrl:()=>''});
 assert.match(html,/id="progress-exercise-search"/);
 assert.match(html,/role="combobox"/);
 assert.match(html,/aria-controls="progress-exercise-options"/);
 assert.match(html,/id="progress-exercise-search" type="text" value=""/);
 assert.match(html,/placeholder="Type an exercise name"/);
 assert.match(html,/Viewing: <strong>Cable lateral raise<\/strong>/);
 assert.match(html,/id="progress-exercise-options"/);
 assert.doesNotMatch(html,/id="progress-exercise" data-progress-control="exercise"/);
 assert.doesNotMatch(html,/data-form="add-exercise"/);
 assert.match(html,/Estimated strength/);
 const empty=renderProgressView({state:{...base,exercises:[],sessions:[],progressExercise:''},e:esc,displayDate:x=>x,photoUrl:()=>''});
 assert.match(empty,/id="progress-exercise-search"[^>]*disabled/);
});
