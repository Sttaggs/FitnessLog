import {list, get, put, putMany, remove, replaceStores, newId} from './db.js';
import {exerciseHistory, exerciseWeights, performanceValue, trendPoints, trendSvg, numericValue} from './analytics.js';
import {shrinkPhoto, photosForBackup, restorePhotos} from './photo-utils.js';
import {renderProgressView} from './progress-ui.js';
import {ADVANCED_TYPES,isAdvancedSet,setTechnique,techniqueLabel,newAdvancedSet,setTechniqueOnExisting,hasRecordedStages,MAX_STAGES,linkSuperset,removeSuperset,cleanSupersets,normalizeSetPlan,templatePlanForSet} from './advanced-utils.js';
import {renderAdvancedSetPanel,renderAdvancedTools,renderSupersetSettings,supersetLabel} from './advanced-ui.js';
import {templateFromWorkout,templateToEntries,sanitizedTemplate,validSetCount,cleanTemplateName,templateSummary,MAX_TEMPLATE_EXERCISES} from './template-utils.js';
import {CATALOG_CATEGORIES,planCatalogInstall} from './exercise-catalog.js';
import {muscleChoices,muscleLabel,exercisePrimaryMuscle,singleMuscleExercise} from './muscle-utils.js';
import {restPreference,setRestPreference,readRestTimer,startRestTimer,pauseRestTimer,resumeRestTimer,resetRestTimer,adjustRestTimer,markRestAlerted,restTimeLabel} from './rest-timer.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');
const title = $('#page-title');
const escapeHtml = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const today = () => new Date().toLocaleDateString('en-CA');
const displayDate = (s) => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return isNaN(+d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
const cardioKinds = ['Walking','Running','Jogging','Sprinting','First-step acceleration drills','Treadmill','Stair stepper','Cycling','Stationary bike','Rowing','Elliptical','Rucking','Hiking','Disc golf','Kayaking','Swimming','HIIT','Other'];
const currentMonth = () => {const now=new Date();return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');};
const state = {tab:'home', session:null, sessions:[], exercises:[], templates:[], templateDraft:null, templateDirty:false, justFinishedSessionId:'', report:false, start:'', end:'', expanded:new Set(), libraryDetail:null, historyView:'list', historyMonth:currentMonth(), historyDate:'', previousOpenId:null, moreOpen:new Set(), advancedOpen:new Set(),templateAdvancedOpen:new Set(), progressExercise:'', progressSection:'exercises', progressCompareType:'repsAtWeight', progressCompareOpen:false, progressTargetOpen:false, progressRepTarget:'5', progressMetric:'weight', progressRange:'90', progressWeight:'all', photos:[], photosLoaded:false, photoView:'Front', photoA:'', photoB:'', photoMode:'side', overlayPercent:50};

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
// Progress uses the exact same match ranking as Add Exercise, but only
// selects existing exercise IDs: searching here never creates new exercises.
function renderProgressExerciseSuggestions(input,highlight=-1){
 const list=document.getElementById('progress-exercise-options');
 if(!list)return;
 const query=input.value.trim();
 const matches=exerciseMatches(query).slice(0,8);
 if(!query){closeProgressExerciseSuggestions(false);return;}
 const viewport=window.visualViewport;
 const bottom=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight);
 const rect=input.getBoundingClientRect();
 const below=bottom-rect.bottom;
 const above=rect.top-(viewport?.offsetTop??0);
 const placeAbove=below<180&&above>below;
 list.classList.toggle('above',placeAbove);
 list.style.maxHeight=Math.min(300,Math.max(110,(placeAbove?above:below)-16))+'px';
 list.hidden=false;
 list.innerHTML=matches.length?matches.map((match,index)=>
  '<button type="button" role="option" id="progress-option-'+index+'" class="exercise-search-option'+(index===highlight?' highlighted':'')+'" aria-selected="'+(index===highlight)+'" data-action="select-progress-exercise" data-id="'+e(match.exercise.id)+'"><span>'+e(match.exercise.name)+'</span><small>'+(match.similar?'Similar spelling — check name':'Saved exercise')+'</small></button>'
 ).join(''):'<div class="exercise-search-empty">No saved exercise matches. Add new exercises during a workout.</div>';
 list.dataset.highlight=String(highlight);
 input.setAttribute('aria-expanded',String(matches.length>0));
 if(highlight>=0&&highlight<matches.length)input.setAttribute('aria-activedescendant','progress-option-'+highlight);
 else input.removeAttribute('aria-activedescendant');
}
function closeProgressExerciseSuggestions(restoreSelected=true){
 const input=document.getElementById('progress-exercise-search');
 const list=document.getElementById('progress-exercise-options');
 if(list){list.hidden=true;list.innerHTML='';}
 if(input){
  input.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');
  // Discard an unfinished search. The currently displayed exercise remains
  // unchanged and is identified independently below the search box.
  if(restoreSelected)input.value=input.defaultValue;
 }
}
function renderTemplateExerciseSuggestions(input,highlight=-1){
 const list=document.getElementById('template-search-options');
 if(!list)return;
 const query=input.value.trim();
 if(!query){closeTemplateExerciseSuggestions();return;}
 const matches=exerciseMatches(query).slice(0,8);
 const viewport=window.visualViewport;
 const bottom=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight);
 const rect=input.getBoundingClientRect();
 const below=bottom-rect.bottom,above=rect.top-(viewport?.offsetTop??0);
 const placeAbove=below<180&&above>below;
 list.classList.toggle('above',placeAbove);
 list.style.maxHeight=Math.min(300,Math.max(110,(placeAbove?above:below)-16))+'px';
 list.hidden=false;
 list.innerHTML=matches.length?matches.map((match,index)=>
  '<button type="button" role="option" id="template-option-'+index+'" class="exercise-search-option'+(index===highlight?' highlighted':'')+
   '" aria-selected="'+(index===highlight)+'" data-action="template-add-saved-exercise" data-id="'+e(match.exercise.id)+'"><span>'+e(match.exercise.name)+
   '</span><small>'+(match.similar?'Similar spelling — check name':'Saved exercise')+'</small></button>').join(''):
  '<div class="exercise-search-empty">No saved match. Use Add exercise to create this name.</div>';
 list.dataset.highlight=String(highlight);
 input.setAttribute('aria-expanded',String(matches.length>0));
 if(highlight>=0&&highlight<matches.length)input.setAttribute('aria-activedescendant','template-option-'+highlight);
 else input.removeAttribute('aria-activedescendant');
}
function closeTemplateExerciseSuggestions(){
 const input=document.getElementById('template-exercise-name');
 const list=document.getElementById('template-search-options');
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
 state.moreOpen.clear();
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
// Install the user's requested starter exercises on this device once.
// Existing workouts/exercise IDs and custom exercises are never replaced.
// The marker also prevents intentionally removed starter entries reappearing.
const CATALOG_INSTALLED_KEY='fitnesslog-starter-exercises-v1';
async function installStarterExercises() {
 try {if(localStorage.getItem(CATALOG_INSTALLED_KEY)==='installed')return;}catch {}
 const existing=await list('exercises');
 const {toInsert,toUpdate}=planCatalogInstall(existing,newId,new Date().toISOString());
 if(toInsert.length||toUpdate.length)await putMany('exercises',[...toInsert,...toUpdate]);
 try {localStorage.setItem(CATALOG_INSTALLED_KEY,'installed');}catch {}
}
// Existing exercise records may contain tags from earlier versions.
// Keep only the assigned muscle; preserve every permanent ID and workout.
async function removeLegacySecondaryMuscles(){
 const existing=await list('exercises');
 const updates=existing.filter(ex=>Object.prototype.hasOwnProperty.call(ex,'secondaryMuscles'))
  .map(singleMuscleExercise);
 if(updates.length)await putMany('exercises',updates);
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

async function refreshData() {state.sessions=(await list('sessions')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));state.exercises=await list('exercises');state.templates=(await list('templates')).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||a.name.localeCompare(b.name));}
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
 if(state.tab==='progress' && state.progressSection==='photos' && !state.session && !state.report && !state.photosLoaded)await refreshPhotos();
 document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab||(b.dataset.tab==='home'&&['templates','template-editor'].includes(state.tab))));
 title.textContent=state.session?'Workout':({home:'Home',history:'History',progress:'Progress',library:'Library',settings:'Settings',templates:'Templates','template-editor':'Edit template'})[state.tab]||'FitnessLog';
 main.innerHTML=state.report?renderReport():state.session?renderWorkout():({home:renderHome,history:renderHistory,progress:renderProgress,library:renderLibrary,settings:renderSettings,templates:renderTemplates,'template-editor':renderTemplateEditor}[state.tab]||renderHome)();
}
function renderHome() {
 const recent=state.sessions.slice(0,4);
 const latest=state.sessions.find(s=>s.status==='finished');
 return `<section class="card hero"><div class="eyebrow">YOUR NEXT SESSION</div><h2 style="font-size:26px;margin:10px 0">Train your way.</h2><p class="muted">Log just an exercise name, or track every set. Nothing is required.</p>${button('＋ Start workout','start','wide')}<div class="template-home-actions">${button('Use a template','show-templates','secondary')}${button('Create template','new-template','secondary')}</div>${state.sessions.some(s=>s.status==='active')?'<p class="helper">An unfinished workout is available to resume below.</p>':''}</section>
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
 ${state.templates.length?'<details class="card template-workout-picker"><summary>Add exercises from template</summary><div class="template-workout-picker-list">'+state.templates.map(t=>'<button type="button" class="btn secondary wide" data-action="append-template" data-id="'+e(t.id)+'">'+e(t.name)+' <span class="helper">· '+e(templateSummary(t))+'</span></button>').join('')+'</div></details>':''}
 <div class="card"><form data-form="add-exercise" class="stack"><div class="field exercise-search-field"><label for="exercise-entry-name">Add an exercise</label><input id="exercise-entry-name" name="exerciseName" placeholder="Search or type a new exercise" required autocomplete="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="exercise-search-options" aria-expanded="false"><div id="exercise-search-options" class="exercise-search-options" role="listbox" aria-label="Existing matching exercises" hidden></div></div><button class="btn secondary wide" type="submit">＋ Add exercise</button><p class="helper" style="margin:0">Select a saved exercise to keep its history linked. New names are saved automatically.</p></form></div>
 <div class="section-heading"><h2>Cardio and sauna</h2></div>${s.activities.map((x,i)=>renderActivity(x,i)).join('')}
 <div class="card"><div class="grid2">${button('＋ Cardio','add-cardio','secondary')}${button('＋ Sauna','add-sauna','secondary')}</div></div>
 <div class="card"><div class="stack">
 ${button(s.status==='active'?'Finish workout':'Save changes','finish','wide')}
 ${button('Save as template','save-workout-template','secondary wide')}
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
function restMinutesLabel(seconds){
 return String(Math.round(seconds/60*100)/100);
}
function renderRestTimer(x) {
 const key=restKey(x);
 const timer=readRestTimer();
 const active=timer.mode!=='idle'&&timer.exerciseId===key;
 const mode=active?timer.mode:'idle';
 const isRunning=mode==='running';
 const isFinished=mode==='finished';
 const primaryAction=active?'rest-stop':'rest-start';
 return '<div class="rest-tiny" data-exercise-timer="'+e(key)+'" data-mode="'+mode+'" role="group" aria-label="Rest timer for '+e(x.name)+'">'+
  '<span class="rest-tiny-label">Rest</span>'+
  '<input class="rest-tiny-minutes" data-rest-minutes data-exercise-id="'+e(x.id)+'" type="number" min="0.25" max="30" step="any" inputmode="decimal" aria-label="Rest duration in minutes" value="'+e(restMinutesLabel(restPreference(key)))+'" '+(active?'hidden':'')+'>'+
  '<span class="rest-tiny-unit" data-rest-unit '+(active?'hidden':'')+'>min</span>'+
  '<output class="rest-tiny-countdown" data-rest-clock aria-label="Rest time remaining" '+(!active?'hidden':'')+'>'+restTimeLabel(active?timer.remaining:0)+'</output>'+
  '<button type="button" class="rest-tiny-action" data-rest-primary data-action="'+primaryAction+'" data-id="'+e(x.id)+'" aria-label="'+(active?'Stop rest timer':'Start rest timer')+'">'+(active?(isFinished?'Reset':'Stop'):'Start')+'</button>'+
  '</div>';
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
 if(timer.mode==='finished'&&!timer.notified&&!document.hidden){
  const recent=Number.isFinite(timer.endAt)&&Date.now()-timer.endAt<60000;
  markRestAlerted();
  if(recent){playRestSound();toast('Rest complete · '+timer.exerciseName);}
 }
 for(const panel of main.querySelectorAll('[data-exercise-timer]')){
  const key=panel.dataset.exerciseTimer;
  const active=timer.mode!=='idle'&&timer.exerciseId===key;
  const mode=active?timer.mode:'idle';
  panel.dataset.mode=mode;
  const input=panel.querySelector('[data-rest-minutes]');
  const unit=panel.querySelector('[data-rest-unit]');
  const countdown=panel.querySelector('[data-rest-clock]');
  if(input)input.hidden=active;
  if(unit)unit.hidden=active;
  if(countdown){
   countdown.hidden=!active;
   if(active)countdown.textContent=restTimeLabel(timer.remaining);
  }
  const button=panel.querySelector('[data-rest-primary]');
  if(button){
   const label=active?mode==='finished'?'Reset':'Stop':'Start';
   button.dataset.action=active?'rest-stop':'rest-start';
   button.textContent=label;
   button.setAttribute('aria-label',label+' rest timer');
  }
 }
}
function muscleOptions(selected){
 const candidates=muscleChoices(state.exercises);
 if(selected&&!candidates.includes(selected))candidates.push(selected);
 return '<option value="">Unassigned</option>'+candidates.map(muscle=>
  '<option value="'+e(muscle)+'" '+(selected===muscle?'selected':'')+'>'+e(muscle)+'</option>').join('');
}
function renderProgressionTarget(master,compact=false){
 const target=master?.progressTarget||{};
 const label=(field,label,value,min,max,step='1')=>
  '<label class="field">'+label+
  '<input type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+
  '" data-progress-target="'+e(master.id)+'" data-target-field="'+field+'" value="'+e(value??'')+'" placeholder="—"></label>';
 return '<div class="progress-target-grid">'+
  label('sets','Working sets',target.sets,1,12)+
  label('reps','Reps per set',target.reps,1,30)+
  label('increment','Add weight (lb)',target.increment,0.5,50,'any')+
  label('rpeCeiling','RPE ceiling (optional)',target.rpeCeiling,1,10,'0.5')+
 '</div>'+
 (compact?'<p class="helper">Targets only guide suggestions. Logged sets remain unchanged.</p>':
  '<p class="helper">When all targeted working sets reach the rep goal at the same weight, a load increase may be suggested. RPE is optional.</p>');
}
function renderExerciseMore(x,scope,type){
 const master=state.exercises.find(ex=>ex.id===x.exerciseId);
 const primary=exercisePrimaryMuscle(master);
 const expanded=state.moreOpen.has(x.id);
 return '<details class="exercise-more" data-exercise-more="'+e(x.id)+'" '+(expanded?'open':'')+'>'+
  '<summary>More <span aria-hidden="true">⌄</span></summary>'+
  '<div class="exercise-more-body">'+
  '<div class="field-row">'+
    textField('Exercise name',scope,'name',x.name)+
    '<div class="field"><label>Technique</label><div class="technique-label">'+e(type)+'</div></div>'+
  '</div>'+
  (master?'<div class="exercise-muscle-controls">'+
   '<label class="field">Muscle group'+
     '<select data-muscle-primary="'+e(master.id)+'">'+muscleOptions(primary)+'</select></label>'+
  '</div>':'<p class="helper">Choose a saved exercise to assign a muscle group.</p>')+
  (master?'<details class="exercise-secondary-config"><summary>Progression target (optional)</summary>'+
    '<div class="exercise-secondary-config-body">'+renderProgressionTarget(master,true)+'</div></details>':'')+
  '<details class="exercise-secondary-config"><summary>Mark warm-up sets (optional)</summary>'+
   '<div class="exercise-warmup-list">'+(x.sets||[]).map((set,j)=>
    '<label class="exercise-warmup-row"><input type="checkbox" data-warmup-entry="'+e(x.id)+'" data-warmup-set="'+e(set.id)+'" '+(set.warmup===true?'checked':'')+'>'+
    '<span>Set '+(j+1)+' · '+e(set.weight||'—')+' lb × '+e(set.reps||'—')+' reps</span></label>').join('')+
   '</div><p class="helper">Marked warm-ups are excluded from strength estimates and target checks.</p></details>'+
  renderSupersetSettings(x,state.session?.exercises,e)+
  memoField('Exercise notes',scope,'notes',x.notes||'')+
  '<div class="exercise-remove-row"><button type="button" class="btn danger small" data-action="delete-exercise" data-id="'+e(x.id)+'">Remove exercise</button></div>'+
  '</div></details>';
}
function renderExercise(x,i) {
 const isOpen=state.expanded.has(x.id);
 const prev=x.exerciseId?previousPerformance(x.exerciseId,state.session?.id,state.session?.date):null;
 const scope='exercise:'+x.id;
 const type=x.technique||'Standard';
 return `<details class="detail" id="exercise-${x.id}" data-exercise-card="${x.id}" ${isOpen?'open':''}>
 <summary><div class="row between"><div><div class="item-title">${e(x.name||'Exercise')}</div><small class="muted">${e(supersetLabel(x,state.session?.exercises)?supersetLabel(x,state.session?.exercises)+' · ':'')}${e(type)} · ${x.sets?.length||0} ${x.sets?.length===1?'set':'sets'}</small></div><span class="muted">▾</span></div></summary>
 <div class="detail-body">
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
 <button class="btn danger set-delete" data-action="delete-set" data-exercise="${x.id}" data-id="${set.id}" aria-label="Remove set ${j+1}">×</button></div>${renderAdvancedSetPanel(x,set,e,state.advancedOpen.has(x.id+':'+set.id))}`).join('')}
 ${prev?'<p class="helper historical-hint">Faded values show last time; only typed values are saved.</p>':''}
 <div class="exercise-add-set"><button class="btn secondary small" data-action="add-set" data-id="${x.id}">＋ Add set</button></div>
 ${renderAdvancedTools(x,e)}
 ${renderExerciseMore(x,scope,type)}
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
 ${state.justFinishedSessionId?'<div class="card template-after-finish"><strong>Workout saved</strong><p class="helper">Want to reuse these exercises and set counts?</p><div class="row wrap"><button class="btn secondary" data-action="save-finished-template">Save as template</button><button class="btn ghost" data-action="dismiss-finished-template">Not now</button></div></div>':''}
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
function renderTemplates(){
 const list=state.templates.map(template=>
  '<div class="item template-list-item"><div class="template-list-head"><div class="grow"><strong>'+e(template.name)+'</strong>'+
   '<p class="helper">'+e(templateSummary(template))+'</p></div>'+
   '<button type="button" class="btn small" data-action="start-from-template" data-id="'+e(template.id)+'">Start</button></div>'+
   '<div class="template-list-actions">'+
    '<button type="button" class="btn ghost small" data-action="edit-template" data-id="'+e(template.id)+'">Edit</button>'+
    '<button type="button" class="btn ghost small" data-action="delete-template" data-id="'+e(template.id)+'">Delete</button>'+
   '</div></div>').join('');
 return '<button type="button" class="btn ghost small" data-action="templates-home">← Home</button>'+
  '<div class="card"><h2>Workout templates</h2>'+
   '<p class="helper">Start a new workout with preset exercises and set counts, or create and edit templates without logging a workout. Every new set begins blank.</p>'+
   '<button type="button" class="btn wide" data-action="new-template">＋ Create template</button></div>'+
  (state.templates.length?'<div class="section-heading"><h2>Saved templates</h2><span class="pill">'+state.templates.length+'</span></div>'+list:
   '<div class="card empty">No templates saved yet. Create one here, or save a workout as a template.</div>');
}
function renderTemplateEditor(){
 const template=state.templateDraft;
 if(!template)return '<div class="card">No template is open.</div>';
 const count=template.exercises?.length||0;
 const exerciseRows=(template.exercises||[]).map((entry,index)=>
  '<div class="item template-editor-row"><div class="template-editor-row-head"><strong>'+e(entry.name)+'</strong>'+
   '<button type="button" class="btn ghost small" data-action="template-remove-exercise" data-index="'+index+'" aria-label="Remove '+e(entry.name)+'">Remove</button></div>'+
   '<div class="template-editor-row-bottom"><label>Sets<input type="number" inputmode="numeric" min="1" max="20" step="1" data-template-sets="'+index+'" value="'+e(entry.sets)+'" aria-label="Number of sets for '+e(entry.name)+'"></label>'+
   '<div class="template-order-buttons"><button type="button" class="btn secondary small" data-action="template-move-up" data-index="'+index+'" aria-label="Move '+e(entry.name)+' earlier" '+(index===0?'disabled':'')+'>↑</button>'+
   '<button type="button" class="btn secondary small" data-action="template-move-down" data-index="'+index+'" aria-label="Move '+e(entry.name)+' later" '+(index===count-1?'disabled':'')+'>↓</button></div></div></div>'
 ).join('');
 const search='<form data-form="template-add-exercise" class="template-add-exercise"><div class="field exercise-search-field template-search-field">'+
  '<label for="template-exercise-name">Add an exercise</label>'+
  '<input id="template-exercise-name" name="exerciseName" placeholder="Search or type a new exercise" required autocomplete="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="template-search-options" aria-expanded="false">'+
  '<div id="template-search-options" class="exercise-search-options" role="listbox" aria-label="Exercises for template" hidden></div></div>'+
  '<button class="btn secondary wide" type="submit">＋ Add exercise</button></form>';
 return '<button type="button" class="btn ghost small" data-action="templates-back">← Templates</button>'+
  '<div class="card template-editor-heading"><h2>'+e(template.createdAt&&state.templates.some(x=>x.id===template.id)?'Edit template':'New template')+'</h2>'+
   '<label class="field" for="template-name">Template name<input id="template-name" type="text" maxlength="100" value="'+e(template.name)+'" placeholder="e.g. Push day"></label>'+
   '<p class="helper">Only exercise order and set counts are saved. Creating a template does not log a workout.</p></div>'+
  '<div class="section-heading"><h2>Exercises</h2><span class="pill">'+count+'</span></div>'+
  (exerciseRows||'<div class="card empty">No exercises yet. Add one below.</div>')+
  (count<MAX_TEMPLATE_EXERCISES?'<div class="card">'+search+'</div>':'<p class="helper">Template exercise limit reached.</p>')+
  '<div class="card template-editor-footer"><button type="button" class="btn wide" data-action="template-save">Save template</button>'+
   '<button type="button" class="btn secondary wide" data-action="templates-back">Cancel</button></div>';
}
function renderProgress() {
 return renderProgressView({state,e,displayDate,photoUrl});
}
function renderLibrary() {
 if(state.libraryDetail) {
  const ex=state.exercises.find(x=>x.id===state.libraryDetail);
  if(!ex){state.libraryDetail=null;return '<div class="card">Exercise not found.</div>';}
  const records=state.sessions.flatMap(s=>(s.exercises||[]).filter(x=>x.exerciseId===ex.id).map(x=>({session:s,entry:x})));
  return '<button class="btn secondary small" data-action="library-back">← All exercises</button>'+
   '<div class="card" style="margin-top:12px"><h2>'+e(ex.name)+'</h2>'+
   '<p class="helper">'+e(exercisePrimaryMuscle(ex)||ex.category||'Muscle unspecified')+' · '+e(ex.equipment||'Equipment unspecified')+'</p>'+
   '<p>'+records.length+' recorded workout entries</p>'+
   '</div>'+
   '<div class="section-heading"><h2>Performance history</h2></div>'+
   (records.length?records.map(({session,entry})=>'<div class="item">'+
    '<div class="row between"><div class="grow"><strong>'+e(displayDate(session.date))+'</strong><p class="helper" style="margin:4px 0">'+e(session.name)+'</p>'+
    '<p class="helper" style="margin:4px 0">'+e(recordedSets(entry).map(set=>
     [set.weight?set.weight+' lb':'',set.reps?set.reps+' reps':'',set.rpe?'RPE '+set.rpe:''].filter(Boolean).join(' · ')).join(' | ')||'Exercise logged; no set details')+
    '</p></div><button class="btn small secondary" data-action="open" data-id="'+e(session.id)+'">View</button></div></div>').join(''):
    '<div class="card empty">No history for this exercise yet.</div>');
 }
 const grouped=new Map();
 for(const exercise of state.exercises){
  const category=String(exercise.category||exercisePrimaryMuscle(exercise)||'Custom');
  if(!grouped.has(category))grouped.set(category,[]);
  grouped.get(category).push(exercise);
 }
 const categories=[...CATALOG_CATEGORIES.filter(category=>grouped.has(category)),
  ...[...grouped.keys()].filter(category=>!CATALOG_CATEGORIES.includes(category)).sort((a,b)=>a==='Custom'?1:b==='Custom'?-1:a.localeCompare(b))];
 const sections=categories.map(category=>{
  const items=grouped.get(category).slice().sort((a,b)=>a.name.localeCompare(b.name));
  return '<details class="library-category" data-library-category="'+e(category)+'">'+
   '<summary><span>'+e(category)+'</span><small>'+items.length+'</small></summary>'+
   '<div class="library-category-body">'+items.map(exercise=>{
    const primary=exercisePrimaryMuscle(exercise);
    const subtitle=primary&&primary!==category?primary:primary||exercise.category||'Unassigned';
    const searchable=exercise.name+' '+category+' '+primary+' '+(exercise.equipment||'');
    return '<div class="item library-exercise" data-library-entry data-library-search="'+e(normalizeName(searchable))+'">'+
     '<div class="row between"><div class="grow"><div class="item-title">'+e(exercise.name)+'</div>'+
     '<small>'+e(subtitle)+' · '+e(exercise.equipment||'No equipment')+'</small></div>'+
     '<button class="btn small secondary" data-action="view-library" data-id="'+e(exercise.id)+'">History</button></div></div>';
   }).join('')+'</div></details>';
 }).join('');
 return '<div class="card"><h2>Exercise library</h2>'+
  '<p class="helper">Choose from the starter exercises or add any custom exercise. Existing workout history remains linked.</p>'+
  '<form data-form="library" class="stack"><div class="field"><label>New exercise (optional)</label>'+
  '<input name="name" placeholder="Exercise name" required></div><div class="field-row">'+
  '<div class="field"><label>Muscle group</label><select name="muscle">'+muscleOptions('')+'</select></div>'+
  '<div class="field"><label>Equipment</label><input name="equipment" placeholder="Dumbbells"></div></div>'+
  '<button class="btn secondary wide" type="submit">Add to library</button></form></div>'+
  '<div class="section-heading"><h2>Saved exercises</h2><span class="pill">'+state.exercises.length+'</span></div>'+
  '<div class="library-search-field field"><label for="library-filter">Find a saved exercise</label>'+
  '<input id="library-filter" type="search" placeholder="Search by name or muscle" autocomplete="off" spellcheck="false">'+
  '<p id="library-filter-count" class="helper" aria-live="polite">Browse the categories below, or type to filter.</p></div>'+
  (state.exercises.length?'<div id="library-groups">'+sections+'</div>':
   '<div class="card empty">Your exercises will appear here automatically as you log them.</div>');
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
 if(parsed.templates!==undefined&&!Array.isArray(parsed.templates))throw Error('Invalid template list');
 const hasPhotoPayload=Array.isArray(parsed.photos);
 const question=hasPhotoPayload?
  'Restore this backup? This will REPLACE workouts, exercise library records, and photos, plus saved templates if the backup contains them.':
  'Restore this workout backup? This will REPLACE workouts and exercise library records. Existing photos and templates absent from the backup will be kept.';
 if(!confirm(question))return;
 // Validate and decode every optional photo before starting the atomic DB transaction.
 const photos=hasPhotoPayload?await restorePhotos(parsed.photos):null;
 const stores={sessions:parsed.sessions,exercises:parsed.exercises.map(singleMuscleExercise)};
 if(Array.isArray(parsed.templates))stores.templates=parsed.templates.map(sanitizedTemplate).filter(Boolean);
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
 state.templateDraft=null;state.templateDirty=false;state.justFinishedSessionId='';
 await linkExistingExercises();
 await render();
 toast('Backup restored');
}
function templateDraftAddExercise(master){
 if(!state.templateDraft||!master)return false;
 if(state.templateDraft.exercises.length>=MAX_TEMPLATE_EXERCISES){toast('Template exercise limit reached');return false;}
 state.templateDraft.exercises.push({exerciseId:master.id,name:master.name,sets:3});
 state.templateDirty=true;
 return true;
}
function readTemplateEditorValues(){
 if(!state.templateDraft)return false;
 const input=document.getElementById('template-name');
 if(input)state.templateDraft.name=input.value;
 for(const field of document.querySelectorAll('[data-template-sets]')){
  const count=validSetCount(field.value),index=Number(field.dataset.templateSets);
  if(count===null||!state.templateDraft.exercises[index]){
   toast('Set counts must be whole numbers from 1 to 20');
   field.focus();
   return false;
  }
  state.templateDraft.exercises[index].sets=count;
 }
 return true;
}
async function saveWorkoutAsTemplate(session){
 if(!session?.exercises?.length){toast('Add an exercise before saving a template');return false;}
 const input=prompt('Save workout as template — name',session.name||'Workout template');
 if(input===null)return false;
 const name=cleanTemplateName(input);
 if(!name){toast('Enter a template name');return false;}
 const existing=state.templates.find(x=>normalizeName(x.name)===normalizeName(name));
 if(existing&&!confirm('Replace the saved template "'+existing.name+'"?'))return false;
 const template=templateFromWorkout({...session,name},existing?.id||newId());
 if(existing)template.createdAt=existing.createdAt;
 await put('templates',template);
 await refreshData();
 toast(existing?'Template updated':'Template saved');
 return true;
}
async function action(name,el) {
 const s=state.session;
 if(name==='show-templates'){state.session=null;state.tab='templates';state.justFinishedSessionId='';return render();}
 if(name==='templates-home'){state.templateDraft=null;state.templateDirty=false;state.tab='home';return render();}
 if(name==='new-template'){
  const now=new Date().toISOString();
  state.templateDraft={id:newId(),name:'New template',createdAt:now,updatedAt:now,exercises:[]};
  state.templateDirty=false;state.tab='template-editor';return render();
 }
 if(name==='edit-template'){
  const source=state.templates.find(x=>x.id===el.dataset.id);
  if(!source)return;
  state.templateDraft=sanitizedTemplate(source);
  state.templateDirty=false;state.tab='template-editor';return render();
 }
 if(name==='templates-back'){
  if(state.templateDirty&&!confirm('Discard unsaved template changes?'))return;
  state.templateDraft=null;state.templateDirty=false;state.tab='templates';return render();
 }
 if(name==='template-add-saved-exercise'){
  const master=state.exercises.find(ex=>ex.id===el.dataset.id);
  if(templateDraftAddExercise(master))await render();
  return;
 }
 if(name==='template-remove-exercise'){
  if(!state.templateDraft)return;
  const index=Number(el.dataset.index);
  if(index>=0&&index<state.templateDraft.exercises.length){
   state.templateDraft.exercises.splice(index,1);state.templateDirty=true;await render();
  }
  return;
 }
 if(name==='template-move-up'||name==='template-move-down'){
  const entries=state.templateDraft?.exercises;
  if(!entries)return;
  const source=Number(el.dataset.index),dest=source+(name==='template-move-up'?-1:1);
  if(source>=0&&source<entries.length&&dest>=0&&dest<entries.length){
   [entries[source],entries[dest]]=[entries[dest],entries[source]];
   state.templateDirty=true;await render();
  }
  return;
 }
 if(name==='template-save'){
  if(!readTemplateEditorValues())return;
  const draft=state.templateDraft;
  if(!draft)return;
  const name=cleanTemplateName(draft.name);
  if(!name){toast('Enter a template name');document.getElementById('template-name')?.focus();return;}
  if(!draft.exercises.length){toast('Add at least one exercise');return;}
  const clash=state.templates.find(x=>x.id!==draft.id&&normalizeName(x.name)===normalizeName(name));
  if(clash){toast('A template with this name already exists');return;}
  const save=sanitizedTemplate({...draft,name,updatedAt:new Date().toISOString()});
  await put('templates',save);
  state.templateDraft=null;state.templateDirty=false;state.tab='templates';
  await render();toast('Template saved');return;
 }
 if(name==='delete-template'){
  const entry=state.templates.find(x=>x.id===el.dataset.id);
  if(!entry||!confirm('Delete template "'+entry.name+'"? This will not delete any workouts.'))return;
  await remove('templates',entry.id);await render();toast('Template deleted');return;
 }
 if(name==='start-from-template'||name==='append-template'){
  const template=state.templates.find(x=>x.id===el.dataset.id);
  if(!template)return;
  await flushSave();
  const active=s||state.sessions.find(x=>x.status==='active');
  if(active&&name==='start-from-template'&&!confirm('Add this template to your unfinished workout?'))return;
  // Reconnect stale template exercise IDs after library edits or old restores.
  const source=sanitizedTemplate(template);
  for(const item of source.exercises){
   if(state.exercises.some(ex=>ex.id===item.exerciseId))continue;
   const resolved=await ensureExercise(item.name);
   if(resolved)item.exerciseId=resolved.id;
  }
  const newEntries=templateToEntries(source,state.exercises,newId);
  if(active){
   state.session=active;
   state.session.exercises.push(...newEntries);
  }else{
   const now=new Date().toISOString();
   state.session={id:newId(),name:template.name,date:today(),status:'active',createdAt:now,intensity:'',fatigue:'',notes:'',
    exercises:newEntries,activities:[]};
  }
  state.expanded=new Set(state.session.exercises.slice(-1).map(x=>x.id));
  state.moreOpen.clear();state.previousOpenId=null;state.tab='home';state.justFinishedSessionId='';
  await saveSession();await render();toast('Template loaded');return;
 }
 if(name==='save-workout-template'){
  if(!s)return;
  await flushSave();
  await saveWorkoutAsTemplate(s);return;
 }
 if(name==='save-finished-template'){
  const finished=state.sessions.find(x=>x.id===state.justFinishedSessionId);
  if(!finished)return;
  if(await saveWorkoutAsTemplate(finished)){state.justFinishedSessionId='';await render();}
  return;
 }
 if(name==='dismiss-finished-template'){state.justFinishedSessionId='';return render();}
 if(name==='start') {
  await flushSave();
  const active=state.sessions.find(x=>x.status==='active');
  state.expanded=new Set(active?.exercises?.map(x=>x.id)||[]);
  state.session=active||{id:newId(),name:'Workout',date:today(),status:'active',createdAt:new Date().toISOString(),intensity:'',fatigue:'',notes:'',exercises:[],activities:[]};
  await saveSession();return render();
 }
 if(name==='open') {await flushSave();state.session=await get('sessions',el.dataset.id);state.expanded=new Set(state.session.exercises?.map(x=>x.id)||[]);return render();}
 if(name==='close-workout'){await flushSave();state.session=null;state.moreOpen.clear();state.expanded.clear();state.tab='home';return render();}
 if(name==='history'){state.tab='history';return render();}
 if(name==='progress-section'){
  if(['exercises','muscles','photos'].includes(el.dataset.section)){
   state.progressSection=el.dataset.section;
   await render();
  }
  return;
 }
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
 if(name==='select-progress-exercise'){
  const selected=state.exercises.find(ex=>ex.id===el.dataset.id);
  if(selected){
   state.progressExercise=selected.id;
   state.progressWeight='all';
   await render();
  }
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
 if(name==='rest-start'||name==='rest-stop'){
  const exercise=s?.exercises?.find(x=>x.id===el.dataset.id);
  if(!exercise)return;
  const key=restKey(exercise);
  if(name==='rest-stop'){
   const running=readRestTimer();
   if(running.mode!=='idle'&&running.exerciseId===key)resetRestTimer();
  }else{
   const input=document.querySelector('[data-rest-minutes][data-exercise-id="'+exercise.id+'"]');
   const minutes=Number(input?.value);
   if(!input||input.value.trim()===''||!Number.isFinite(minutes)||minutes<0.25||minutes>30){
    toast('Enter a rest time between 0.25 and 30 minutes');
    input?.focus();
    return;
   }
   const seconds=Math.round(minutes*60);
   setRestPreference(key,seconds);
   unlockRestSound();
   startRestTimer(key,exercise.name,seconds);
   input.blur();
  }
  refreshRestTimers();
  return;
 }
 if(name==='view-library'){state.libraryDetail=el.dataset.id;return render();}
 if(name==='library-back'){state.libraryDetail=null;return render();}
 if(name==='finish'){const wasActive=s.status==='active';s.status='finished';clearTimeout(saveTimer);saveTimer=null;await saveSession();state.justFinishedSessionId=wasActive?s.id:'';state.session=null;state.expanded.clear();state.tab='history';toast('Workout saved');return render();}
 if(name==='add-advanced-set'){
  const entry=s?.exercises?.find(x=>x.id===el.dataset.id);
  const type=el.dataset.type;
  if(!entry||!ADVANCED_TYPES.includes(type))return;
  const added=newAdvancedSet(type,newId);
  entry.sets.push(added);
  state.expanded.add(entry.id);
  state.advancedOpen.add(entry.id+':'+added.id);
  await saveSession();await render();
  return;
 }
 if(name==='convert-set'){
  const entry=s?.exercises?.find(x=>x.id===el.dataset.id);
  if(!entry)return;
  const setId=main.querySelector('[data-convert-set="'+entry.id+'"]')?.value;
  const type=main.querySelector('[data-convert-type="'+entry.id+'"]')?.value;
  const chosen=entry.sets.find(x=>x.id===setId);
  if(!chosen||!['standard',...ADVANCED_TYPES].includes(type))return;
  if(setTechnique(chosen)===type){toast('Set already uses this type');return;}
  if(hasRecordedStages(chosen)&&!confirm('Changing the set type removes its recorded extra stages. Continue?'))return;
  setTechniqueOnExisting(chosen,type,newId);
  if(type!=='standard')state.advancedOpen.add(entry.id+':'+chosen.id);
  else state.advancedOpen.delete(entry.id+':'+chosen.id);
  await saveSession();await render();
  return;
 }
 if(name==='add-stage'||name==='remove-stage'){
  const entry=s?.exercises?.find(x=>x.id===el.dataset.exercise);
  const chosen=entry?.sets?.find(set=>set.id===el.dataset.set);
  if(!chosen||!isAdvancedSet(chosen))return;
  chosen.stages=Array.isArray(chosen.stages)?chosen.stages:[];
  if(name==='add-stage'){
   if(chosen.stages.length>=MAX_STAGES){toast('Stage limit reached');return;}
   chosen.stages.push({id:newId(),weight:'',reps:'',rpe:''});
  }else{
   const stage=chosen.stages.find(stage=>stage.id===el.dataset.stage);
   if(!stage)return;
   if(['weight','reps','rpe'].some(key=>stage[key]!==''&&stage[key]!==null&&stage[key]!==undefined)&&
      !confirm('Remove this recorded stage?'))return;
   chosen.stages=chosen.stages.filter(stage=>stage.id!==el.dataset.stage);
  }
  state.advancedOpen.add(entry.id+':'+chosen.id);
  await saveSession();await render();
  return;
 }
 if(name==='link-superset'){
  const first=s?.exercises?.findIndex(x=>x.id===el.dataset.id);
  const partner=main.querySelector('[data-superset-partner="'+el.dataset.id+'"]')?.value;
  const second=s?.exercises?.findIndex(x=>x.id===partner);
  if(first===undefined||first<0||second===undefined||second<0){toast('Select an exercise to link');return;}
  if((s.exercises[first].supersetId||s.exercises[second].supersetId)&&
     !confirm('Replace any existing superset links for these exercises?'))return;
  linkSuperset(s.exercises,first,second,newId);
  await saveSession();await render();toast('Superset linked');
  return;
 }
 if(name==='unlink-superset'){
  const index=s?.exercises?.findIndex(x=>x.id===el.dataset.id);
  if(index===undefined||index<0)return;
  removeSuperset(s.exercises,index);
  await saveSession();await render();toast('Superset unlinked');
  return;
 }
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
 if(name==='delete-set'){const x=s?.exercises?.find(x=>x.id===el.dataset.exercise);if(!x)return;state.advancedOpen.delete(x.id+':'+el.dataset.id);x.sets=x.sets.filter(y=>y.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-exercise'){if(!s||!confirm('Remove exercise?'))return;const index=s.exercises.findIndex(x=>x.id===el.dataset.id);if(index<0)return;removeSuperset(s.exercises,index);state.moreOpen.delete(el.dataset.id);state.expanded.delete(el.dataset.id);s.exercises=s.exercises.filter(x=>x.id!==el.dataset.id);await saveSession();return render();}
 if(name==='add-cardio'||name==='add-sauna'){const type=name==='add-cardio'?'cardio':'sauna';s.activities.push({id:newId(),type,mode:type==='cardio'?'Walking':'Traditional',duration:'',distance:'',level:'',temperature:'',intensity:'',notes:''});await saveSession();return render();}
 if(name==='delete-activity'){s.activities=s.activities.filter(a=>a.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-library'){if(!confirm('Delete this custom exercise? Historical workouts will remain.'))return;await remove('exercises',el.dataset.id);return render();}
 if(name==='export-json'||name==='full-backup'){
  const full=name==='full-backup'||(!state.start&&!state.end);
  download('fitnesslog-backup-'+today()+'.json',JSON.stringify({app:'FitnessLog',version:3,createdAt:new Date().toISOString(),sessions:full?state.sessions:selected(),exercises:state.exercises,...(full?{templates:state.templates}:{})},null,2),'application/json');
  return toast('Workout backup downloaded (photos excluded)');
 }
 if(name==='export-photos-backup'){
  const photos=await list('photos');
  if(!confirm('Include '+photos.length+' private progress photos in the downloaded JSON backup? This file may be large and contain sensitive photographs.'))return;
  const payload={app:'FitnessLog',version:3,createdAt:new Date().toISOString(),sessions:state.sessions,exercises:state.exercises,templates:state.templates,photos:await photosForBackup(photos)};
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
 if(kind==='stage')return state.session.exercises.find(x=>x.id===id)?.sets.find(x=>x.id===setId)?.stages?.find(x=>x.id===scope.split(':')[3]);
}
document.addEventListener('click',async ev=>{
 const nav=ev.target.closest('[data-tab]');if(nav){if(state.tab==='template-editor'&&state.templateDirty&&!confirm('Discard unsaved template changes?'))return;state.templateDraft=null;state.templateDirty=false;state.justFinishedSessionId='';await flushSave();state.tab=nav.dataset.tab;state.report=false;state.session=null;state.expanded.clear();state.moreOpen.clear();state.libraryDetail=null;await render();return;}
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
 if(ev.target.id==='progress-exercise-search')renderProgressExerciseSuggestions(ev.target);
 if(ev.target.id==='template-exercise-name')renderTemplateExerciseSuggestions(ev.target);
 if(ev.target.id==='template-name'&&state.templateDraft){state.templateDraft.name=ev.target.value;state.templateDirty=true;}
 if(ev.target.id==='library-filter'){
  const query=normalizeName(ev.target.value);
  let count=0;
  for(const section of main.querySelectorAll('[data-library-category]')){
   let sectionCount=0;
   for(const entry of section.querySelectorAll('[data-library-entry]')){
    const matched=!query||entry.dataset.librarySearch.includes(query);
    entry.hidden=!matched;
    if(matched)sectionCount++;
   }
   section.hidden=Boolean(query)&&sectionCount===0;
   if(query&&sectionCount>0)section.open=true;
   if(!query)section.open=false;
   count+=sectionCount;
  }
  const note=document.getElementById('library-filter-count');
  if(note)note.textContent=query?count+' matching exercise'+(count===1?'':'s'):'Browse the categories below, or type to filter.';
 }
});
document.addEventListener('focusin',ev=>{
 if(ev.target.id==='exercise-entry-name'&&ev.target.value.trim())renderExerciseSuggestions(ev.target);
 if(ev.target.id==='template-exercise-name'&&ev.target.value.trim())renderTemplateExerciseSuggestions(ev.target);
 if(ev.target.id==='progress-exercise-search'&&ev.target.value.trim())
  renderProgressExerciseSuggestions(ev.target);
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
document.addEventListener('keydown',ev=>{
 if(ev.target.id!=='progress-exercise-search')return;
 const list=document.getElementById('progress-exercise-options');
 const options=Array.from(list?.querySelectorAll('[data-action="select-progress-exercise"]')||[]);
 const current=Number(list?.dataset.highlight??-1);
 if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&options.length){
  ev.preventDefault();
  const next=ev.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1);
  renderProgressExerciseSuggestions(ev.target,next);
 }else if(ev.key==='Escape'){
  ev.preventDefault();
  closeProgressExerciseSuggestions();
 }else if(ev.key==='Enter'&&!list?.hidden){
  ev.preventDefault();
  if(options.length)options[current>=0&&current<options.length?current:0].click();
 }
});
document.addEventListener('keydown',ev=>{
 if(ev.target.id!=='template-exercise-name')return;
 const list=document.getElementById('template-search-options');
 const options=Array.from(list?.querySelectorAll('[data-action="template-add-saved-exercise"]')||[]);
 const current=Number(list?.dataset.highlight??-1);
 if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&options.length){
  ev.preventDefault();
  const next=ev.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1);
  renderTemplateExerciseSuggestions(ev.target,next);
 }else if(ev.key==='Escape'){
  ev.preventDefault();closeTemplateExerciseSuggestions();
 }else if(ev.key==='Enter'&&current>=0&&current<options.length&&!list?.hidden){
  ev.preventDefault();options[current].click();
 }
});
document.addEventListener('click',ev=>{
 if(!ev.target.closest('.exercise-search-field'))closeExerciseSuggestions();
 if(!ev.target.closest('.progress-exercise-search-field'))closeProgressExerciseSuggestions();
 if(!ev.target.closest('.template-search-field'))closeTemplateExerciseSuggestions();
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
 if(!document.contains(card))return;
 if(card.matches?.('[data-progress-comparison]')){state.progressCompareOpen=card.open;return;}
 if(card.matches?.('[data-progress-target-editor]')){
  const wasOpen=state.progressTargetOpen;
  state.progressTargetOpen=card.open;
  if(wasOpen&&!card.open&&state.tab==='progress'&&!state.session)render().catch(console.error);
  return;
 }
 if(card.matches?.('[data-advanced-set]')){
  if(card.open)state.advancedOpen.add(card.dataset.advancedSet);
  else state.advancedOpen.delete(card.dataset.advancedSet);
  return;
 }
 if(card.matches?.('[data-exercise-more]')){
  if(card.open)state.moreOpen.add(card.dataset.exerciseMore);
  else state.moreOpen.delete(card.dataset.exerciseMore);
  return;
 }
 if(!card.matches?.('[data-exercise-card]'))return;
 if(card.open)state.expanded.add(card.dataset.exerciseCard);
 else state.expanded.delete(card.dataset.exerciseCard);
},true);
document.addEventListener('change',async ev=>{
 if(ev.target.dataset?.templateSets!==undefined&&state.templateDraft){
  const index=Number(ev.target.dataset.templateSets),count=validSetCount(ev.target.value);
  if(!state.templateDraft.exercises[index])return;
  if(count===null){
   toast('Enter a whole number from 1 to 20');
   ev.target.value=state.templateDraft.exercises[index].sets;
  }else{
   state.templateDraft.exercises[index].sets=count;
   state.templateDirty=true;
  }
  return;
 }
 if(ev.target.dataset?.progressTarget){
  const ex=state.exercises.find(ex=>ex.id===ev.target.dataset.progressTarget);
  if(!ex)return;
  const field=ev.target.dataset.targetField,limits={
   sets:[1,12,true],reps:[1,30,true],increment:[0.5,50,false],rpeCeiling:[1,10,false]
  };
  const constraint=limits[field];
  if(!constraint)return;
  const raw=ev.target.value.trim();
  if(raw!==''){
   const numeric=Number(raw);
   if(!Number.isFinite(numeric)||numeric<constraint[0]||numeric>constraint[1]||
      (constraint[2]&&!Number.isInteger(numeric))||
      (field==='rpeCeiling'&&numeric*2!==Math.round(numeric*2))){
    toast('Enter a valid target or leave the field blank');
    ev.target.value=ex.progressTarget?.[field]??'';
    return;
   }
  }
  ex.progressTarget={...(ex.progressTarget||{}),[field]:raw===''?'':Number(raw)};
  try{await put('exercises',ex);}catch(err){console.error(err);toast('Could not save target');return;}
  // Do not remove the focused field while editing multiple targets on iPhone.
  // The summary refreshes when the optional editor is closed.
  return;
 }
 if(ev.target.dataset?.warmupEntry){
  const entry=state.session?.exercises?.find(x=>x.id===ev.target.dataset.warmupEntry);
  const set=entry?.sets?.find(s=>s.id===ev.target.dataset.warmupSet);
  if(!set)return;
  set.warmup=ev.target.checked;
  scheduleSave();
  return;
 }
 if(ev.target.dataset?.musclePrimary){
  const ex=state.exercises.find(ex=>ex.id===ev.target.dataset.musclePrimary);
  if(!ex)return;
  const value=muscleLabel(ev.target.value);
  if(value&&!muscleChoices(state.exercises).includes(value))return;
  ex.muscle=value;
  await put('exercises',ex);
  await render();
  return;
 }
 if(ev.target.matches?.('[data-rest-minutes]')){
  const minutes=Number(ev.target.value);
  if(ev.target.value.trim()!==''&&Number.isFinite(minutes)&&minutes>=0.25&&minutes<=30){
   const exercise=state.session?.exercises?.find(x=>x.id===ev.target.dataset.exerciseId);
   if(exercise)setRestPreference(restKey(exercise),Math.round(minutes*60));
  }
  return;
 }
 const progress=ev.target.dataset?.progressControl;
 if(progress){
  const value=ev.target.value;
  if(progress==='range'&&['30','90','365','all'].includes(value))state.progressRange=value;
  else if(progress==='weightFilter')state.progressWeight=value;
   else if(progress==='compareType'&&['repsAtWeight','weightAtReps'].includes(value))state.progressCompareType=value;
   else if(progress==='repTarget'&&Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=30)state.progressRepTarget=value;
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
 if(form.dataset.form==='template-add-exercise'){
  if(!state.templateDraft)return;
  const name=String(data.get('exerciseName')||'').trim();
  if(!name)return;
  const master=await resolveExerciseInput(name);
  if(!master){document.getElementById('template-exercise-name')?.focus();return;}
  if(templateDraftAddExercise(master))await render();
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
  if(!wasSaved){master.muscle=muscleLabel(data.get('muscle'));master.equipment=String(data.get('equipment')||'');await put('exercises',master);}
  await render();toast(wasSaved?'Exercise already exists':'Exercise saved');
 }
});
$('#settings-button').addEventListener('click',async()=>{if(state.tab==='template-editor'&&state.templateDirty&&!confirm('Discard unsaved template changes?'))return;state.templateDraft=null;state.templateDirty=false;state.justFinishedSessionId='';await flushSave();state.session=null;state.report=false;state.tab='settings';state.libraryDetail=null;await render();});
(async()=>{try{try{await installStarterExercises();}catch(error){console.warn('Starter exercise catalog could not be installed',error);}try{await removeLegacySecondaryMuscles();}catch(error){console.warn('Exercise tag cleanup could not finish',error);}await linkExistingExercises();await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);}catch(err){console.error(err);main.innerHTML='<div class="card">Unable to open local workout storage. Check Safari storage permissions, then reload.</div>';}})();
setInterval(refreshRestTimers,500);
document.addEventListener('visibilitychange',refreshRestTimers);
window.addEventListener('pageshow',refreshRestTimers);
window.addEventListener('focus',refreshRestTimers);
