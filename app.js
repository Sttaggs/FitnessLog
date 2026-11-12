import {list, get, put, remove, replaceAll, newId} from './db.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');
const title = $('#page-title');
const escapeHtml = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const today = () => new Date().toLocaleDateString('en-CA');
const displayDate = (s) => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return isNaN(+d) ? s : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); };
const techniques = ['Standard','Superset','Triset','Giant set','Drop set','Mechanical drop set','Myo-reps','Ladder','Pyramid','Reverse pyramid','Rest-pause','Cluster','AMRAP','Isometric','Custom'];
const cardioKinds = ['Walking','Running','Treadmill','Stair stepper','Cycling','Stationary bike','Rowing','Elliptical','Rucking','Hiking','Swimming','HIIT','Other'];
const suggestions = ['Shoulder Press','Pec Fly','Lat Pulldown','Bent-Over Row','Dumbbell Lateral Raise','Biceps Curl','Triceps Pushdown','Squat','Leg Press','Romanian Deadlift','Plank'];
const state = {tab:'home', session:null, sessions:[], exercises:[], report:false, start:'', end:''};

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
async function refreshData() {state.sessions=(await list('sessions')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));state.exercises=await list('exercises');}
async function saveSession() {if(!state.session)return;state.session.updatedAt=new Date().toISOString();await put('sessions',state.session);await refreshData();}
async function render() {
 await refreshData();
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
 <div style="margin-top:10px" class="field-row">${numberField('Overall intensity / 10','session','intensity',s.intensity,'max="10"')}${numberField('Overall fatigue / 10','session','fatigue',s.fatigue,'max="10"')}</div>
 <div style="margin-top:10px">${memoField('Session notes','session','notes',s.notes)}</div></div>
 <div class="section-heading"><h2>Resistance exercises</h2><span class="pill">${s.exercises.length}</span></div>
 ${s.exercises.map((x,i)=>renderExercise(x,i)).join('')}
 <div class="card"><form data-form="add-exercise" class="stack"><div class="field"><label>Add any exercise</label><input name="exerciseName" list="exercise-suggestions" placeholder="e.g. Lateral Raise" required autocomplete="off"></div><datalist id="exercise-suggestions">${[...new Set([...suggestions,...state.exercises.map(x=>x.name)])].map(n=>`<option value="${e(n)}"></option>`).join('')}</datalist><button class="btn secondary wide" type="submit">＋ Add exercise</button></form></div>
 <div class="section-heading"><h2>Cardio and sauna</h2></div>${s.activities.map((x,i)=>renderActivity(x,i)).join('')}
 <div class="card"><div class="grid2">${button('＋ Cardio','add-cardio','secondary')}${button('＋ Sauna','add-sauna','secondary')}</div></div>
 <div class="card"><div class="stack">${button(s.status==='active'?'Finish workout':'Save changes','finish','wide')}${button('Close without finishing','close-workout','secondary wide')}</div><p class="helper">Changes save automatically on your device. You can edit this session later.</p></div>`;
}
function renderExercise(x,i) {
 const technique=selectField('Technique',`exercise:${x.id}`,'technique',x.technique||'Standard',techniques);
 return `<details class="detail"><summary><div class="row between"><div><div class="item-title">${e(x.name||'Exercise')}</div><small class="muted">${x.sets.length?x.sets.length+' set records · ':''}${e(x.technique||'Standard')}${x.intensity!==''&&x.intensity!=null?' · Effort '+e(x.intensity)+'/10':''}</small></div><span class="muted">Edit ▾</span></div></summary>
 <div class="detail-body"><div class="field-row">${textField('Exercise name',`exercise:${x.id}`,'name',x.name)}${technique}</div>
 <div class="field-row" style="margin-top:10px">${numberField('Intensity / 10',`exercise:${x.id}`,'intensity',x.intensity,'max="10"')}${numberField('Fatigue / 10',`exercise:${x.id}`,'fatigue',x.fatigue,'max="10"')}</div>
 <div style="margin-top:10px">${memoField('Notes / technique details',`exercise:${x.id}`,'notes',x.notes)}</div>
 <div class="section-heading"><h3>Optional set details</h3><span class="caption">Leave fields empty</span></div>
 ${x.sets.length?`<div class="set-grid helper"><span>Set</span><span>Weight (lb)</span><span>Reps</span><span></span></div>`:''}
 ${x.sets.map((set,j)=>`<div class="set-grid"><span>${j+1}</span><input aria-label="Set ${j+1} weight" type="number" min="0" step="any" data-scope="set:${x.id}:${set.id}" data-field="weight" value="${e(set.weight)}" placeholder="—"><input aria-label="Set ${j+1} reps" type="number" min="0" step="1" data-scope="set:${x.id}:${set.id}" data-field="reps" value="${e(set.reps)}" placeholder="—"><button class="btn danger set-delete" data-action="delete-set" data-exercise="${x.id}" data-id="${set.id}" aria-label="Remove set">×</button></div>`).join('')}
 <div class="row between"><button class="btn secondary small" data-action="add-set" data-id="${x.id}">＋ Add set</button><button class="btn danger small" data-action="delete-exercise" data-id="${x.id}">Remove exercise</button></div>
 <p class="helper">For advanced techniques, select the technique and record stages in notes. Detailed nested structures are planned.</p></div></details>`;
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
function renderHistory() {
 return `<div class="card"><h2>Export by date</h2><div class="field-row">${textField('From','filter','start',state.start||'','date')}${textField('Through','filter','end',state.end||'','date')}</div><div class="row wrap" style="margin-top:12px">${button('JSON backup','export-json','secondary small')}${button('CSV','export-csv','secondary small')}${button('PDF report','report','secondary small')}</div><p class="helper">Date filters apply to exports. A full JSON backup with no dates includes all records and your exercise library.</p></div>
 <div class="section-heading"><h2>Sessions</h2><span class="pill">${state.sessions.length}</span></div>
 ${state.sessions.length?state.sessions.map(s=>`<div class="item"><div class="row between"><div class="grow"><div class="item-title">${e(s.name)}</div><small>${displayDate(s.date)} · ${e(formatSummary(s))} · ${s.status==='active'?'Unfinished':'Finished'}</small></div><button class="btn small secondary" data-action="open" data-id="${s.id}">Edit</button></div></div>`).join(''):'<div class="card empty">No sessions have been recorded.</div>'}`;
}
function renderProgress() {
 const sessions=state.sessions.filter(s=>s.status==='finished');const start=new Date();start.setDate(start.getDate()-7);
 const recent=sessions.filter(s=>new Date(s.date+'T12:00:00')>=start);
 const ratings=sessions.map(s=>Number(s.intensity)).filter(n=>n>0);
 const count=sessions.reduce((acc,s)=>acc+s.exercises.length,0);
 const allExercises=new Map();
 for(const s of sessions)for(const x of s.exercises)allExercises.set(x.name,(allExercises.get(x.name)||0)+1);
 const top=[...allExercises.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
 return `<div class="grid2"><div class="stat"><span>Finished sessions</span><strong>${sessions.length}</strong></div><div class="stat"><span>Recent 7 days</span><strong>${recent.length}</strong></div><div class="stat"><span>Exercise entries</span><strong>${count}</strong></div><div class="stat"><span>Average effort</span><strong>${ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):'—'}</strong></div></div>
 <div class="section-heading"><h2>Most logged exercises</h2></div><div class="card">${top.length?top.map(([name,n])=>`<div style="margin-bottom:15px"><div class="row between"><span>${e(name)}</span><span class="helper">${n} sessions</span></div><div class="line" style="margin-top:7px"><span style="width:${Math.round(n/top[0][1]*100)}%"></span></div></div>`).join(''):'<div class="empty">Log workouts to see your activity trends.</div>'}<p class="helper">Exercise frequency is not equivalent to training volume or hypertrophy. Missing measurements are not treated as zero.</p></div>`;
}
function renderLibrary() {
 return `<div class="card"><h2>Custom exercise library</h2><form data-form="library" class="stack"><div class="field"><label>Name</label><input name="name" placeholder="Exercise name" required></div><div class="field-row"><div class="field"><label>Primary muscle</label><input name="muscle" placeholder="Shoulders"></div><div class="field"><label>Equipment</label><input name="equipment" placeholder="Dumbbells"></div></div><button class="btn wide" type="submit">Add exercise</button></form></div>
 <div class="section-heading"><h2>My exercises</h2><span class="pill">${state.exercises.length}</span></div>
 ${state.exercises.length?state.exercises.map(x=>`<div class="item"><div class="row between"><div class="grow"><div class="item-title">${e(x.name)}</div><small>${e(x.muscle||'Unassigned')} · ${e(x.equipment||'No equipment')}</small></div><button class="btn danger small" data-action="delete-library" data-id="${x.id}">Delete</button></div></div>`).join(''):'<div class="card empty">Custom exercises will appear here. Common movements are available as suggestions when logging.</div>'}`;
}
function renderSettings() {
 return `<div class="card"><h2>Data and privacy</h2><p>Your training records are stored locally in this browser using IndexedDB. They are not uploaded to GitHub or Cloudflare.</p><p class="notice">Deleting browser data or uninstalling the app can permanently remove records. Export a full backup regularly.</p><div class="stack" style="margin-top:15px">${button('Download full JSON backup','full-backup','wide')}${button('Restore from JSON backup','restore','secondary wide')}<input id="restore-file" type="file" accept="application/json,.json" hidden></div></div>
 <div class="card"><h2>About this version</h2><p class="muted">Initial release: flexible exercise logging, cardio, sauna, history, simple analytics, and exports. Advanced nested techniques, photo comparisons, body measurements, and timers are planned.</p></div>`;
}
function selected() {
 return state.sessions.filter(s=>(!state.start||s.date>=state.start)&&(!state.end||s.date<=state.end)).sort((a,b)=>a.date.localeCompare(b.date));
}
function renderReport() {
 const ss=selected();return `<div class="no-print row between" style="margin-bottom:12px">${button('← History','report-close','secondary small')}${button('Print / Save PDF','print','small')}</div><div class="report print-area"><h2>FitnessLog training report</h2><p>${e(state.start||'All dates')} through ${e(state.end||'present')}</p><p class="muted">${ss.length} workouts · Export created ${displayDate(today())}. Blank fields were not recorded.</p>${ss.map(s=>`<section style="margin:22px 0"><h3>${e(s.name)} — ${displayDate(s.date)}</h3><p>Effort: ${e(s.intensity||'Not recorded')} · Fatigue: ${e(s.fatigue||'Not recorded')}</p><p>${e(s.notes||'')}</p><table><thead><tr><th>Exercise</th><th>Technique</th><th>Set details</th><th>Effort</th></tr></thead><tbody>${s.exercises.map(x=>`<tr><td>${e(x.name)}${x.notes?' — '+e(x.notes):''}</td><td>${e(x.technique||'Standard')}</td><td>${x.sets.map(set=>[set.weight?set.weight+' lb':'',set.reps?set.reps+' reps':''].filter(Boolean).join(' × ')||'Set logged').join('; ')||'Not recorded'}</td><td>${e(x.intensity||'—')}</td></tr>`).join('')}</tbody></table>${s.activities.length?`<p>${s.activities.map(a=>`${e(a.type)}: ${e(a.mode)} ${a.duration?e(a.duration)+' min':''} ${a.distance?e(a.distance)+' km':''} ${a.notes?e(a.notes):''}`).join('; ')}</p>`:''}</section>`).join('')}</div>`;
}
function download(name, body, mime) {const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function csvValue(x) {return '"'+String(x??'').replace(/"/g,'""')+'"';}
function exportCsv() {
 const rows=[['date','workout','exercise','technique','set','weight_lb','reps','exercise_intensity','exercise_fatigue','session_intensity','session_fatigue','notes']];
 for(const s of selected()) {
 for(const x of s.exercises) {
 if(x.sets.length) x.sets.forEach((set,i)=>rows.push([s.date,s.name,x.name,x.technique,i+1,set.weight,set.reps,x.intensity,x.fatigue,s.intensity,s.fatigue,x.notes]));
 else rows.push([s.date,s.name,x.name,x.technique,'','','',x.intensity,x.fatigue,s.intensity,s.fatigue,x.notes]);
 }
 for(const a of s.activities) rows.push([s.date,s.name,a.type+': '+a.mode,'activity','','',a.duration,a.intensity,'',s.intensity,s.fatigue,a.notes]);
 }
 download('fitnesslog-'+today()+'.csv',rows.map(r=>r.map(csvValue).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
async function restoreBackup(file) {
 const parsed=JSON.parse(await file.text());
 if(parsed.app!=='FitnessLog'||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.exercises))throw Error('Unsupported backup format');
 if(!confirm('Restore this backup? This will REPLACE all workouts and custom exercises on this device.'))return;
 await replaceAll('sessions',parsed.sessions);await replaceAll('exercises',parsed.exercises);state.session=null;state.tab='home';await render();toast('Backup restored');
}
async function action(name,el) {
 const s=state.session;
 if(name==='start') {
  const active=state.sessions.find(x=>x.status==='active');
  state.session=active||{id:newId(),name:'Workout',date:today(),status:'active',createdAt:new Date().toISOString(),intensity:'',fatigue:'',notes:'',exercises:[],activities:[]};
  await saveSession();return render();
 }
 if(name==='open') {state.session=await get('sessions',el.dataset.id);return render();}
 if(name==='close-workout'){state.session=null;state.tab='home';return render();}
 if(name==='history'){state.tab='history';return render();}
 if(name==='finish'){s.status='finished';await saveSession();state.session=null;state.tab='history';toast('Workout saved');return render();}
 if(name==='add-set'){const x=s.exercises.find(x=>x.id===el.dataset.id);const prev=x.sets.at(-1);x.sets.push({id:newId(),weight:prev?.weight||'',reps:prev?.reps||''});await saveSession();return render();}
 if(name==='delete-set'){const x=s.exercises.find(x=>x.id===el.dataset.exercise);x.sets=x.sets.filter(y=>y.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-exercise'){if(!confirm('Remove exercise?'))return;s.exercises=s.exercises.filter(x=>x.id!==el.dataset.id);await saveSession();return render();}
 if(name==='add-cardio'||name==='add-sauna'){const type=name==='add-cardio'?'cardio':'sauna';s.activities.push({id:newId(),type,mode:type==='cardio'?'Walking':'Traditional',duration:'',distance:'',level:'',temperature:'',intensity:'',notes:''});await saveSession();return render();}
 if(name==='delete-activity'){s.activities=s.activities.filter(a=>a.id!==el.dataset.id);await saveSession();return render();}
 if(name==='delete-library'){if(!confirm('Delete this custom exercise? Historical workouts will remain.'))return;await remove('exercises',el.dataset.id);return render();}
 if(name==='export-json'||name==='full-backup'){const full=name==='full-backup'||(!state.start&&!state.end);download('fitnesslog-backup-'+today()+'.json',JSON.stringify({app:'FitnessLog',version:1,createdAt:new Date().toISOString(),sessions:full?state.sessions:selected(),exercises:state.exercises},null,2),'application/json');return toast('JSON file downloaded');}
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
 const nav=ev.target.closest('[data-tab]');if(nav){state.tab=nav.dataset.tab;state.report=false;state.session=null;await render();return;}
 const el=ev.target.closest('[data-action]');if(!el)return;
 try{await action(el.dataset.action,el);}catch(error){console.error(error);toast('Unable to complete action');}
});
document.addEventListener('change',async ev=>{
 if(ev.target.id==='restore-file'){const f=ev.target.files?.[0];if(f)try{await restoreBackup(f);}catch(err){console.error(err);toast('Invalid or unreadable backup');}return;}
 const {scope,field}=ev.target.dataset;if(!scope||!field)return;
 const target=findScope(scope);if(!target)return;
 const value=ev.target.value;
 if(ev.target.type==='number'&&value!==''&&!Number.isFinite(Number(value)))return;
 if(field==='intensity'||field==='fatigue'){if(value!==''&&(Number(value)<0||Number(value)>10)){toast('Rating must be 0–10');return;}}
 target[field]=value;
 if(scope==='filter')return;
 try{await saveSession();}catch(err){console.error(err);toast('Could not save change');}
});
document.addEventListener('submit',async ev=>{
 const form=ev.target.closest('[data-form]');if(!form)return;ev.preventDefault();
 const data=new FormData(form);
 if(form.dataset.form==='add-exercise'){
  const name=String(data.get('exerciseName')||'').trim();if(!name)return;
  state.session.exercises.push({id:newId(),name,technique:'Standard',intensity:'',fatigue:'',notes:'',sets:[]});await saveSession();await render();return;
 }
 if(form.dataset.form==='library'){
  const name=String(data.get('name')||'').trim();if(!name)return;
  await put('exercises',{id:newId(),name,muscle:String(data.get('muscle')||''),equipment:String(data.get('equipment')||'')});await render();toast('Exercise saved');
 }
});
$('#settings-button').addEventListener('click',()=>{state.session=null;state.report=false;state.tab='settings';render();});
(async()=>{try{await render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);}catch(err){console.error(err);main.innerHTML='<div class="card">Unable to open local workout storage. Check Safari storage permissions, then reload.</div>';}})();
