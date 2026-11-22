import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedRir,validRir,validLegacyRpe,legacyEffort,rirInput,targetRirFloor} from '../effort-utils.js';
import {performedSet,nextSessionAdvice,comparableEffort,estimatedMax} from '../progression.js';

test('new RIR values use the 0 to 10 scale without confusing an empty value with zero',()=>{
 assert.equal(validRir(''),null);
 assert.equal(validRir(0),0);
 assert.equal(validRir('0'),0);
 assert.equal(validRir('2.5'),2.5);
 assert.equal(validRir(-1),null);
 assert.equal(validRir(10.5),null);
 assert.equal(validRir(2.3),null);
 assert.equal(rirInput({rir:0}),'0');
});
test('legacy RPE is retained unchanged and interpreted as approximate RIR',()=>{
 const old={id:'a',weight:'185',reps:'5',rpe:'8'};
 assert.equal(recordedRir(old),2);
 assert.equal(legacyEffort(old),true);
 assert.equal(rirInput(old),'2');
 assert.equal(old.rpe,'8');
 assert.equal(performedSet(old).rir,2);
 assert.equal(recordedRir({rpe:'10'}),0);
 assert.equal(recordedRir({rpe:'9.5'}),0.5);
});
test('explicit RIR values override retained legacy RPE',()=>{
 const record={rpe:'8',rir:'3'};
 assert.equal(recordedRir(record),3);
 assert.equal(legacyEffort(record),false);
 assert.equal(record.rpe,'8');
 assert.equal(recordedRir({rpe:'8',rir:''}),null);
 assert.equal(legacyEffort({rpe:'8',rir:''}),false);
});
test('legacy RPE ceiling translates to minimum RIR without losing old target',()=>{
 const old={rpeCeiling:9};
 assert.equal(targetRirFloor(old),1);
 assert.equal(old.rpeCeiling,9);
 assert.equal(targetRirFloor({rpeCeiling:9,rirFloor:2}),2);
 assert.equal(targetRirFloor({rpeCeiling:9,rirFloor:''}),null);
});
test('RIR zero holds a load while minimum RIR permits conservative increases',()=>{
 const s=(rir)=>({weight:135,reps:5,rir});
 const record={sets:[s(1),s(2)]};
 const target={progressTarget:{sets:2,reps:5,increment:5,rirFloor:1}};
 assert.equal(nextSessionAdvice(record,target).kind,'increase');
 assert.equal(nextSessionAdvice({sets:[s(0),s(1)]},target).kind,'hold');
 assert.equal(nextSessionAdvice({sets:[s(''),s(2)]},target).kind,'uncertain');
 assert.equal(nextSessionAdvice({sets:[s(0),s(1)]},{progressTarget:{sets:2,reps:5,increment:5}}).kind,'hold');
});
test('RIR effort comparisons require equivalent weight and repetitions',()=>{
 const records=[
 {date:'2026-11-01',sets:[{weight:185,reps:5,rpe:8}]},
 {date:'2026-11-07',sets:[{weight:185,reps:5,rir:3}]}
 ];
 assert.equal(comparableEffort(records).delta,1);
 assert.equal(comparableEffort([records[0],{date:'2026-11-07',sets:[{weight:195,reps:5,rir:3}]}]),null);
 assert.equal(estimatedMax(records[0].sets[0]),estimatedMax(records[1].sets[0]));
});
