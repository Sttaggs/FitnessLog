import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVANCED_TYPES,MAX_STAGES,isAdvancedSet,setTechnique,techniqueLabel,newAdvancedSet,
 setTechniqueOnExisting,hasRecordedStages,templatePlanForSet,normalizeSetPlan,
 blankSetFromPlan,linkSuperset,removeSuperset,cleanSupersets} from '../advanced-utils.js';
import {templateFromWorkout,sanitizedTemplate,templateToEntries} from '../template-utils.js';
import {estimatedMax,progressionTrend,comparisonPoints,nextSessionAdvice} from '../progression.js';
import {muscleSetSummary} from '../muscle-utils.js';
import {renderAdvancedSetPanel,renderAdvancedTools,renderSupersetSettings,supersetLabel} from '../advanced-ui.js';
import {renderTemplateExerciseRow} from '../template-advanced-ui.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const record=(date,sets)=>({date,sessionId:date,sets});

test('ordinary set shape and estimated 1RM remain unchanged',()=>{
 const standard={id:'s',weight:'185',reps:'5',rpe:'8'};
 assert.equal(setTechnique(standard),'standard');
 assert.equal(isAdvancedSet(standard),false);
 assert.equal(estimatedMax(standard),185*(1+5/30));
 assert.deepEqual(blankSetFromPlan(null,()=> 'fresh'),{id:'fresh',weight:'',reps:'',rpe:''});
});
test('drop, Myo-reps and ladder add blank stages without invented loads or reps',()=>{
 let id=0;
 for(const type of ADVANCED_TYPES){
  const set=newAdvancedSet(type,()=>String(++id));
  assert.equal(isAdvancedSet(set),true);
  assert.equal(set.stages.length,2);
  assert.equal(set.technique,type);
  assert.ok(set.stages.every(stage=>stage.weight===''&&stage.reps===''&&stage.rpe===''));
  assert.equal(estimatedMax({...set,weight:200,reps:5}),null);
  assert.equal(techniqueLabel(set).length>0,true);
 }
 assert.equal(newAdvancedSet('drop',()=>String(++id),999).stages.length,MAX_STAGES);
 assert.throws(()=>newAdvancedSet('unknown',()=>String(++id)));
});
test('converting an existing set preserves the main measurements',()=>{
 let id=0;const original={id:'main',weight:'135',reps:'10',rpe:'9'};
 assert.equal(setTechniqueOnExisting(original,'drop',()=>String(++id)),true);
 assert.equal(original.weight,'135');
 assert.equal(original.reps,'10');
 original.stages[0].weight='115';
 assert.equal(hasRecordedStages(original),true);
 assert.equal(setTechniqueOnExisting(original,'standard',()=>String(++id)),true);
 assert.equal(original.technique,undefined);
 assert.equal(original.stages,undefined);
 assert.equal(original.weight,'135');
});
test('only two independent exercises receive a shared superset link',()=>{
 let next=0;const items=[{id:'one',sets:[{reps:'10'}]},{id:'two',sets:[{reps:'9'}]},{id:'three',sets:[]}];
 const ids=()=>String(++next);
 assert.equal(linkSuperset(items,0,1,ids),true);
 assert.equal(items[0].supersetId,items[1].supersetId);
 assert.equal(supersetLabel(items[0],items),'Superset A1');
 assert.equal(supersetLabel(items[1],items),'Superset A2');
 assert.equal(items[0].sets[0].reps,'10');
 assert.equal(linkSuperset(items,0,2,ids),true);
 assert.equal(items[1].supersetId,undefined);
 assert.equal(items[0].supersetId,items[2].supersetId);
 removeSuperset(items,0);
 assert.ok(items.every(x=>!x.supersetId));
 assert.equal(linkSuperset(items,1,1,ids),false);
 assert.equal(cleanSupersets([{id:'x',supersetId:'orphan'}])[0].supersetId,undefined);
});
test('advanced sets and supersets survive template save and load without actual performance values',()=>{
 let idx=0;const newId=()=>String(++idx);
 const exercises=[
  {id:'e1',exerciseId:'chest',name:'Chest press',supersetId:'g1',
   sets:[{id:'s',weight:'185',reps:'6',rpe:'9',technique:'drop',
    stages:[{id:'a',weight:'135',reps:'8',rpe:'9'},{id:'b',weight:'95',reps:'10',rpe:'10'}]}]},
  {id:'e2',exerciseId:'tris',name:'Triceps pushdown',supersetId:'g1',
   sets:[{id:'t',weight:'50',reps:'12',rpe:'8',technique:'myo',stages:[{id:'m',weight:'',reps:'4',rpe:''}]}]},
  {id:'e3',exerciseId:'shoulder',name:'Shoulder press',sets:[{id:'v',weight:'70',reps:'6',rpe:'9',technique:'ladder',
   stages:[{id:'l',weight:'75',reps:'5',rpe:'9'}]}]}
 ];
 const from=templateFromWorkout({name:'Advanced Push',exercises},'template','2026-11-13');
 assert.equal(JSON.stringify(from).includes('185'),false);
 assert.equal(JSON.stringify(from).includes('135'),false);
 assert.equal(from.exercises[0].setPlans[0].technique,'drop');
 assert.equal(from.exercises[1].setPlans[0].stages,1);
 assert.equal(from.exercises[2].setPlans[0].technique,'ladder');
 assert.equal(from.exercises[0].supersetId,from.exercises[1].supersetId);
 const stored=sanitizedTemplate(from);
 const library=[{id:'chest',name:'Chest press'},{id:'tris',name:'Triceps pushdown'},{id:'shoulder',name:'Shoulder press'}];
 const workoutA=templateToEntries(stored,library,newId);
 const workoutB=templateToEntries(stored,library,newId);
 assert.equal(workoutA[0].sets[0].technique,'drop');
 assert.equal(workoutA[1].sets[0].technique,'myo');
 assert.equal(workoutA[2].sets[0].technique,'ladder');
 assert.equal(workoutA[0].sets[0].stages.length,2);
 assert.equal(workoutA[0].sets[0].stages[0].weight,'');
 assert.equal(workoutA[1].sets[0].stages[0].reps,'');
 assert.notEqual(workoutA[0].sets[0].id,workoutB[0].sets[0].id);
 assert.notEqual(workoutA[0].supersetId,workoutB[0].supersetId);
 assert.equal(workoutA[0].supersetId,workoutA[1].supersetId);
 assert.equal(workoutA[2].supersetId,undefined);
});
test('template editor can configure methods and pair exercises without a workout session',()=>{
 const entries=[{exerciseId:'a',name:'A',sets:3,setPlans:[{technique:'drop',stages:2}]},
  {exerciseId:'b',name:'B',sets:2}];
 linkSuperset(entries,0,1,()=> 'paired');
 const template=sanitizedTemplate({id:'t',name:'Test',exercises:entries});
 const html=renderTemplateExerciseRow(template.exercises[0],0,template,esc,false);
 assert.match(html,/data-template-technique="0"/);
 assert.match(html,/data-template-stage-count="0"/);
 assert.match(html,/data-template-partner="0"/);
 assert.match(html,/data-template-advanced="0"/);
 assert.match(html,/Advanced options · Configured/);
 assert.doesNotMatch(html,/weight in pounds/);
 const started=templateToEntries(template,[{id:'a',name:'A'},{id:'b',name:'B'}],(()=>{let i=0;return()=>String(++i)})());
 assert.equal(started[0].sets[0].technique,'drop');
});
test('advanced sets count only once as muscle work even if many stages are logged',()=>{
 const sessions=[{status:'finished',date:'2026-11-13',exercises:[
  {exerciseId:'chest',sets:[
   {technique:'drop',reps:'8',stages:[{reps:'10'},{reps:'12'}]},
   {technique:'myo',reps:'15',stages:[{reps:'5'},{reps:'4'},{reps:'3'}]},
   {technique:'ladder',reps:'',stages:[{reps:'6'},{reps:'4'}]},
   {technique:'drop',reps:'8',warmup:true,stages:[{reps:'10'}]}
  ]}
 ]}];
 const summary=muscleSetSummary(sessions,[{id:'chest',muscle:'Chest'}],new Date('2026-11-13T12:00:00'));
 assert.equal(summary.rows[0].current,3);
});
test('advanced sets do not create misleading e1RM, fixed-load records or load increases',()=>{
 const advanced={weight:'185',reps:'5',rpe:'9',technique:'drop',
  stages:[{weight:'135',reps:'10'}]};
 assert.equal(estimatedMax(advanced),null);
 const history=[record('2026-11-01',[advanced])];
 assert.equal(progressionTrend(history).count,0);
 assert.equal(comparisonPoints(history,'repsAtWeight',185,'all').length,0);
 const exercise={progressTarget:{sets:1,reps:5,increment:5}};
 assert.equal(nextSessionAdvice(history[0],exercise).kind,'advanced');
 const supersetOrdinary={weight:'185',reps:'5',rpe:'8'};
 assert.ok(estimatedMax(supersetOrdinary)>185);
});
test('advanced stage panels remain collapsed unless selected and default set tools remain optional',()=>{
 const entry={id:'entry',name:'Bench',sets:[{id:'set'}]};
 const set={id:'advanced',technique:'myo',reps:'10',weight:'80',rpe:'9',
  stages:[{id:'st',weight:'',reps:'4',rpe:''}]};
 const closed=renderAdvancedSetPanel(entry,set,esc,false);
 const open=renderAdvancedSetPanel(entry,set,esc,true);
 assert.match(closed,/data-advanced-set="entry:advanced"/);
 assert.doesNotMatch(closed,/data-advanced-set="entry:advanced" open/);
 assert.match(open,/data-advanced-set="entry:advanced" open/);
 assert.match(closed,/Mini 1/);
 assert.doesNotMatch(closed,/placeholder="lb"/);
 assert.match(renderAdvancedTools(entry,esc),/Advanced sets/);
 assert.match(renderSupersetSettings(entry,[entry,{id:'another',name:'Rows'}],esc),/Link as superset/);
});
