import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFromWorkout,templateToEntries,sanitizedTemplate,validSetCount,templateSummary,MAX_TEMPLATE_EXERCISES} from '../template-utils.js';

test('save from a logged workout keeps order and set counts but never copies performance data',()=>{
 const session={id:'workout-1',name:'Push day',status:'finished',date:'2026-11-13',
  intensity:'7',fatigue:'6',notes:'private',
  exercises:[
   {id:'entry1',exerciseId:'bench',name:'Machine bench press',notes:'felt weak',
    sets:[{id:'s1',weight:'185',reps:'8',rpe:'9'},{id:'s2',weight:'185',reps:'6',rpe:'10'}]},
   {id:'entry2',exerciseId:'flies',name:'Cable flies',
    sets:[{id:'s3',weight:'20',reps:'10',rpe:'8'}]}
  ]};
 const plan=templateFromWorkout(session,'template-1','2026-11-13T12:00:00Z');
 assert.equal(plan.name,'Push day');
 assert.deepEqual(plan.exercises,[{exerciseId:'bench',name:'Machine bench press',sets:2},
  {exerciseId:'flies',name:'Cable flies',sets:1}]);
 assert.equal(plan.id,'template-1');
 assert.equal(plan.status,undefined);
 assert.equal(plan.date,undefined);
 assert.equal(plan.notes,undefined);
 assert.equal(JSON.stringify(plan).includes('185'),false);
 assert.equal(JSON.stringify(plan).includes('felt weak'),false);
});
test('starting from template creates independent blank workout sets and new IDs',()=>{
 const template={id:'t1',name:'Pull',exercises:[{exerciseId:'lat',name:'Old name',sets:3},
   {exerciseId:'row',name:'Row',sets:2}]};
 let i=0;const ids=()=>String(++i);
 const first=templateToEntries(template,[{id:'lat',name:'Cable lat pulldown'},{id:'row',name:'Machine row'}],ids);
 const second=templateToEntries(template,[{id:'lat',name:'Cable lat pulldown'},{id:'row',name:'Machine row'}],ids);
 assert.equal(first.length,2);
 assert.equal(first[0].name,'Cable lat pulldown');
 assert.equal(first[0].sets.length,3);
 assert.equal(first[1].sets.length,2);
 assert.notEqual(first[0].id,second[0].id);
 assert.notEqual(first[0].sets[0].id,second[0].sets[0].id);
 assert.ok(first.every(entry=>entry.sets.every(set=>set.weight===''&&set.reps===''&&set.rpe==='')));
 assert.equal(first[0].notes,'');
 assert.equal(template.exercises[0].name,'Old name');
});
test('sanitization never allows weight reps RPE dates or recorded status in template payload',()=>{
 const raw={id:'t',name:'  Legs  ',status:'finished',date:'2026-11-13',
  exercises:[{exerciseId:'squat',name:'Squat',sets:3,weight:200,reps:5,rpe:9,warmup:true}]};
 const clean=sanitizedTemplate(raw);
 assert.equal(clean.name,'Legs');
 assert.deepEqual(clean.exercises,[{exerciseId:'squat',name:'Squat',sets:3}]);
 assert.equal(clean.status,undefined);
 assert.equal(clean.date,undefined);
 assert.equal(clean.exercises[0].weight,undefined);
});
test('invalid, empty and excessive counts normalize safely',()=>{
 assert.equal(validSetCount(''),null);
 assert.equal(validSetCount(0),null);
 assert.equal(validSetCount(21),null);
 assert.equal(validSetCount(2.3),null);
 assert.equal(validSetCount(3),3);
 const plan=sanitizedTemplate({id:'t',name:'test',exercises:[{name:'One',sets:0},{name:'Two',sets:80}]});
 assert.deepEqual(plan.exercises.map(x=>x.sets),[1,1]);
 assert.equal(sanitizedTemplate({id:'',name:'bad'}),null);
 const many={id:'many',name:'Lots',exercises:Array.from({length:60},(_,i)=>({name:'Exercise '+i,sets:3}))};
 assert.equal(sanitizedTemplate(many).exercises.length,MAX_TEMPLATE_EXERCISES);
});
test('template summary and editable records do not rely on workout sessions',()=>{
 const t={id:'abc',name:'Back',exercises:[{exerciseId:'x',name:'Lat pulldown',sets:3},{exerciseId:'y',name:'Row',sets:4}]};
 assert.equal(templateSummary(t),'2 exercises · 7 sets');
 assert.equal(templateSummary({exercises:[]}), '0 exercises · 0 sets');
 const plan=sanitizedTemplate(t);
 plan.exercises[0].sets=5;
 assert.equal(t.exercises[0].sets,3);
});
