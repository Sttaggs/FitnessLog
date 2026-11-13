import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CATALOG_GROUPS,CATALOG_CATEGORIES,CATALOG_EXERCISES,
 normalizeCatalogName,planCatalogInstall
} from '../exercise-catalog.js';

test('catalog has every supplied entry with only the exact duplicated exercise merged',()=>{
 const supplied=CATALOG_GROUPS.reduce((sum,g)=>sum+g.names.length,0);
 assert.equal(supplied,106);
 assert.equal(CATALOG_EXERCISES.length,105);
 assert.equal(new Set(CATALOG_EXERCISES.map(x=>normalizeCatalogName(x.name))).size,105);
 assert.equal(CATALOG_GROUPS.length,9);
 assert.deepEqual(CATALOG_CATEGORIES,[
  'Chest','Shoulders','Back','Biceps','Triceps','Quadriceps',
  'Hamstrings and Glutes','Core and Mobility','Cardio and Conditioning'
 ]);
});
test('close-grip bench press is one exercise with a single muscle group',()=>{
 const matches=CATALOG_EXERCISES.filter(x=>x.name==='Close-grip bench press');
 assert.equal(matches.length,1);
 assert.equal(matches[0].muscle,'Chest');
 assert.equal(Object.hasOwn(matches[0],'secondaryMuscles'),false);
});
test('cardio and mobility remain categories rather than counting as muscle sets',()=>{
 for(const name of ['Jogging','Sprinting','Disc golf','Kayaking','Walking','Rucking','Hiking']){
  const exercise=CATALOG_EXERCISES.find(x=>x.name===name);
  assert.equal(exercise?.category,'Cardio and Conditioning');
  assert.equal(exercise?.muscle,'');
 }
 for(const name of ['Low squat hip opener','Gentle spinal rotation']){
  assert.equal(CATALOG_EXERCISES.find(x=>x.name===name)?.muscle,'');
 }
});
test('new installation makes all 105 unique records with stable fields',()=>{
 let nextId=0;
 const plan=planCatalogInstall([],()=>String(++nextId),'2026-11-13T00:00:00Z');
 assert.equal(plan.toInsert.length,105);
 assert.equal(plan.toUpdate.length,0);
 assert.equal(new Set(plan.toInsert.map(x=>x.id)).size,105);
 assert.ok(plan.toInsert.every(x=>x.origin==='starter-catalog'));
 assert.ok(plan.toInsert.every(x=>x.createdAt==='2026-11-13T00:00:00Z'));
 assert.ok(plan.toInsert.every(x=>!Object.hasOwn(x,'secondaryMuscles')));
});
test('existing workouts remain linked because the old permanent library ID is retained',()=>{
 const prior={
  id:'existing-123',name:'MACHINE CHEST PRESS',muscle:'Triceps',category:'',equipment:'Selectorized',
  progressTarget:{sets:3,reps:8,increment:5},secondaryMuscles:['Shoulders']
 };
 const plan=planCatalogInstall([prior],()=>crypto.randomUUID(),'2026-11-13');
 assert.equal(plan.toInsert.length,104);
 assert.equal(plan.toUpdate.length,1);
 const same=plan.toUpdate[0];
 assert.equal(same.id,'existing-123');
 assert.equal(same.name,'MACHINE CHEST PRESS');
 assert.equal(same.muscle,'Triceps');
 assert.equal(same.category,'Chest');
 assert.equal(same.equipment,'Selectorized');
 assert.equal(Object.hasOwn(same,'secondaryMuscles'),false);
 assert.deepEqual(same.progressTarget,prior.progressTarget);
 assert.equal(prior.category,''); // no in-place mutation of existing data
 assert.deepEqual(prior.secondaryMuscles,['Shoulders']);
});
test('missing muscle groups are filled without overwriting other user preferences',()=>{
 const prior={id:'x',name:'Cable lateral raise',muscle:'',notes:'user notes',progressTarget:{sets:4}};
 const plan=planCatalogInstall([prior],()=>crypto.randomUUID(),'2026-11-13');
 assert.equal(plan.toInsert.length,104);
 assert.equal(plan.toUpdate[0].id,'x');
 assert.equal(plan.toUpdate[0].muscle,'Shoulders');
 assert.equal(plan.toUpdate[0].category,'Shoulders');
 assert.equal(plan.toUpdate[0].notes,'user notes');
 assert.deepEqual(plan.toUpdate[0].progressTarget,{sets:4});
});
test('running the catalog installer on the installed catalog is idempotent',()=>{
 let id=0;
 const first=planCatalogInstall([],()=>String(++id),'2026-11-13');
 const second=planCatalogInstall(first.toInsert,()=>String(++id),'2026-11-13');
 assert.equal(second.toInsert.length,0);
 assert.equal(second.toUpdate.length,0);
 assert.equal(id,105);
});
test('different legitimate exercise names are not fuzzy-merged',()=>{
 const plan=planCatalogInstall([{id:'custom',name:'Machine bench',muscle:'Chest'}],
   ()=>crypto.randomUUID(),'2026-11-13');
 assert.ok(plan.toInsert.some(x=>x.name==='Machine chest press'));
 assert.equal(plan.toInsert.length,105);
});
