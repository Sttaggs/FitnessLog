// UI-only rest timer. No rest durations are saved in workout or exercise history.
// Local storage preserves the countdown's target timestamp across navigation/reloads.
const ACTIVE_KEY='fitnesslog-rest-active-v1';
const PREF_KEY='fitnesslog-rest-preferences-v1';
const DEFAULT_SECONDS=120;
const MIN_SECONDS=15;
const MAX_SECONDS=1800;

function read(key,fallback) {
  try { const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; }
  catch { return fallback; }
}
function write(key,value) {
  try { localStorage.setItem(key,JSON.stringify(value)); return true; }
  catch { return false; }
}
export function clampSeconds(value) {
  const n=Number(value);
  return Number.isFinite(n)?Math.max(MIN_SECONDS,Math.min(MAX_SECONDS,Math.round(n))):DEFAULT_SECONDS;
}
export function restPreference(exerciseId) {
  const preferences=read(PREF_KEY,{});
  return clampSeconds(preferences[String(exerciseId||'default')] ?? DEFAULT_SECONDS);
}
export function setRestPreference(exerciseId,seconds) {
  const preferences=read(PREF_KEY,{});
  preferences[String(exerciseId||'default')]=clampSeconds(seconds);
  write(PREF_KEY,preferences);
  return preferences[String(exerciseId||'default')];
}
export function readRestTimer(now=Date.now()) {
  const data=read(ACTIVE_KEY,null);
  if(!data||!['running','paused','finished'].includes(data.mode)||typeof data.exerciseId!=='string') {
    return {mode:'idle',exerciseId:'',exerciseName:'',remaining:0,duration:DEFAULT_SECONDS,notified:false};
  }
  const mode=data.mode==='running'&&Number(data.endAt)<=now?'finished':data.mode;
  const remaining=mode==='running'?Math.max(0,Math.ceil((Number(data.endAt)-now)/1000)):
    mode==='paused'?Math.max(0,Number(data.remaining)||0):0;
  return {...data,mode,remaining};
}
export function startRestTimer(exerciseId,exerciseName,seconds,now=Date.now()) {
  const duration=clampSeconds(seconds);
  const timer={mode:'running',exerciseId:String(exerciseId||'default'),
    exerciseName:String(exerciseName||'Exercise').slice(0,100),duration,
    endAt:now+duration*1000,remaining:duration,notified:false};
  write(ACTIVE_KEY,timer);
  return timer;
}
export function pauseRestTimer(now=Date.now()) {
  const timer=readRestTimer(now);
  if(timer.mode!=='running')return timer;
  const paused={...timer,mode:'paused',remaining:timer.remaining,endAt:null};
  write(ACTIVE_KEY,paused);return paused;
}
export function resumeRestTimer(now=Date.now()) {
  const timer=readRestTimer(now);
  if(timer.mode!=='paused')return timer;
  const running={...timer,mode:'running',endAt:now+timer.remaining*1000,notified:false};
  write(ACTIVE_KEY,running);return running;
}
export function resetRestTimer() {
  try {localStorage.removeItem(ACTIVE_KEY);}catch {}
  return readRestTimer();
}
export function adjustRestTimer(deltaSeconds,now=Date.now()) {
  const timer=readRestTimer(now);
  if(timer.mode==='running'){
    const remaining=clampSeconds(timer.remaining+deltaSeconds);
    const changed={...timer,endAt:now+remaining*1000,remaining,notified:false};
    write(ACTIVE_KEY,changed);return changed;
  }
  if(timer.mode==='paused'){
    const changed={...timer,remaining:clampSeconds(timer.remaining+deltaSeconds)};
    write(ACTIVE_KEY,changed);return changed;
  }
  return timer;
}
export function markRestAlerted() {
  const timer=readRestTimer();
  if(timer.mode!=='finished'||timer.notified)return false;
  write(ACTIVE_KEY,{...timer,mode:'finished',endAt:null,remaining:0,notified:true});
  return true;
}
export function restTimeLabel(seconds) {
  const value=Math.max(0,Math.ceil(seconds));
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
