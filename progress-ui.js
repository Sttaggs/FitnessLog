import {exerciseHistory,exerciseWeights,performanceValue,trendPoints,trendSvg,numericValue} from './analytics.js';
import {muscleSetSummary} from './muscle-utils.js';

const hasData=set => Boolean(set && ['weight','reps','rpe'].some(key=>set[key]!==''&&set[key]!==undefined&&set[key]!==null));
const formatNumber=value => value===null||value===undefined?'—':String(value);
const viewNames=['Front','Side','Back'];
const metricNames={weight:'Weight',reps:'Repetitions',rpe:'Set RPE'};
const metricDescriptions={
  weight:'Highest recorded weight in each completed workout. A heavier set with fewer repetitions is not necessarily a performance improvement.',
  reps:'Highest number of recorded repetitions in a set. Use the weight filter to compare repetitions at the same load.',
  rpe:'Average of the recorded set RPE values in each completed workout. Lower RPE at comparable weight and reps may indicate improvement.'
};
const dateString=(date)=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');

export function renderProgressView({state,e,displayDate,photoUrl}) {
 const activeIds=new Set(state.sessions.filter(s=>s.status==='finished').flatMap(s=>(s.exercises||[]).map(x=>x.exerciseId).filter(Boolean)));
 const available=state.exercises.slice().sort((a,b)=>Number(activeIds.has(b.id))-Number(activeIds.has(a.id))||a.name.localeCompare(b.name));
 const chosen=available.find(x=>x.id===state.progressExercise)||available[0];
 const history=exerciseHistory(state.sessions,chosen?.id);
 const metric=metricNames[state.progressMetric]?state.progressMetric:'weight';
 const weights=exerciseWeights(history);
 const weightFilter=weights.some(x=>String(x)===String(state.progressWeight))?String(state.progressWeight):'all';
 const points=trendPoints(history,metric,state.progressRange,new Date(),weightFilter);
 const latest=[...history].reverse();
 const lastWeight=latest.map(s=>performanceValue(s,'weight')).find(v=>v!==null);
 const lastReps=latest.map(s=>performanceValue(s,'reps')).find(v=>v!==null);
 const lastRpe=latest.map(s=>performanceValue(s,'rpe')).find(v=>v!==null);
 const bestWeight=history.map(s=>performanceValue(s,'weight')).filter(v=>v!==null);
 const stat=(name,value,unit='')=>'<div class="progress-stat"><span>'+e(name)+'</span><strong>'+e(formatNumber(value))+'</strong>'+(unit?'<small>'+e(unit)+'</small>':'')+'</div>';
 const metricButton=(key)=>'<button type="button" class="'+(metric===key?'active':'')+'" data-action="progress-metric" data-metric="'+key+'" aria-pressed="'+(metric===key)+'">'+metricNames[key]+'</button>';
 const rangeOptions=[['30','30 days'],['90','90 days'],['365','1 year'],['all','All time']];
 const metricDisplay=metric==='weight'?'lb':metric==='reps'?'reps':'RPE';
 const change=points.length>1?Math.round((points.at(-1).value-points[0].value)*10)/10:null;
 const note=change===null?'':('<div class="chart-change">Change in displayed metric: '+(change>0?'+':'')+e(change)+' '+metricDisplay+' from first to latest measured session in this range</div>');
 const detail=history.slice().reverse().slice(0,20).map(record=>
  '<details class="progress-session"><summary><span>'+e(displayDate(record.date))+' · '+e(record.sessionName)+'</span><span class="progress-session-count">'+record.sets.filter(hasData).length+' logged sets</span></summary>'+
  '<div class="progress-session-body">'+
  (record.sets.length?'<div class="progress-session-table"><div class="progress-session-head"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span></div>'+
   record.sets.map((set,index)=>'<div class="progress-session-row"><span>'+(index+1)+'</span><span>'+e(formatNumber(set.weight===''?null:set.weight))+'</span><span>'+e(formatNumber(set.reps===''?null:set.reps))+'</span><span>'+e(formatNumber(set.rpe===''?null:set.rpe))+'</span></div>').join('')+'</div>':'<p class="helper">No set measurements were recorded.</p>')+
  (record.notes?'<p class="helper">Notes: '+e(record.notes)+'</p>':'')+
  '<button class="btn secondary small" data-action="open" data-id="'+e(record.sessionId)+'">Edit workout</button></div></details>'
 ).join('');
 return '<section class="progress-analytics-section">'+
  '<div class="section-heading"><h2>Exercise Analytics</h2></div>'+
  '<div class="card progress-card"><p class="helper">Select an exercise to examine its performance history. Only completed workouts and values you actually entered are analyzed.</p>'+
  '<div class="field"><label for="progress-exercise">Exercise</label><select id="progress-exercise" data-progress-control="exercise">'+
  (available.length?available.map(ex=>'<option value="'+e(ex.id)+'" '+(ex.id===chosen?.id?'selected':'')+'>'+e(ex.name)+'</option>').join(''):'<option value="">No exercises saved</option>')+
  '</select></div>'+
  (chosen?'<div class="progress-summary">'+
    stat('Sessions',history.length)+stat('Best weight',bestWeight.length?Math.max(...bestWeight):null,'lb')+
    stat('Recent max reps',lastReps,'reps')+stat('Recent avg RPE',lastRpe)+'</div>'+
    '<div class="progress-metric-toggle" role="group" aria-label="Exercise metric">'+['weight','reps','rpe'].map(metricButton).join('')+'</div>'+
    '<div class="progress-controls"><label class="field">Date range<select data-progress-control="range">'+rangeOptions.map(([value,label])=>'<option value="'+value+'" '+(value===state.progressRange?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
    (metric==='reps'&&weights.length?'<label class="field">At weight<select data-progress-control="weightFilter"><option value="all">Any weight</option>'+weights.map(w=>'<option value="'+w+'" '+(weightFilter===String(w)?'selected':'')+'>'+w+' lb</option>').join('')+'</select></label>':'')+'</div>'+
    '<div class="progress-chart">'+(points.length?trendSvg(points,metric):'<div class="empty">No recorded '+e(metricNames[metric].toLowerCase())+' in the selected period.</div>')+'</div>'+
    (points.length?'<div class="progress-chart-note">'+e(points.length)+' measured session'+(points.length===1?'':'s')+' · '+e(metricDescriptions[metric])+'</div>'+note:'<p class="helper">'+e(metricDescriptions[metric])+'</p>')+
    '<div class="section-heading"><h3>Recorded sessions</h3><span class="pill">'+history.length+'</span></div>'+
    (history.length?'<div class="progress-session-list">'+detail+'</div><p class="helper">Showing up to 20 most recent completed sessions. Missing measurements are displayed as dashes.</p>':'<p class="helper">Finish a workout containing this exercise to begin tracking progress.</p>'):
    '<div class="empty">Record an exercise in a workout to begin seeing analytics.</div>')+
  '</div></section>'+renderWorkoutOverview({state,e})+renderWeeklyMuscleSets({state,e})+renderPhotoSection({state,e,displayDate,photoUrl});
}

function renderWeeklyMuscleSets({state,e}) {
 const summary=muscleSetSummary(state.sessions,state.exercises);
 const rows=summary.rows;
 const table=rows.length?
  '<div class="muscle-week-list"><div class="muscle-week-heading"><span>Muscle group</span><span>This week</span><span>Last week</span></div>'+
  rows.map(row=>'<div class="muscle-week-row"><span>'+e(row.muscle)+'</span><strong>'+row.current+'</strong><span>'+row.previous+'</span></div>').join('')+'</div>':
  '<p class="helper">No sets with recorded repetitions were assigned to muscle groups in either week.</p>';
 return '<details class="card muscle-week-overview"><summary>Weekly muscle sets <span class="helper">Optional</span></summary>'+
  '<p class="helper">Weekly totals use Monday–Sunday calendar weeks. Each set with recorded repetitions greater than zero counts once toward its exercise’s primary muscle. Secondary tags are not counted. Warm-up sets are included unless they are recorded separately.</p>'+
  table+
  '<p class="helper">Changing an exercise’s primary muscle also updates the classification of its historical sets. These are set counts, not weight × reps volume.</p></details>';
}
function renderWorkoutOverview({state,e}) {
 const completed=state.sessions.filter(s=>s.status==='finished');
 const current=new Date(), dateThreshold=(days)=>{
  const cutoff=new Date(current.getFullYear(),current.getMonth(),current.getDate());
  cutoff.setDate(cutoff.getDate()-(days-1));
  return cutoff;
 };
 const since=days=>completed.filter(s=>s.date&&new Date(s.date+'T12:00:00')>=dateThreshold(days)).length;
 const average=key=>{
  const valid=completed.map(s=>numericValue(s[key])).filter(v=>v!==null&&v>=1&&v<=10);
  return valid.length?String(Math.round(valid.reduce((a,b)=>a+b,0)/valid.length*10)/10):'—';
 };
 const cell=(label,value)=>'<div class="progress-stat"><span>'+e(label)+'</span><strong>'+e(value)+'</strong></div>';
 return '<details class="card progress-overview"><summary>Workout overview <span class="helper">Optional</span></summary>'+
 '<div class="progress-summary">'+cell('Completed workouts',completed.length)+cell('Last 7 days',since(7))+
 cell('Last 30 days',since(30))+cell('Avg intensity',average('intensity'))+
 cell('Avg fatigue',average('fatigue'))+'</div>'+
 '<p class="helper">Intensity and fatigue are overall workout ratings. Missing ratings are excluded from averages.</p></details>';
}

function renderPhotoSection({state,e,displayDate,photoUrl}) {
 const all=state.photos||[];
 const type=viewNames.includes(state.photoView)?state.photoView:'Front';
 const choices=all.filter(p=>p.view===type).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||''));
 const first=choices.find(p=>p.id===state.photoA)||choices[0];
 const second=choices.find(p=>p.id===state.photoB)||choices.at(-1);
 const options=choices.map(photo=>'<option value="'+e(photo.id)+'">'+e(displayDate(photo.date))+'</option>').join('');
 const choiceSelect=(label,field,chosen)=>'<label class="field">'+label+'<select data-progress-control="'+field+'">'+
  choices.map(photo=>'<option value="'+e(photo.id)+'" '+(photo.id===chosen?.id?'selected':'')+'>'+e(displayDate(photo.date))+'</option>').join('')+'</select></label>';
 const image=(photo,label)=>'<img src="'+e(photoUrl(photo))+'" alt="'+e(label+' '+photo.view+' progress photograph from '+displayDate(photo.date))+'" loading="lazy">';
 const imageBox=(photo,label)=>'<figure class="photo-comparison-item">'+image(photo,label)+'<figcaption>'+e(label+' · '+displayDate(photo.date))+'</figcaption></figure>';
 const canCompare=choices.length>1&&first&&second&&first.id!==second.id;
 const overlay=canCompare&&state.photoMode==='overlay';
 return '<section class="progress-photo-section"><div class="section-heading"><h2>Progress Photos</h2><span class="pill">'+all.length+' saved</span></div>'+
  '<div class="card progress-card"><p class="helper">Photos are stored privately in this browser on this device. They are not uploaded to GitHub or Cloudflare. Standard workout backups exclude photos.</p>'+
  '<details class="photo-add"><summary>＋ Add progress photo</summary>'+
  '<form data-form="photo-upload" class="stack photo-upload-form">'+
  '<div class="field"><label for="progress-photo-file">Choose photo</label><input id="progress-photo-file" type="file" name="photoFile" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required></div>'+
  '<div class="field-row"><div class="field"><label>Date</label><input name="photoDate" type="date" value="'+e(dateString(new Date()))+'" required></div>'+
  '<div class="field"><label>View</label><select name="photoView">'+viewNames.map(v=>'<option>'+v+'</option>').join('')+'</select></div></div>'+
  '<button type="submit" class="btn wide">Save photo on this device</button>'+
  '<p class="helper">Photos are resized before storage. Keeping regular photo-inclusive backups is recommended.</p></form></details>'+
  (all.length?'<div class="photo-comparison-controls"><label class="field">Compare view<select data-progress-control="photoView">'+viewNames.map(v=>'<option '+(v===type?'selected':'')+'>'+v+'</option>').join('')+'</select></label></div>'+
   (choices.length>1?'<div class="photo-compare-selectors">'+choiceSelect('Before','photoA',first)+choiceSelect('After','photoB',second)+'</div>'+
    '<div class="photo-mode-toggle" role="group" aria-label="Photo comparison mode">'+
    '<button type="button" data-action="photo-mode" data-mode="side" class="'+(!overlay?'active':'')+'" aria-pressed="'+(!overlay)+'">Side by side</button>'+
    '<button type="button" data-action="photo-mode" data-mode="overlay" class="'+(overlay?'active':'')+'" aria-pressed="'+overlay+'">Overlay</button></div>'+
    (canCompare?(overlay?
      '<div class="photo-overlay-frame">'+image(first,'Before')+'<div class="photo-overlay-after" id="photo-overlay-after" style="clip-path:inset(0 '+(100-state.overlayPercent)+'% 0 0)">'+image(second,'After')+'</div></div>'+
      '<label class="photo-overlay-slider">Reveal after image <input id="photo-overlay-range" type="range" min="0" max="100" value="'+state.overlayPercent+'"></label>':
      '<div class="photo-compare-pair">'+imageBox(first,'Before')+imageBox(second,'After')+'</div>'):
      '<p class="helper">Choose two different photos to compare.</p>')+
    '<p class="helper">Comparison works best when the framing, lighting, and pose are similar.</p>':
    '<div class="empty">Add two '+e(type.toLowerCase())+' photos on different dates to compare progress.</div>'):
   '<div class="empty">Select Add progress photo to start your private photo history.</div>')+
  '<details class="photo-gallery"><summary>Saved photo library ('+all.length+')</summary>'+
  (all.length?'<div class="photo-gallery-grid">'+all.map(photo=>'<div class="photo-gallery-item">'+image(photo,'Saved')+
    '<div class="photo-gallery-meta"><span>'+e(displayDate(photo.date))+' · '+e(photo.view)+'</span>'+
    '<button class="btn danger small" type="button" data-action="delete-photo" data-id="'+e(photo.id)+'" aria-label="Delete progress photo from '+e(displayDate(photo.date))+'">Delete</button></div></div>').join('')+'</div>':'<p class="helper">No photos saved.</p>')+
  '</details></div></section>';
}
