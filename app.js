import {list, get, put, remove, replaceStores, newId} from './db.js';
import {exerciseHistory, exerciseWeights, performanceValue, trendPoints, trendSvg, numericValue} from './analytics.js';
import {shrinkPhoto, photosForBackup, restorePhotos} from './photo-utils.js';
import {renderProgressView} from './progress-ui.js';
import {restPreference,setRestPreference,readRestTimer,startRestTimer,pauseRestTimer,resumeRestTimer,resetRestTimer,adjustRestTimer,markRestAlerted,restTimeLabel,iphoneShortcutUrl} from './rest-timer.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');
const title = $('#page-title');
const escapeHtml = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const today = () => new Date().toLocaleDateString('en-CA');
const displayDate = (s) => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return isNaN(+d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
const cardioKinds = ['Walking','Running','Treadmill','Stair stepper','Cycling','Stationary bike','Rowing','Elliptical','Rucking','Hiking','Swimming','HIIT','Other'];
const currentMonth = () => {const now=new Date();return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');};
const state = {tab:'home', session:null, sessions:[], exercises:[], report:false, start:'', end:'', expanded:new Set(), libraryDetail:null, historyView:'list', historyMonth:currentMonth(), historyDate:'', previousOpenId:null, progressExercise:'', progressMetric:'weight', progressRange:'90', progressWeight:'all', photos:[], photosLoaded:false, photoView:'Front', photoA:'', photoB:'', photoMode:'side', overlayPercent:50};

function toast(message) { const el=$('#toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',2500); }
function button(label, action, extra='') {return `<button class="btn ${extra}" data-action="${action}">${label}</button>`;}
function textField(label, scope, field, value='', type='text', attrs='') {
  return `<div class="field"><label>${e(label)}</label><input type="${type}" data-scope="${scope}" data-field="${field}" value="${e(value)}" ${attrs}></div>`;
}
function numberField(label, scope, field, value='', extra='') {return textField(label,scope,field,value,'number','step="any" min="0" '+extra);}
function selectField(label,scope,field,value,options) {return `<div class="field"><label>${e(label)}</label><select data-scope="${scope}" data-field="${field}">${options.map(x=>`<option value="${e(x)}" ${x===value?'selected':''}>${e(x)}</option>`).join('')}</select></div>`;}
function memoField(label,scope,field,value='') {return `<div class="field"><label>${e(label)}</label><textarea data-scope="${scope}" data-field="${field}" placeholder="Optional notes">${e(value)}</textarea></div>`;}
function formatSummary(s) {
 const n=s.exercises?.length||0,c=s.activities?.filter(a=>a.type==='cardio').length||0,z=s.activities?.filter(a=>a.type==='sauna').length||0;
 return [n&&`${n} exercises`,c&&`${c} cardio`,z&&`${z} sauna`].filter(Boolean).join(' · ')||'No entries yet';
}

const normalizeName = name => String(name||'').normalize('NFKC').toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');

// Used only for suggestions: similar names are never silently merged.
function editDistance(a,b,limit=3){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const current=[i];let rowMin=i;
  for(let j=1;j<=b.length;j++){
   current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   rowMin=Math.min(rowMin,current[j]);
  }
  if(rowMin>limit)return limit+1;
  previous=current;
 }
 return previous[b.length];
}
function exerciseMatches(value){
 const query=normalizeName(value);
 if(!query)return [];
 const terms=query.split(' ');
 const results=[];
 for(const exercise of state.exercises){
  const name=normalizeName(exercise.name),words=name.split(' ');
  let score=Infinity,similar=false;
  if(name===query)score=0;
  else if(name.startsWith(query))score=1;
  else if(words.some(word=>word.startsWith(query)))score=2;
  else if(name.includes(query))score=3;
  else if(terms.length>1&&terms.every(t=>words.some(w=>w.startsWith(t))))score=4;
  else if(query.length>=4){
   const limit=query.length>=20?3:query.length>=8?2:1;
   if(editDistance(query,name,limit)<=limit){score=5;similar=true;}
   else if(terms.length>1&&terms.every(t=>words.some(w=>w===t||w.startsWith(t)||(t.length>=4&&editDistance(t,w,t.length>=7?2:1)<=(t.length>=7?2:1))))){score=6;similar=true;}
  }
  if(score!==Infinity)results.push({exercise,score,similar});
 }
 return results.sort((a,b)=>a.score-b.score||a.exercise.name.localeCompare(b.exercise.name));
}
function renderExerciseSuggestions(input,highlight=-1){
 const list=document.getElementById('exercise-search-options');
 if(!list)return;
 const query=input.value.trim(),matches=exerciseMatches(query).slice(0,8);
 if(!query){closeExerciseSuggestions();return;}
 list.hidden=false;
 const viewport=window.visualViewport;
 const bottom=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight);
 const rect=input.getBoundingClientRect();
 const availableBelow=bottom-rect.bottom;
 const availableAbove=rect.top-(viewport?.offsetTop??0);
 const placeAbove=availableBelow<180&&availableAbove>availableBelow;
 list.classList.toggle('above',placeAbove);
 list.style.maxHeight=Math.min(300,Math.max(110,(placeAbove?availableAbove:availableBelow)-16))+'px';
 list.innerHTML=matches.length?matches.map((match,i)=>
  '<button type="button" role="option" id="exercise-option-'+i+'" class="exercise-search-option'+(i===highlight?' highlighted':'')+'" aria-selected="'+(i===highlight)+'" data-action="select-exercise" data-id="'+e(match.exercise.id)+'"><span>'+e(match.exercise.name)+'</span><small>'+(match.similar?'Similar spelling — check name':'Saved exercise')+'</small></button>'
 ).join(''):'<div class="exercise-search-empty">No saved match. Adding this name will create an exercise.</div>';
 list.dataset.highlight=String(highlight);
 input.setAttribute('aria-expanded',String(matches.length>0));
 if(highlight>=0&&highlight<matches.length)input.setAttribute('aria-activedescendant','exercise-option-'+highlight);
 else input.removeAttribute('aria-activedescendant');
}
function closeExerciseSuggestions(){
 const input=document.getElementById('exercise-entry-name');
 const list=document.getElementById('exercise-search-options');
 if(list){list.hidden=true;list.innerHTML='';}
 if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
}
async function resolveExerciseInput(name){
 const matches=exerciseMatches(name);
 const exact=matches.find(match=>normalizeName(match.exercise.name)===normalizeName(name));
 if(exact)return exact.exercise;
 const similar=matches.some(match=>match.similar);
 const shortMatches=normalizeName(name).length<=3&&matches.length>0;
 if(similar||shortMatches){
  const choices=matches.slice(0,3).map(match=>match.exercise.name).join(', ');
  if(!confirm('Similar saved exercises: '+choices+'.\n\nCreate "'+name+'" as a separate exercise anyway?\n\nChoose Cancel to select an existing exercise instead.'))return null;
 }
 return ensureExercise(name);
}
async function addExerciseToWorkout(master){
 if(!master||!state.session)return;
 const entry={id:newId(),exerciseId:master.id,name:master.name,technique:'Standard',notes:'',sets:[blankSet()]};
 state.session.exercises.push(entry);
 // Keep only the newest exercise expanded to reduce scrolling during a workout.
 state.expanded.clear();
 state.previousOpenId=null;
 state.expanded.add(entry.id);
 await saveSession();
 await render();
 document.querySelector('#exercise-'+entry.id+' input[data-field="weight"]')?.focus({preventScroll:false});
}
const blankSet = () => ({id:newId(),weight:'',reps:'',rpe:''});
const hasSetData = set => Boolean(set && ['weight','reps','rpe'].some(key => set[key]!=='' && set[key]!==null && set[key]!==undefined));
const recordedSets = x => (x.sets||[]).filter(hasSetData);
async function ensureExercise(name) {
 const clean=String(name||'').trim().replace(/\s+/g,' ');
 if (!clean) return null;
 let found=state.exercises.find(x=>normalizeName(x.name)===normalizeName(clean));
 if(!found) {
  found={id:newId(),name:clean,muscle:'',equipment:'',createdAt:new Date().toISOString()};
  await put('exercises',found);
  state.exercises.push(found);
 }
 return found;
}
function previousPerformance(exerciseId,currentSessionId,currentDate) {
 for(const s of state.sessions) {
  if(s.id===currentSessionId || s.status!=='finished' || (currentDate && s.date>currentDate))continue;
  const x=(s.exercises||[]).find(ex=>ex.exerciseId===exerciseId);
  if(x) {
   // Preserve set indices even when earlier sets have no recorded details.
   return {date:s.date, sets:x.sets||[], notes:x.notes||''};
  }
 }
 return null;
}
// One-time, non-destructive linkage of exercise entries from earlier app versions.
async function linkExistingExercises() {
 await refreshData();
 let changed=0;
 for(const session of state.sessions) {
  let sessionChanged=false;
  for(const entry of session.exercises||[]) {
   if(entry.exerciseId)continue;
   const master=await ensureExercise(entry.name);
   if(!master)continue;
   entry.exerciseId=master.id;
   sessionChanged=true;
   changed++;
  }
  if(sessionChanged)await put('sessions',session);
 }
 if(changed)await refreshData();
}

async function refreshData() {state.sessions=(await list('sessions')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));state.exercises=await list('exercises');}
let saveQueue=Promise.resolve();
let saveTimer=null;
async function saveSession() {
 if(!state.session)return;
 const updatedAt=new Date().toISOString();
 state.session.updatedAt=updatedAt;
 const snapshot=JSON.parse(JSON.stringify(state.session));
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{await put('sessions',snapshot);await refreshData();});
 return saveQueue;
}
function scheduleSave() {
 if(!state.session)return;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{saveTimer=null;saveSession().catch(err=>{console.error(err);toast('Could not save changes');});},250);
}
async function flushSave() {
 if(!saveTimer)return;
 clearTimeout(saveTimer);
 saveTimer=null;
 await saveSession();
}
const photoUrls=new Map();
async function refreshPhotos() {
 state.photos=(await list('photos')).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''));
 state.photosLoaded=true;
 const ids=new Set(state.photos.map(photo=>photo.id));
 for(const [id,url] of photoUrls)if(!ids.has(id)){URL.revokeObjectURL(url);photoUrls.delete(id);}
}
function photoUrl(photo) {
 if(!photo?.blob)return '';
 if(!photoUrls.has(photo.id))photoUrls.set(photo.id,URL.createObjectURL(photo.blob));
 return photoUrls.get(photo.id);
}
async function render() {
 await refreshData();
 if(state.tab==='progress' && !state.session && !state.report && !state.photosLoaded)await refreshPhotos();
 document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
 title.textContent=state.session?'Workout':({home:'Home',history:'History',progress:'Progress',library:'Library',settings:'Settings'})[state.tab]||'FitnessLog';
 main.innerHTML=state.report?renderReport():state.session?renderWorkout():({home:renderHome,history:renderHistory,progress:renderProgress,library:renderLibrary,settings:renderSettings}[state.tab]||renderHome)();
}
function renderHome() {
 const recent=state.sessions.slice(0,4);
 const latest=state.sessions.find(s=>s.status==='finished');
 return `<section class="card hero"><div class="eyebrow">YOUR NEXT SESSION</div><h2 style="font-size:26px;margin:10px 0">Train your way.</h2><p class="muted">Log just an exercise name, or track every set. Nothing is required.</p>${button('＋ Start workout','start','wide')}${state.sessions.some(s=>s.status==='active')?'<p class="helper">An unfinished workout is available to resume below.</p>':''}</section>
 <div class="section-heading"><h2>Recent activity</h2><button class="btn ghost" data-action="history">View all</button></div>
 ${recent.length?recent.map(s=>`<div class="item"><div class="row between"><div class="grow"><div class="item-title">${e(s.name||'Workout')}</div><small>${displayDate(s.date)} · ${e(formatSummary(s))}</small></div><button class="btn small secondary" data-action="open" data-id="${s.id}">${s.status==='active'?'Resume':'Open'}</button></div></div>`).join(''):'<div class="card empty">No workouts yet. Start whenever you are ready.</div>'}
 <div class="grid2"><div class="stat"><span>Sessions logged</span><strong>${state.sessions.filter(s=>s.status==='finished').length}</strong></div><div class="stat"><span>Latest session</span><strong style="font-size:16px">${latest?displayDate(latest.date):'—'}</strong></div></div>`;
}
function renderWorkout() {
 const s=state.session;
 return `<div class="card"><div class="row between" style="margin-bottom:14px"><span class="badge">${s.status==='active'?'In progress':'Saved session'}</span><button class="btn ghost small" data-action="close-workout">← Back</button></div>
 <div class="field-row">${textField('Workout name','session','name',s.name||'Workout')}${textField('Date','session','date',s.date,'date')}</div>
 <details class="session-details"><summary>Workout intensity, fatigue and notes</summary><div class="field-row" style="margin-top:10px">${numberField('Overall intensity / 10','session','intensity',s.intensity,'min="1" max="10"')}${numberField('Overall fatigue / 10','session','fatigue',s.fatigue,'min="1" max="10"')}</div>
 <div style="margin-top:10px">${memoField('Session notes','session','notes',s.notes)}</div></details></div>
 <div class="section-heading"><h2>Resistance exercises</h2><span class="pill">${s.exercises.length}</span></div>
 ${s.exercises.map((x,i)=>renderExercise(x,i)).join('')}
 <div class="card"><form data-form="add-exercise" class="stack"><div class="field exercise-search-field"><label for="exercise-entry-name">Add an exercise</label><input id="exercise-entry-name" name="exerciseName" placeholder="Search or type a new exercise" required autocomplete="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="exercise-search-options" aria-expanded="false"><div id="exercise-search-options" class="exercise-search-options" role="listbox" aria-label="Existing matching exercises" hidden></div></div><button class="btn secondary wide" type="submit">＋ Add exercise</button><p class="helper" style="margin:0">Select a saved exercise to keep its history linked. New names are saved automatically.</p></form></div>
 <div class="section-heading"><h2>Cardio and sauna</h2></div>${s.activities.map((x,i)=>renderActivity(x,i)).join('')}
 <div class="card"><div class="grid2">${button('＋ Cardio','add-cardio','secondary')}${button('＋ Sauna','add-sauna','secondary')}</div></div>
 <div class="card"><div class="stack">
 ${button(s.status==='active'?'Finish workout':'Save changes','finish','wide')}
 ${button('Close without finishing','close-workout','secondary wide')}
 </div><p class="helper">Changes save automatically on your device. You can edit this session later.</p>
 <div class="delete-workout-area">
  ${button('Delete workout','delete-workout','danger wide')}
  <p class="helper">Deleting removes this workout from your history and progress statistics.</p>
 </div></div>`;
}
const historicalField = (set,key,fallback) => {
 const value=set?.[key];
 return value!==''&&value!==null&&value!==undefined?String(value):fallback;
};
function renderRestTimer(x) {
 const key=x.exerciseId||normalizeName(x.name)||x.id;
 const preference=restPreference(key);
 const timer=readRestTimer();
 const isActive=timer.mode!=='idle'&&timer.exerciseId===key;
 const time=isActive?timer.remaining:preference;
 const label=isActive?timer.mode==='running'?'Counting down':timer.mode==='paused'?'Paused':'Rest complete':'Ready';
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 const control=(text,action,attrs='')=>'<button type="button" class="btn secondary small" data-action="'+action+'" data-id="'+e(x.id)+'" '+attrs+'>'+text+'</button>';
 return '<section class="rest-timer" data-exercise-timer="'+e(key)+'" aria-label="Rest timer for '+e(x.name)+'">'+
  '<div class="rest-timer-top"><span class="rest-title">Rest timer</span><span class="rest-timer-status" data-rest-status>'+e(label)+'</span></div>'+
  '<div class="rest-timer-main"><output class="rest-timer-clock" data-rest-clock aria-label="Time remaining">'+restTimeLabel(time)+'</output>'+
  '<div class="rest-timer-buttons">'+
  '<button type="button" class="btn small" data-action="rest-start" data-id="'+e(x.id)+'" data-rest-start>Start in app</button>'+
  control('Pause','rest-pause','data-rest-pause '+(!isActive||timer.mode!=='running'?'hidden':''))+
  control('Resume','rest-resume','data-rest-resume '+(!isActive||timer.mode!=='paused'?'hidden':''))+
  control('Reset','rest-reset','data-rest-reset '+(!isActive?'hidden':''))+'</div></div>'+
  '<div class="rest-timer-presets" role="group" aria-label="Rest duration">'+
  [60,90,120,180].map(seconds=>'<button type="button" class="rest-preset'+(seconds===preference?' selected':'')+'" data-action="rest-preset" data-id="'+e(x.id)+'" data-duration="'+seconds+'" aria-pressed="'+(seconds===preference)+'">'+restTimeLabel(seconds)+'</button>').join('')+
  control('−15','rest-minus')+control('+15','rest-plus')+'</div>'+
  (ios?'<div class="rest-iphone"><button type="button" class="btn secondary small wide" data-action="rest-iphone" data-id="'+e(x.id)+'">Start iPhone lock-screen alarm</button>'+
  '<details class="rest-iphone-setup"><summary>One-time iPhone setup</summary>'+
  '<p>Create an Apple Shortcut named <strong>FitnessLog Rest Timer</strong> with a <strong>Get Numbers from Input</strong> action using Shortcut Input, then a <strong>Start Timer</strong> action set to that number of seconds. Save it, then use Start iPhone lock-screen alarm. The Clock timer runs independently; pause or cancel it in the Clock app.</p>'+
  '<a href="shortcuts://create-shortcut">Open Shortcuts to create it</a></details></div>':'')+
  '</section>';
}
function restKey(entry) {
 return entry.exerciseId||normalizeName(entry.name)||entry.id;
}
let restAudioContext=null;
function unlockRestSound(){
 try {
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  if(!restAudioContext)restAudioContext=new Context();
  if(restAudioContext.state==='suspended')restAudioContext.resume().catch(()=>{});
 } catch {}
}
function playRestSound(){
 try {
  if(restAudioContext?.state==='suspended')restAudioContext.resume().catch(()=>{});
  if(restAudioContext?.state==='running'){
   const now=restAudioContext.currentTime;
   [0,.28,.56].forEach(offset=>{
    const oscillator=restAudioContext.createOscillator();
    const volume=restAudioContext.createGain();
    oscillator.type='sine';
    oscillator.frequency.value=870;
    volume.gain.setValueAtTime(.0001,now+offset);
    volume.gain.exponentialRampToValueAtTime(.2,now+offset+.02);
    volume.gain.exponentialRampToValueAtTime(.0001,now+offset+.22);
    oscillator.connect(volume).connect(restAudioContext.destination);
    oscillator.start(now+offset);
    oscillator.stop(now+offset+.23);
   });
  }
  if(navigator.vibrate)navigator.vibrate([180,90,180]);
 } catch {}
}
function refreshRestTimers(){
 const timer=readRestTimer();
 if(timer.mode==='finished'&&!timer.notified){
  const recent=Number.isFinite(timer.endAt)&&Date.now()-timer.endAt<60000;
  markRestAlerted();
  if(recent&&!document.hidden){playRestSound();toast('Rest complete · '+timer.exerciseName);}
 }
 for(const panel of main.querySelectorAll('[data-exercise-timer]')){
  const key=panel.dataset.exerciseTimer,preference=restPreference(key);
  const active=timer.mode!=='idle'&&timer.exerciseId===key;
  const remaining=active?timer.remaining:preference;
  const time=panel.querySelector('[data-rest-clock]');
  const status=panel.querySelector('[data-rest-status]');
  if(time)time.textContent=restTimeLabel(remaining);
  if(status)status.textContent=active?timer.mode==='running'?'Counting down':timer.mode==='paused'?'Paused':'Rest complete':
    timer.mode==='running'?'Rest active on '+timer.exerciseName:'Ready';
  const start=panel.querySelector('[data-rest-start]');
  if(start)start.textContent=active&&timer.mode==='running'?'Restart':'Start in app';
  const pause=panel.querySelector('[data-rest-pause]');
  const resume=panel.querySelector('[data-rest-resume]');
  const reset=panel.querySelector('[data-rest-reset]');
  if(pause)pause.hidden=!active||timer.mode!=='running';
  if(resume)resume.hidden=!active||timer.mode!=='paused';
  if(reset)reset.hidden=!active;
  panel.querySelectorAll('.rest-preset').forEach(button=>{
   const selected=Number(button.dataset.duration)===preference;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
 }
}
function renderExercise(x,i) {
 const isOpen=state.expanded.has(x.id);
 const prev=x.exerciseId?previousPerformance(x.exerciseId,state.session?.id,state.session?.date):null;
 const scope='exercise:'+x.id;
 const type=x.technique||'Standard';
 return `<details class="detail" id="exercise-${x.id}" data-exercise-card="${x.id}" ${isOpen?'open':''}>
 <summary><div class="row between"><div><div class="item-title">${e(x.name||'Exercise')}</div><small class="muted">${e(type)} · ${x.sets?.length||0} set rows</small></div><span class="muted">▾</span></div></summary>
 <div class="detail-body">
 <div class="field-row">
 ${textField('Exercise name',scope,'name',x.name)}
 <div class="field"><label>Technique</label><div class="technique-label">${e(type)}</div></div>
 </div>
 ${renderRestTimer(x)}
 ${prev?`<section class="previous-reference">
 <button type="button" class="previous-toggle" data-action="toggle-previous" data-id="${e(x.id)}" aria-expanded="${state.previousOpenId===x.id}" aria-controls="previous-panel-${e(x.id)}">
  <span class="previous-toggle-label"><span class="previous-icon" aria-hidden="true">↶</span>Previous performance <small>${e(displayDate(prev.date))}</small></span>
  <span class="previous-chevron" aria-hidden="true">⌄</span>
 </button>
 <div id="previous-panel-${e(x.id)}" class="previous-panel" ${state.previousOpenId===x.id?'':'hidden'}>
  ${prev.sets.length?`<div class="previous-sets"><div class="previous-sets-heading"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span></div>
  ${prev.sets.map((set,j)=>`<div class="previous-sets-row"><span>${j+1}</span><span>${e(historicalField(set,'weight','—'))}</span><span>${e(historicalField(set,'reps','—'))}</span><span>${e(historicalField(set,'rpe','—'))}</span></div>`).join('')}</div>`:'<p class="helper">No sets recorded in the previous session.</p>'}
  ${prev.notes?`<p class="helper previous-notes">Notes: ${e(prev.notes)}</p>`:''}
 </div></section>`:''}
 <div class="set-grid set-heading"><span>SET</span><span>WEIGHT (LB)</span><span>REPS</span><span>RPE</span><span></span></div>
 ${(x.sets||[]).map((set,j)=>`<div class="set-grid">
 <span class="set-number">${j+1}</span>
 <input aria-label="Set ${j+1} weight in pounds" inputmode="decimal" type="number" min="0" step="any" data-scope="set:${x.id}:${set.id}" data-field="weight" value="${e(set.weight)}" placeholder="${e(historicalField(prev?.sets?.[j],'weight','lb'))}">
 <input aria-label="Set ${j+1} repetitions" inputmode="numeric" type="number" min="0" step="1" data-scope="set:${x.id}:${set.id}" data-field="reps" value="${e(set.reps)}" placeholder="${e(historicalField(prev?.sets?.[j],'reps','—'))}">
 <input aria-label="Set ${j+1} RPE, 1 to 10" inputmode="decimal" type="number" min="1" max="10" step="0.5" data-scope="set:${x.id}:${set.id}" data-field="rpe" value="${e(set.rpe)}" placeholder="${e(historicalField(prev?.sets?.[j],'rpe','1–10'))}">
 <button class="btn danger set-delete" data-action="delete-set" data-exercise="${x.id}" data-id="${set.id}" aria-label="Remove set ${j+1}">×</button></div>`).join('')}
 ${prev?'<p class="helper historical-hint">Faded values show last time; only typed values are saved.</p>':''}
 <div class="row between wrap" style="margin-top:12px">
 <button class="btn secondary small" data-action="add-set" data-id="${x.id}">＋ Add set</button>
 <button class="btn danger small" data-action="delete-exercise" data-id="${x.id}">Remove exercise</button>
 </div>
 <details class="exercise-notes"><summary class="helper">Optional exercise notes</summary>${memoField('Notes',scope,'notes',x.notes||'')}</details>
 <p class="helper">Set fields are optional. RPE 10 = maximum effort; 1 = very little effort.</p>
 </div></details>`;
}
function renderActivity(a) {
 const scope=`activity:${a.id}`;
 return `<details class="detail"><summary><div class="row between"><div><div class="item-title">${a.type==='cardio'?'Cardio':'Sauna'} · ${e(a.mode||'Activity')}</div><small class="muted">${a.duration?e(a.duration)+' min':''}</small></div><span class="muted">Edit ▾</span></div></summary><div class="detail-body">
 <div class="field-row">${a.type==='cardio'?selectField('Activity',scope,'mode',a.mode,cardioKinds):selectField('Sauna type',scope,'mode',a.mode,['Traditional','Infrared','Steam','Other'])}${numberField('Duration (min)',scope,'duration',a.duration)}</div>
 <div class="field-row" style="margin-top:10px">${a.type==='cardio'?numberField('Distance (km)',scope,'distance',a.distance):numberField('Temperature (°F)',scope,'temperature',a.temperature)}${numberField('Intensity / 10',scope,'intensity',a.intensity,'max="10"')}</div>
 ${a.type==='cardio'?'<div style="margin-top:10px">'+textField('Machine level / other metric',scope,'level',a.level)+'</div>':''}
 <div style="margin-top:10px">${memoField('Notes',scope,'notes',a.notes)}</div>
 <div style="margin-top:10px">${button('Remove activity','delete-activity','danger small').replace('data-action="delete-activity"',`data-action="delete-activity" data-id="${a.id}"`)}</div>
 </div></details>`;
}

function historyMetrics(session) {
 const exercises=session.exercises||[];
 const savedSets=exercises.flatMap(x=>recordedSets(x));
 const repSets=savedSets.filter(set=>set.reps!==''&&set.reps!==null&&set.reps!==undefined&&Number.isFinite(Number(set.reps)));
 const reps=repSets.length?repSets.reduce((total,set)=>total+Number(set.reps),0):null;
 const partialReps=reps!==null&&exercises.some(x=>!recordedSets(x).length||(x.sets||[]).some(set=>!hasSetData(set)||set.reps===''||set.reps===null||set.reps===undefined));
 const cardio=(session.activities||[]).filter(a=>a.type==='cardio');
 const cardioMinutes=cardio.map(a=>Number(a.duration)).filter(n=>Number.isFinite(n)&&n>0).reduce((a,b)=>a+b,0);
 return {exercises:exercises.length,sets:savedSets.length,reps,partialReps,cardio:cardio.length,cardioMinutes};
}
function historyEntry(session) {
 const m=historyMetrics(session);
 const metric=(label,value,qualifier='')=>'<div class="history-metric"><span>'+e(label)+'</span><strong>'+e(value)+'</strong>'+ (qualifier?'<small>'+e(qualifier)+'</small>':'')+'</div>';
 const intensity=(session.intensity!==''&&session.intensity!=null)?session.intensity+'/10':'—';
 const fatigue=(session.fatigue!==''&&session.fatigue!=null)?session.fatigue+'/10':'—';
 return `<button type="button" class="history-entry" data-action="open" data-id="${session.id}" aria-label="Review ${e(session.name||'Workout')} on ${e(displayDate(session.date))}">
 <div class="row between history-entry-head">
  <div class="grow"><div class="item-title">${e(session.name||'Workout')}</div>
  <div class="caption">${e(displayDate(session.date))} · ${m.exercises} exercises${m.cardio?' · '+m.cardio+' cardio':''}${m.cardioMinutes?' · '+m.cardioMinutes+' cardio min':''}</div></div>
  <span class="history-status ${session.status==='finished'?'completed':'unfinished'}">${session.status==='finished'?'Completed':'In progress'}</span>
 </div>
 <div class="history-metrics">
  ${metric('Intensity',intensity)}
  ${metric('Fatigue',fatigue)}
  ${metric('Logged reps',m.reps===null?'—':m.reps,m.partialReps?'Partial':'')}
  ${metric('Logged sets',m.sets)}
 </div>
 <div class="history-entry-foot"><span>${e(formatSummary(session))}</span><span>Review / Edit ›</span></div>
 </button>`;
}
function calendarMarkup() {
 const [year,month]=state.historyMonth.split('-').map(Number);
 const first=new Date(year,month-1,1);
 const daysInMonth=new Date(year,month,0).getDate();
 const offset=first.getDay();
 const cells=Math.ceil((offset+daysInMonth)/7)*7;
 const byDate=new Map();
 for(const session of state.sessions){
  if(!session.date)continue;
  if(!byDate.has(session.date))byDate.set(session.date,[]);
  byDate.get(session.date).push(session);
 }
 const dayCells=Array.from({length:cells},(_,index)=>{
  const day=index-offset+1;
  if(day<1||day>daysInMonth)return '<div class="calendar-empty" aria-hidden="true"></div>';
  const date=state.historyMonth+'-'+String(day).padStart(2,'0');
  const workouts=byDate.get(date)||[];
  const completed=workouts.some(s=>s.status==='finished');
  const unfinished=workouts.length>0&&!completed;
  const names=workouts.slice(0,2).map(s=>'<span class="calendar-workout-name">'+e(s.name||'Workout')+'</span>').join('');
  const more=workouts.length>2?'<span class="calendar-extra">+'+(workouts.length-2)+' more</span>':'';
  const selected=state.historyDate===date;
  return `<button type="button" class="calendar-day ${completed?'has-completed':''} ${unfinished?'has-unfinished':''} ${selected?'selected':''}" data-action="history-day" data-date="${date}" aria-pressed="${selected}" aria-label="${e(displayDate(date))}: ${workouts.length} workouts${completed?', completed workout recorded':''}">
   <span class="calendar-day-number">${day}</span>${names}${more}
  </button>`;
 }).join('');
 const monthName=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const chosen=state.historyDate?byDate.get(state.historyDate)||[]:[];
 return `<div class="history-calendar">
 <div class="calendar-header">
  <button type="button" class="icon-button" data-action="history-prev-month" aria-label="Previous month">‹</button>
  <h2>${e(monthName)}</h2>
  <button type="button" class="icon-button" data-action="history-next-month" aria-label="Next month">›</button>
 </div>
 <div class="calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(n=>'<span>'+n+'</span>').join('')}</div>
 <div class="calendar-grid">${dayCells}</div>
 <p class="helper calendar-legend"><span class="calendar-legend-swatch"></span> Green indicates at least one completed workout.</p>
 </div>
 <div class="section-heading"><h2>${state.historyDate?'Workouts · '+e(displayDate(state.historyDate)):'Select a day'}</h2>${state.historyDate?'<span class="pill">'+chosen.length+'</span>':''}</div>
 ${state.historyDate?(chosen.length?chosen.map(historyEntry).join(''):'<div class="card empty">No workouts recorded on this date.</div>'):'<div class="card empty">Tap a day to review its workout entries.</div>'}`;
}
function renderHistory() {
 const isList=state.historyView==='list';
 return `<div class="history-intro">
  <p class="muted">Review your training records. Select any workout to see its sets and make changes.</p>
 </div>
 <div class="history-view-toggle" role="group" aria-label="Workout history view">
  <button type="button" data-action="history-view" data-view="list" aria-pressed="${isList}" class="${isList?'active':''}">List</button>
  <button type="button" data-action="history-view" data-view="calendar" aria-pressed="${!isList}" class="${!isList?'active':''}">Calendar</button>
 </div>
 ${isList?`
  <div class="section-heading"><h2>Workout log</h2><span class="pill">${state.sessions.length} entries</span></div>
  ${state.sessions.length?state.sessions.map(historyEntry).join(''):'<div class="card empty">No workouts recorded yet.</div>'}
 `:calendarMarkup()}
 <details class="card history-export">
  <summary><span>Export workout history</span><span class="helper">PDF · CSV · JSON</span></summary>
  <div class="export-content">
   <p class="helper">Choose an optional date range and download your records.</p>
   <div class="field-row">${textField('From','filter','start',state.start||'','date')}${textField('Through','filter','end',state.end||'','date')}</div>
   <div class="row wrap" style="margin-top:12px">
    ${button('PDF report','report','secondary small')}
    ${button('CSV','export-csv','secondary small')}
    ${button('JSON','export-json','secondary small')}
   </div>
   <p class="helper">For an unfiltered, complete JSON backup, use Settings. Missing training measurements remain blank.</p>
  </div>
 </details>`;
}
function renderProgress() {
 return renderProgressView({state,e,displayDate,photoUrl});
}
function renderLibrary() {
 if(state.libraryDetail) {
  const ex=state.exercises.find(x=>x.id===state.libraryDetail);
  if(!ex){state.libraryDetail=null;return '<div class="card">Exercise not found.</div>';}
  const records=state.sessions.flatMap(s=>(s.exercises||[]).filter(x=>x.exerciseId===ex.id).map(x=>({session:s,entry:x})));
  return `<button class="btn secondary small" data-action="library-back">← All exercises</button>
  <div class="card" style="margin-top:12px"><h2>${e(ex.name)}</h2>
  <p class="helper">${e(ex.muscle||'Muscle unspecified')} · ${e(ex.equipment||'Equipment unspecified')}</p>
  <p>${records.length} recorded workout entries</p></div>
  <div class="section-heading"><h2>Performance history</h2></div>
  ${records.length?records.map(({session,entry})=>`<div class="item">
   <div class="row between"><div class="grow"><strong>${displayDate(session.date)}</strong><p class="helper" style="margin:4px 0">${e(session.name)}</p>
   <p class="helper" style="margin:4px 0">${recordedSets(entry).map(set=>[set.weight?set.weight+' lb':'',set.reps?set.reps+' reps':'',set.rpe?'RPE '+set.rpe:''].filter(Boolean).join(' · ')).join(' | ')||'Exercise logged; no set details'}</p></div>
   <button class="btn small secondary" data-action="open" data-id="${session.id}">View</button></div></div>`).join(''):'<div class="card empty">No history for this exercise yet.</div>'}`;
 }
 return `<div class="card"><h2>Exercise library</h2><p class="helper">New exercises are added here automatically when you log them. All workouts using the same exercise are linked.</p>
 <form data-form="library" class="stack"><div class="field"><label>New exercise (optional)</label><input name="name" placeholder="Exercise name" required></div><div class="field-row">
 <div class="field"><label>Primary muscle</label><input name="muscle" placeholder="Shoulders"></div>
 <div class="field"><label>Equipment</label><input name="equipment" placeholder="Dumbbells"></div></div>
 <button class="btn secondary wide" type="submit">Add to library</button></form></div>
 <div class="section-heading"><h2>Saved exercises</h2><span class="pill">${state.exercises.length}</span></div>
 ${state.exercises.length?state.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<div class="item"><div class="row between">
 <div class="grow"><div class="item-title">${e(x.name)}</div><small>${e(x.muscle||'Unassigned')} · ${e(x.equipment||'No equipment')}</small></div>
 <button class="btn small secondary" data-action="view-library" data-id="${x.id}">History</button></div></div>`).join(''):'<div class="card empty">Your exercises will appear here automatically as you log them.</div>'}`;
}
function renderSettings() {
 return `<div class="card"><h2>Data and privacy</h2>
 <p>Workout data and progress photos are stored only in this browser on this device. They are never uploaded to GitHub or Cloudflare.</p>
 <p class="notice">Clearing browser data or uninstalling the app can permanently remove workouts and photos. Back up regularly.</p>
 <div class="stack" style="margin-top:15px">
 ${button('Download workout backup (no photos)','full-backup','wide')}
 ${button('Download backup including photos','export-photos-backup','secondary wide')}
 ${button('Restore JSON backup','restore','secondary wide')}
 <input id="restore-file" type="file" accept="application/json,.json" hidden>
 </div>
 <p class="helper">Photo-inclusive backup is optional and may be large. Photo files are included only when you explicitly choose the photo-inclusive option. Restoring a workout-only backup preserves existing photos on this device.</p></div>
 <div class="card"><h2>About</h2><p class="muted">Exercise analytics track recorded weight, repetitions, and RPE. Progress photos are private, dated, and comparable by view. Advanced training techniques and body measurements remain planned.</p></div>`;
}
function selected() {
 return state.sessions.filter(s=>(!state.start||s.date>=state.start)&&(!state.end||s.date<=state.end)).sort((a,b)=>a.date.localeCompare(b.date));
}
function renderReport() {
 const ss=selected();
 const setDescription = set=>[
  set.weight!==''&&set.weight!=null?set.weight+' lb':'',
  set.reps!==''&&set.reps!=null?set.reps+' reps':'',
  set.rpe!==''&&set.rpe!=null?'RPE '+set.rpe:''
 ].filter(Boolean).join(' · ');
 return `<div class="no-print row between" style="margin-bottom:12px">
 ${button('← History','report-close','secondary small')}${button('Print / Save PDF','print','small')}</div>
 <div class="report print-area">
 <h2>FitnessLog training report</h2><p>${e(state.start||'All dates')} through ${e(state.end||'present')}</p>
 <p class="muted">${ss.length} workouts · Export created ${displayDate(today())}. Blank fields were not recorded.</p>
 ${ss.map(s=>`<section style="margin:22px 0"><h3>${e(s.name)} — ${displayDate(s.date)}</h3>
 <p>Overall intensity: ${e(s.intensity||'Not recorded')} · Overall fatigue: ${e(s.fatigue||'Not recorded')}</p>
 <p>${e(s.notes||'')}</p>
 <table><thead><tr><th>Exercise</th><th>Technique</th><th>Recorded sets (Weight · Reps · RPE)</th></tr></thead><tbody>
 ${(s.exercises||[]).map(x=>`<tr><td>${e(x.name)}${x.notes?' — '+e(x.notes):''}</td>
 <td>${e(x.technique||'Standard')}</td>
 <td>${recordedSets(x).map(set=>e(setDescription(set))).join('; ')||'No set data recorded'}</td>
 </tr>`).join('')}
 </tbody></table>
 ${s.activities?.length?`<p>${s.activities.map(a=>`${e(a.type)}: ${e(a.mode)} ${a.duration?e(a.duration)+' min':''} ${a.distance?e(a.distance)+' km':''} ${a.notes?e(a.notes):''}`).join('; ')}</p>`:''}
 </section>`).join('')}</div>`;
}
function download(name, body, mime) {const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function csvValue(x) {return '"'+String(x??'').replace(/"/g,'""')+'"';}
function exportCsv() {
 const rows=[['date','workout','exercise_id','exercise','technique','set','weight_lb','reps','rpe','session_intensity','session_fatigue','notes']];
 for(const s of selected()) {
  for(const x of s.exercises||[]) {
   const sets=recordedSets(x);
   if(sets.length) sets.forEach((set,i)=>rows.push([s.date,s.name,x.exerciseId||'',x.name,x.technique||'Standard',i+1,set.weight,set.reps,set.rpe,s.intensity,s.fatigue,x.notes]));
   else rows.push([s.date,s.name,x.exerciseId||'',x.name,x.technique||'Standard','','','','',s.intensity,s.fatigue,x.notes]);
  }
  for(const a of s.activities||[]) rows.push([s.date,s.name,'',a.type+': '+a.mode,'activity','','',a.duration,a.intensity,s.intensity,s.fatigue,a.notes]);
 }
 download('fitnesslog-'+today()+'.csv',rows.map(r=>r.map(csvValue).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
async function restoreBackup(file) {
 await flushSave();
 const parsed=JSON.parse(await file.text());
 if(parsed.app!=='FitnessLog'||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.exercises))throw Error('Unsupported backup format');
 if(parsed.photos!==undefined&&!Array.isArray(parsed.photos))throw Error('Invalid photo list');
 const hasPhotoPayload=Array.isArray(parsed.photos);
 const question=hasPhotoPayload?
  'Restore this backup? This will REPLACE all workouts, exercise library records, and saved progress photos on this device.':
  'Restore this workout backup? This will REPLACE workouts and exercise library records. Your existing progress photos will be kept.';
 if(!confirm(question))return;
 // Validate and decode every optional photo before starting the atomic DB transaction.
 const photos=hasPhotoPayload?await restorePhotos(parsed.photos):null;
 const stores={sessions:parsed.sessions,exercises:parsed.exercises};
 if(photos!==null)stores.photos=photos;
 await replaceStores(stores);
 for(const url of photoUrls.values())URL.revokeObjectURL(url);
 photoUrls.clear();
 state.photosLoaded=false;
 state.photos=[];
 state.session=null;
 state.tab='home';
 state.libraryDetail=null;
 state.progressExercise='';
 await linkExistingExercises();
 await render();
 toast('Backup restored');
}
async function action(name,el) {
 const s=state.session;
 if(name==='start') {
  await flushSave();
  const active=state.sessions.find(x=>x.status==='active');
  state.expanded=new Set(active?.exercises?.map(x=>x.id)||[]);
  state.session=active||{id:newId(),name:'Workout',date:today(),status:'active',createdAt:new Date().toISOString(),intensity:'',fatigue:'',notes:'',exercises:[],activities:[]};
  await saveSession();return render();
 }
 if(name==='open') {await flushSave();state.session=await get('sessions',el.dataset.id);state.expanded=new Set(state.session.exercises?.map(x=>x.id)||[]);return render();}
 if(name==='close-workout'){await flushSave();state.session=null;state.expanded.clear();state.tab='home';return render();}
 if(name==='history'){state.tab='history';return render();}
 if(name==='progress-metric'){
  if(['weight','reps','rpe'].includes(el.dataset.metric)){
   state.progressMetric=el.dataset.metric;
   await render();
  }
  return;
 }
 if(name==='photo-mode'){
  state.photoMode=el.dataset.mode==='overlay'?'overlay':'side';
  await render();
  return;
 }
 if(name==='delete-photo'){
  const photo=state.photos.find(p=>p.id===el.dataset.id);
  if(!photo)return;
  if(!confirm('Permanently delete the '+photo.view.toLowerCase()+' progress photo from '+displayDate(photo.date)+'?'))return;
  await remove('photos',photo.id);
  state.photosLoaded=false;
  state.photoA=state.photoA===photo.id?'':state.photoA;
  state.photoB=state.photoB===photo.id?'':state.photoB;
  await render();
  toast('Photo deleted');
  return;
 }
 if(name==='history-view'){state.historyView=el.dataset.view==='calendar'?'calendar':'list';return render();}
 if(name==='history-prev-month'||name==='history-next-month'){
  const [year,month]=state.historyMonth.split('-').map(Number);
  const direction=name==='history-prev-month'?-1:1;
  const next=new Date(year,month-1+direction,1);
  state.historyMonth=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0');
  state.historyDate='';
  return render();
 }
 if(name==='history-day'){state.historyDate=el.dataset.date;return render();}
 if(name==='delete-workout'){
  if(!s)return;
  if(!confirm('Permanently delete "'+(s.name||'Workout')+'" from '+displayDate(s.date)+'? This cannot be undone without a backup.'))return;
  await flushSave();
  await saveQueue;
  await remove('sessions',s.id);
  state.session=null;
  state.expanded.clear();
  state.tab='history';
  state.report=false;
  await render();
  toast('Workout deleted');
  return;
 }
 if(name==='select-exercise'){
  const master=state.exercises.find(x=>x.id===el.dataset.id);
  if(master)await addExerciseToWorkout(master);
  return;
 }
 if(name==='toggle-previous'){
  const panel=document.getElementById('previous-panel-'+el.dataset.id);
  if(!panel)return;
  const shouldOpen=el.getAttribute('aria-expanded')!=='true';
  for(const trigger of main.querySelectorAll('[data-action="toggle-previous"]')){
   trigger.setAttribute('aria-expanded','false');
   const related=document.getElementById('previous-panel-'+trigger.dataset.id);
   if(related)related.hidden=true;
  }
  el.setAttribute('aria-expanded',String(shouldOpen));
  panel.hidden=!shouldOpen;
  state.previousOpenId=shouldOpen?el.dataset.id:null;
  return;
 }
 if(name==='rest-start'||name==='rest-iphone'||name==='rest-pause'||name==='rest-resume'||name==='rest-reset'||name==='rest-preset'||name==='rest-minus'||name==='rest-plus'){
  const exercise=s?.exercises?.find(x=>x.id===el.dataset.id);
  if(!exercise)return;
  const key=restKey(exercise);
  const active=readRestTimer();
  const same=active.mode!=='idle'&&active.exerciseId===key;
  if(name==='rest-start'||name==='rest-iphone'){
   const seconds=restPreference(key);
   unlockRestSound();
   startRestTimer(key,exercise.name,seconds);
   refreshRestTimers();
   if(name==='rest-iphone'){
    // The native iPhone Clock alarm is run by the user's own Shortcut.
    // Safari/PWA JavaScript cannot schedule an OS alarm on its own.
    window.location.href=iphoneShortcutUrl(seconds);
   }
  }else if(name==='rest-preset'){
   setRestPreference(key,Number(el.dataset.duration));
   refreshRestTimers();
  }else if(name==='rest-minus'||name==='rest-plus'){
   const delta=name==='rest-plus'?15:-15;
   if(same&&(active.mode==='running'||active.mode==='paused'))adjustRestTimer(delta);
   else setRestPreference(key,restPreference(key)+delta);
   refreshRestTimers();
  }else if(same){
   if(name==='rest-pause')pauseRestTimer();
   if(name==='rest-resume'){unlockRestSound();resumeRestTimer();}
   if(name==='rest-reset')resetRestTimer();
   refreshRestTimers();
  }
  return;
 }
 if(name==='view-library'){state.libraryDetail=el.dataset.id;return render();}
 if(name==='library-back'){state.libraryDetail=null;return render();}
 if(name==='finish'){s.status='finished';clearTimeout(saveTimer);saveTimer=null;await saveSession();state.session=null;state.expanded.clear();state.tab='history';toast('Workout saved');return render();}
 if(name==='add-set'){
  const x=s.exercises.find(x=>x.id===el.dataset.id);
  // The new set starts with no recorded measurements. Its weight, reps and
  // RPE placeholders are derived solely from the same index of the previous
  // completed workout, when available, by renderExercise().
  x.sets.push(blankSet());
  state.expanded.add(x.id);
  await saveSession();
  await render();
  document.querySelectorAll('#exercise-'+x.id+' input[data-field="weight"]').item(x.sets.length-1)?.focus();
  return;
 }
 if(name==='delete-set'){const x=s.exercises.find(x=>x.id===el.dataset.exercise);x.sets=x.sets.filter(y=>y.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-exercise'){if(!confirm('Remove exercise?'))return;state.expanded.delete(el.dataset.id);s.exercises=s.exercises.filter(x=>x.id!==el.dataset.id);await saveSession();return render();}
 if(name==='add-cardio'||name==='add-sauna'){const type=name==='add-cardio'?'cardio':'sauna';s.activities.push({id:newId(),type,mode:type==='cardio'?'Walking':'Traditional',duration:'',distance:'',level:'',temperature:'',intensity:'',notes:''});await saveSession();return render();}
 if(name==='delete-activity'){s.activities=s.activities.filter(a=>a.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-library'){if(!confirm('Delete this custom exercise? Historical workouts will remain.'))return;await remove('exercises',el.dataset.id);return render();}
 if(name==='export-json'||name==='full-backup'){
  const full=name==='full-backup'||(!state.start&&!state.end);
  download('fitnesslog-backup-'+today()+'.json',JSON.stringify({app:'FitnessLog',version:2,createdAt:new Date().toISOString(),sessions:full?state.sessions:selected(),exercises:state.exercises},null,2),'application/json');
  return toast('Workout backup downloaded (photos excluded)');
 }
 if(name==='export-photos-backup'){
  const photos=await list('photos');
  if(!confirm('Include '+photos.length+' private progress photos in the downloaded JSON backup? This file may be large and contain sensitive photographs.'))return;
  const payload={app:'FitnessLog',version:2,createdAt:new Date().toISOString(),sessions:state.sessions,exercises:state.exercises,photos:await photosForBackup(photos)};
  download('fitnesslog-with-photos-'+today()+'.json',JSON.stringify(payload),'application/json');
  return toast('Photo-inclusive backup downloaded');
 }
 if(name==='export-csv'){exportCsv();return toast('CSV downloaded');}
 if(name==='report'){if(state.start&&state.end&&state.start>state.end)return toast('Invalid date range');state.report=true;return render();}
 if(name==='report-close'){state.report=false;return render();}
 if(name==='print'){window.print();return;}
 if(name==='restore'){$('#restore-file').click();return;}
}
function findScope(scope){
 if(scope==='session')return state.session;
 if(scope==='filter')return state;
 const [kind,id,setId]=scope.split(':');
 if(kind==='exercise')return state.session.exercises.find(x=>x.id===id);
 if(kind==='activity')return state.session.activities.find(x=>x.id===id);
 if(kind==='set')return state.session.exercises.find(x=>x.id===id)?.sets.find(x=>x.id===setId);
}
document.addEventListener('click',async ev=>{
 const nav=ev.target.closest('[data-tab]');if(nav){await flushSave();state.tab=nav.dataset.tab;state.report=false;state.session=null;state.expanded.clear();state.libraryDetail=null;await render();return;}
 const el=ev.target.closest('[data-action]');if(!el)return;
 try{await action(el.dataset.action,el);}catch(error){console.error(error);toast('Unable to complete action');}
});
function validateEntry(input,value,showError=false) {
 const {field}=input.dataset;
 if(input.type==='number' && value!=='' && (!Number.isFinite(Number(value))||Number(value)<0)) {
  if(showError)toast('Enter a nonnegative number');
  return false;
 }
 if(['intensity','fatigue'].includes(field)&&value!==''&&(Number(value)<1||Number(value)>10)) {
  if(showError)toast('Rating must be between 1 and 10');
  return false;
 }
 if(field==='rpe'&&value!==''&&(Number(value)<1||Number(value)>10)) {
  if(showError)toast('RPE must be between 1 and 10');
  return false;
 }
 return true;
}

document.addEventListener('input',ev=>{
 if(ev.target.id==='exercise-entry-name')renderExerciseSuggestions(ev.target);
});
document.addEventListener('focusin',ev=>{
 if(ev.target.id==='exercise-entry-name'&&ev.target.value.trim())renderExerciseSuggestions(ev.target);
});
document.addEventListener('keydown',ev=>{
 if(ev.target.id!=='exercise-entry-name')return;
 const list=document.getElementById('exercise-search-options');
 const options=Array.from(list?.querySelectorAll('[data-action="select-exercise"]')||[]);
 const current=Number(list?.dataset.highlight??-1);
 if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&options.length){
  ev.preventDefault();
  const next=ev.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1);
  renderExerciseSuggestions(ev.target,next);
 }else if(ev.key==='Escape'){
  closeExerciseSuggestions();
 }else if(ev.key==='Enter'&&current>=0&&current<options.length&&!list.hidden){
  ev.preventDefault();
  options[current].click();
 }
});
document.addEventListener('click',ev=>{
 if(!ev.target.closest('.exercise-search-field'))closeExerciseSuggestions();
});
document.addEventListener('input',ev=>{
 if(ev.target.id==='photo-overlay-range'){
  state.overlayPercent=Math.max(0,Math.min(100,Number(ev.target.value)));
  const image=document.getElementById('photo-overlay-after');
  if(image)image.style.clipPath='inset(0 '+(100-state.overlayPercent)+'% 0 0)';
  return;
 }
 const {scope,field}=ev.target.dataset||{};
 if(!scope||!field||scope==='filter') {
  if(scope==='filter')state[field]=ev.target.value;
  return;
 }
 // Exercise names are resolved on change, not during partial typing.
 if(field==='name'&&scope.startsWith('exercise:'))return;
 const target=findScope(scope);if(!target)return;
 if(!validateEntry(ev.target,ev.target.value))return;
 target[field]=ev.target.value;
 scheduleSave();
});
document.addEventListener('toggle',ev=>{
 const card=ev.target;
 if(!card.matches?.('[data-exercise-card]')||!document.contains(card))return;
 if(card.open)state.expanded.add(card.dataset.exerciseCard);
 else state.expanded.delete(card.dataset.exerciseCard);
},true);
document.addEventListener('change',async ev=>{
 const progress=ev.target.dataset?.progressControl;
 if(progress){
  const value=ev.target.value;
  if(progress==='exercise'){state.progressExercise=value;state.progressWeight='all';}
  else if(progress==='range'&&['30','90','365','all'].includes(value))state.progressRange=value;
  else if(progress==='weightFilter')state.progressWeight=value;
  else if(progress==='photoView'){state.photoView=value;state.photoA='';state.photoB='';}
  else if(progress==='photoA')state.photoA=value;
  else if(progress==='photoB')state.photoB=value;
  await render();
  return;
 }
 if(ev.target.id==='restore-file'){
  const f=ev.target.files?.[0];
  if(f)try{await restoreBackup(f);}catch(err){console.error(err);toast('Invalid or unreadable backup');}
  return;
 }
 const {scope,field}=ev.target.dataset||{};
 if(!scope||!field)return;
 const target=findScope(scope);if(!target)return;
 const value=ev.target.value;
 if(!validateEntry(ev.target,value,true)) {
  ev.target.value=target[field]??'';
  return;
 }
 if(scope==='filter'){state[field]=value;return;}
 if(field==='name'&&scope.startsWith('exercise:')) {
  const master=await resolveExerciseInput(value);
  if(!master){ev.target.value=target.name;return;}
  target.name=master.name;
  target.exerciseId=master.id;
  await saveSession();
  await render();
  return;
 }
 target[field]=value;
 try{await saveSession();}catch(err){console.error(err);toast('Could not save change');}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target.closest('[data-form]');if(!form)return;ev.preventDefault();
 const data=new FormData(form);
 if(form.dataset.form==='photo-upload'){
  const submitButton=form.querySelector('button[type="submit"]');
  if(submitButton)submitButton.disabled=true;
  try{
   const file=form.querySelector('input[name="photoFile"]')?.files?.[0];
   const date=String(data.get('photoDate')||'');
   const view=String(data.get('photoView')||'');
   if(!file)throw new Error('Choose a photo.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['Front','Side','Back'].includes(view))throw new Error('Choose a valid date and view.');
   const blob=await shrinkPhoto(file);
   await put('photos',{id:newId(),date,view,createdAt:new Date().toISOString(),blob});
   state.photosLoaded=false;
   state.photoView=view;
   state.photoA='';
   state.photoB='';
   await render();
   toast('Progress photo saved privately');
  }catch(err){
   console.error(err);
   toast(err?.message||'Could not save photo');
  }finally{if(submitButton?.isConnected)submitButton.disabled=false;}
  return;
 }
 if(form.dataset.form==='add-exercise'){
  const name=String(data.get('exerciseName')||'').trim();if(!name)return;
  const master=await resolveExerciseInput(name);
  if(!master){document.getElementById('exercise-entry-name')?.focus();return;}
  await addExerciseToWorkout(master);
  return;
 }
 if(form.dataset.form==='library'){
  const name=String(data.get('name')||'').trim();if(!name)return;
  const wasSaved=state.exercises.some(x=>normalizeName(x.name)===normalizeName(name));
  const master=await resolveExerciseInput(name);
  if(!master){form.querySelector('input[name="name"]')?.focus();return;}
  if(!wasSaved){master.muscle=String(data.get('muscle')||'');master.equipment=String(data.get('equipment')||'');await put('exercises',master);}
  await render();toast(wasSaved?'Exercise already exists':'Exercise saved');
 }
});
$('#settings-button').addEventListener('click',async()=>{await flushSave();state.session=null;state.report=false;state.tab='settings';state.libraryDetail=null;await render();});
(async()=>{try{await linkExistingExercises();await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);}catch(err){console.error(err);main.innerHTML='<div class="card">Unable to open local workout storage. Check Safari storage permissions, then reload.</div>';}})();
setInterval(refreshRestTimers,500);
document.addEventListener('visibilitychange',refreshRestTimers);
window.addEventListener('pageshow',refreshRestTimers);
window.addEventListener('focus',refreshRestTimers);
