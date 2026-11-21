import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parsedWorkoutTime,ensureWorkoutStart,finishWorkoutTiming,workoutElapsedMs,
 clockDuration,shortDuration,localTimeLabel,localDateTimeValue,
 isoFromLocalDateTime,changeWorkoutTime
} from '../workout-timer.js';

const date=x=>new Date(x);
const start='2026-11-21T13:00:00.000Z';
const finish='2026-11-21T14:23:45.000Z';

test('a new workout automatically gets a permanent start timestamp',()=>{
 const workout={status:'active',name:'Push day'};
 assert.equal(ensureWorkoutStart(workout,date(start)),true);
 assert.equal(workout.startTime,start);
 assert.equal(ensureWorkoutStart(workout,date('2026-11-21T13:45:00.000Z')),false);
 assert.equal(workout.startTime,start);
 assert.equal(workout.endTime,undefined);
});
test('live elapsed duration is based on absolute time and survives reopening',()=>{
 const workout={status:'active',startTime:start};
 assert.equal(workoutElapsedMs(workout,Date.parse('2026-11-21T13:45:30.000Z')),2730000);
 const restored=JSON.parse(JSON.stringify(workout));
 assert.equal(workoutElapsedMs(restored,Date.parse(finish)),5025000);
 assert.equal(clockDuration(workoutElapsedMs(restored,Date.parse(finish))),'01:23:45');
});
test('completing a workout records the end time and freezes its duration',()=>{
 const workout={status:'active',startTime:start};
 assert.equal(finishWorkoutTiming(workout,date(finish)),true);
 assert.equal(workout.endTime,finish);
 workout.status='finished';
 assert.equal(workoutElapsedMs(workout,Date.parse('2026-11-24T13:00:00Z')),5025000);
 assert.equal(shortDuration(workoutElapsedMs(workout)),'1h 23m');
 assert.equal(finishWorkoutTiming(workout,date('2026-11-25T13:00:00Z')),true);
 assert.equal(workout.endTime,finish);
});
test('starting from templates does not copy timing from the template',()=>{
 const template={id:'t',name:'Push day',exercises:[{exerciseId:'bench',sets:3}]};
 assert.equal(template.startTime,undefined);
 const workout={status:'active',name:template.name};
 assert.equal(ensureWorkoutStart(workout,date(start)),true);
 assert.equal(workout.startTime,start);
 assert.equal(workout.endTime,undefined);
});
test('legacy finished workouts stay unmeasured, and older active workouts start on resume only',()=>{
 const old={status:'finished',createdAt:'2024-01-01T12:00:00Z'};
 assert.equal(ensureWorkoutStart(old,date(start)),false);
 assert.equal(workoutElapsedMs(old),null);
 assert.equal(clockDuration(workoutElapsedMs(old)),'—');
 assert.equal(shortDuration(workoutElapsedMs(old)),'');
 const active={status:'active',createdAt:'2024-01-01T12:00:00Z'};
 assert.equal(ensureWorkoutStart(active,date(start)),true);
 assert.equal(active.startTime,start);
});
test('user may correct start and end without changing performed sets',()=>{
 const workout={status:'finished',startTime:start,endTime:finish,exercises:[{sets:[{weight:'185',reps:'8'}]}]};
 const newStart='2026-11-21T12:30:00.000Z';
 assert.equal(changeWorkoutTime(workout,'startTime',newStart),true);
 assert.equal(workout.startTime,newStart);
 const newFinish='2026-11-21T14:30:00.000Z';
 assert.equal(changeWorkoutTime(workout,'endTime',newFinish),true);
 assert.equal(workoutElapsedMs(workout),7200000);
 assert.equal(workout.exercises[0].sets[0].weight,'185');
 assert.equal(changeWorkoutTime(workout,'endTime','2026-11-21T11:30:00Z'),false);
 assert.equal(workout.endTime,newFinish);
});
test('invalid or impossible times are rejected rather than generating negative durations',()=>{
 assert.equal(parsedWorkoutTime('2026-11-21'),null);
 assert.equal(parsedWorkoutTime('some date'),null);
 assert.equal(workoutElapsedMs({status:'finished',startTime:finish,endTime:start}),null);
 const workout={status:'active',startTime:start};
 assert.equal(changeWorkoutTime(workout,'startTime','2026-11-21T15:00:00Z',Date.parse(finish)),false);
 assert.equal(finishWorkoutTiming({status:'active',startTime:finish},date(start)),false);
 assert.equal(changeWorkoutTime(workout,'endTime',finish),false);
 assert.equal(isoFromLocalDateTime('invalid'),null);
});
test('date-time editing uses valid local calendar fields',()=>{
 const value=localDateTimeValue(start);
 assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
 assert.equal(isoFromLocalDateTime(value),start);
 assert.equal(isoFromLocalDateTime('2026-02-30T10:00'),null);
 assert.equal(typeof localTimeLabel(start),'string');
});
test('duration formatting supports empty, under-minute and multi-hour sessions',()=>{
 assert.equal(clockDuration(null),'—');
 assert.equal(clockDuration(302000),'00:05:02');
 assert.equal(clockDuration(1000*60*60*27+5000),'27:00:05');
 assert.equal(shortDuration(302000),'5 min');
 assert.equal(shortDuration(0),'0 min');
 assert.equal(shortDuration(null),'');
});
test('start and end times survive a complete JSON serialization',()=>{
 const workout={status:'finished',startTime:start,endTime:finish};
 const backup=JSON.parse(JSON.stringify({sessions:[workout]}));
 assert.equal(backup.sessions[0].startTime,start);
 assert.equal(backup.sessions[0].endTime,finish);
 assert.equal(workoutElapsedMs(backup.sessions[0]),5025000);
});
