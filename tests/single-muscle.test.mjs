import test from 'node:test';
import assert from 'node:assert/strict';
import {muscleChoices,exercisePrimaryMuscle,singleMuscleExercise,muscleSetSummary} from '../muscle-utils.js';
import {CATALOG_EXERCISES,planCatalogInstall} from '../exercise-catalog.js';

test('legacy secondary tags are removed without changing exercise IDs, targets, or workout metadata',()=>{
 const original={
  id:'bench-1',name:'Machine chest press',muscle:'Chest',
  secondaryMuscles:['Shoulders','Triceps'],progressTarget:{sets:4,reps:6,increment:5},
  category:'Chest',equipment:'Machine',notes:'Keep this',createdAt:'2025-01-01'
 };
 const result=singleMuscleExercise(original);
 assert.equal(Object.hasOwn(result,'secondaryMuscles'),false);
 assert.equal(result.id,original.id);
 assert.equal(result.muscle,'Chest');
 assert.deepEqual(result.progressTarget,original.progressTarget);
 assert.equal(result.category,'Chest');
 assert.equal(result.notes,'Keep this');
 assert.deepEqual(original.secondaryMuscles,['Shoulders','Triceps']);
});
test('single-muscle cleanup is idempotent and handles an unassigned exercise',()=>{
 const existing={id:'x',name:'Walking',muscle:''};
 const once=singleMuscleExercise(existing);
 assert.deepEqual(singleMuscleExercise(once),once);
 assert.equal(exercisePrimaryMuscle(once),'');
});
test('muscle choices include saved primary labels but ignore obsolete secondary labels',()=>{
 const choices=muscleChoices([
  {id:'1',muscle:'Chest',secondaryMuscles:['Other Extra Tag']},
  {id:'2',muscle:'Custom Muscle',secondaryMuscles:['Some More Tags']}
 ]);
 assert.ok(choices.includes('Chest'));
 assert.ok(choices.includes('Custom Muscle'));
 assert.equal(choices.includes('Other Extra Tag'),false);
 assert.equal(choices.includes('Some More Tags'),false);
});
test('weekly working sets are attributed exactly once to the assigned group',()=>{
 const sessions=[{
  id:'workout',status:'finished',date:'2026-11-13',
  exercises:[{exerciseId:'bench',sets:[
   {weight:'135',reps:'10'},{weight:'135',reps:'10'},
   {weight:'45',reps:'10',warmup:true}
  ]}]
 }];
 const exercises=[{id:'bench',muscle:'Chest',secondaryMuscles:['Triceps','Shoulders']}];
 const result=muscleSetSummary(sessions,exercises,new Date('2026-11-13T12:00:00'));
 assert.deepEqual(result.rows.map(r=>r.muscle),['Chest']);
 assert.equal(result.rows[0].current,2);
});
test('new starter exercises have only one muscle group each',()=>{
 assert.equal(CATALOG_EXERCISES.length,105);
 assert.ok(CATALOG_EXERCISES.every(exercise=>typeof exercise.muscle==='string'));
 assert.ok(CATALOG_EXERCISES.every(exercise=>!Object.hasOwn(exercise,'secondaryMuscles')));
 const plan=planCatalogInstall([],()=>Math.random().toString(36),'2026-11-13');
 assert.ok(plan.toInsert.every(exercise=>!Object.hasOwn(exercise,'secondaryMuscles')));
});
test('catalog installation strips obsolete secondary field without replacing existing primary muscle',()=>{
 const existing=[{
  id:'saved',name:'Machine chest press',muscle:'Triceps',category:'Chest',
  secondaryMuscles:['Shoulders'],progressTarget:{sets:3,reps:8,increment:5}
 }];
 const plan=planCatalogInstall(existing,()=>Math.random().toString(36),'2026-11-13');
 assert.equal(plan.toUpdate.length,1);
 const updated=plan.toUpdate[0];
 assert.equal(updated.id,'saved');
 assert.equal(updated.muscle,'Triceps');
 assert.deepEqual(updated.progressTarget,existing[0].progressTarget);
 assert.equal(Object.hasOwn(updated,'secondaryMuscles'),false);
 assert.deepEqual(existing[0].secondaryMuscles,['Shoulders']);
});
