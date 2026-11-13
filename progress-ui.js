import {trendSvg,numericValue} from './analytics.js';
import {muscleSetSummary} from './muscle-utils.js';
import {strengthSessions,strengthChartPoints,progressionTrend,availableWeights,comparisonPoints,latestWorkingPerformance,comparableEffort,normalizedTarget,nextSessionAdvice} from './progression.js';

const hasData=set => Boolean(set && ['weight','reps','rpe'].some(key=>set[key]!==''&&set[key]!==undefined&&set[key]!==null));
const formatNumber=value => value===null||value===undefined?'—':String(value);
const viewNames=['Front','Side','Back'];
const dateString=(date)=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const numberLabel=(value,digits=1)=>Number.isFinite(value)?String(Number(value.toFixed(digits))):'—';
const signed=(value)=>value===null||value===undefined?'—':(value>0?'+':'')+numberLabel(value)+'%';
const rangeOptions=[['30','30 days'],['90','90 days'],['365','1 year'],['all','All time']];
const labelDate=(date,displayDate)=>date?displayDate(date):'';

export function renderProgressView({state,e,displayDate,photoUrl}) {
 const chosen=['exercises','muscles','photos'].includes(state.progressSection)?state.progressSection:'exercises';
 const tabs='<nav class="progress-section-nav" aria-label="Progress sections">'+
  [['exercises','Exercises'],['muscles','Muscles'],['photos','Photos']].map(([id,label])=>
   '<button type="button" data-action="progress-section" data-section="'+id+'" class="'+(chosen===id?'active':'')+'" aria-current="'+(chosen===id?'page':'false')+'">'+label+'</button>').join('')+'</nav>';
 if(chosen==='photos')return tabs+renderPhotoSection({state,e,displayDate,photoUrl});
 if(chosen==='muscles')return tabs+renderWeeklyMuscleSets({state,e,inline:true})+renderWorkoutOverview({state,e});
 return tabs+renderExerciseProgress({state,e,displayDate});
}

function renderExerciseProgress({state,e,displayDate}){
 const dates=new Map();
 for(const session of state.sessions.filter(s=>s.status==='finished')){
  for(const entry of session.exercises||[]){
   if(entry.exerciseId&&(!dates.has(entry.exerciseId)||session.date>dates.get(entry.exerciseId)))
    dates.set(entry.exerciseId,session.date);
  }
 }
 const available=state.exercises.slice().sort((a,b)=>
  String(dates.get(b.id)||'').localeCompare(String(dates.get(a.id)||''))||a.name.localeCompare(b.name));
 const chosen=available.find(ex=>ex.id===state.progressExercise)||available[0];
 const select='<label class="field progress-exercise-picker">Exercise'+
  '<select id="progress-exercise" data-progress-control="exercise" aria-label="Select exercise">'+
  (available.length?available.map(ex=>'<option value="'+e(ex.id)+'" '+(ex.id===chosen?.id?'selected':'')+'>'+e(ex.name)+'</option>').join(''):'<option value="">No exercises saved</option>')+
  '</select></label>';
 if(!chosen)return '<section class="card progress-main-card">'+select+
  '<p class="helper">Log an exercise and finish a workout to begin tracking progress.</p></section>';
 const history=[];
 for(const session of state.sessions){
  if(session.status!=='finished'||!session.date)continue;
  const entries=(session.exercises||[]).filter(entry=>entry.exerciseId===chosen.id);
  if(!entries.length)continue;
  history.push({
   sessionId:session.id,date:session.date,sessionName:session.name||'Workout',createdAt:session.createdAt||'',
   sets:entries.flatMap(entry=>entry.sets||[]),notes:entries.map(entry=>entry.notes).filter(Boolean).join(' · ')
  });
 }
 history.sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
 const trend=progressionTrend(history);
 const latestRecord=history.at(-1)||null;
 const latestSet=latestWorkingPerformance(latestRecord);
 const rpeComparison=comparableEffort(history);
 const advice=nextSessionAdvice(latestRecord,chosen);
 const currentEstimate=trend.latest;
 const series=strengthChartPoints(history,state.progressRange,new Date());
 const allMeasurements=strengthSessions(history);
 const target=normalizedTarget(chosen);
 const hasTarget=Boolean(target.sets&&target.reps&&target.increment);
 const controls='<label class="field progress-range">Period<select data-progress-control="range" aria-label="Chart time range">'+
   rangeOptions.map(([value,label])=>'<option value="'+value+'" '+(value===state.progressRange?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
 const latestLabel=latestSet?numberLabel(latestSet.weight,2)+' lb × '+latestSet.reps+' reps':'No complete weight-and-rep set';
 const rpeLabel=latestSet?.rpe!==null&&latestSet?.rpe!==undefined?' · RPE '+latestSet.rpe:'';
 const statusNote=trend.change!==null?('Last 3 vs previous 3 measured sessions: '+signed(trend.change)+'.'):
  trend.count>1?'Latest estimated max vs previous: '+signed(trend.sessionChange)+'.':'Complete another eligible session to compare estimates.';
 const strengthNote=allMeasurements.length>0?'Based on the strongest eligible set (1–10 reps) from each completed session. The equation estimates strength; it does not measure a tested 1RM.':'An estimate needs recorded weight and 1–10 repetitions in the same set.';
 const preview=latestRecord?'<div class="progress-kpi"><span>Best set · latest workout</span><strong>'+e(latestLabel)+'</strong>'+
   (rpeLabel?'<small>'+e(rpeLabel.replace(/^ · /,''))+'</small>':'')+'</div>':
   '<div class="progress-kpi"><span>Best set · latest workout</span><strong>—</strong></div>';
 const strength='<div class="progress-kpi"><span>Estimated 1RM</span><strong>'+
  (currentEstimate?numberLabel(currentEstimate.value)+' lb':'—')+'</strong>'+
  (currentEstimate?'<small>'+e(labelDate(currentEstimate.date,displayDate))+'</small>':'')+'</div>';
 const summary='<section class="card progress-main-card">'+select+
  '<div class="progress-trend-status" data-status="'+e(trend.status)+'" role="status"><strong>'+e(trend.label)+'</strong>'+
   '<span>'+e(statusNote)+'</span></div>'+
  '<div class="progress-kpis">'+preview+strength+'</div>'+
  (hasTarget?'<div class="progress-next"><span class="progress-overline">NEXT WORKOUT</span><strong>'+e(advice.label)+'</strong>'+
    '<p>'+e(advice.description)+'</p></div>':
    '<p class="progress-target-hint">Optional exercise targets can provide a suggested next step.</p>')+
  '<details class="progress-target-editor" data-progress-target-editor '+(state.progressTargetOpen?'open':'')+'>'+
   '<summary>'+e(hasTarget?'Edit exercise targets':'Set an exercise target')+'</summary>'+
   '<div class="progress-target-editor-body">'+targetFields(chosen,e)+
    '<p class="helper">Targets guide optional suggestions and never change your recorded sets. Set an RPE ceiling only if you want effort checked before increasing load.</p></div></details>'+
  '</section>';
 const chart='<section class="card progress-chart-card">'+
  '<div class="progress-chart-heading"><h2>Estimated strength</h2>'+controls+'</div>'+
  '<div class="progress-chart">'+(series.length?trendSvg(series,'weight'):
   '<div class="empty">No eligible estimates in this period.</div>')+'</div>'+
  '<p class="helper">'+e(strengthNote)+'</p>'+
  '<details class="progress-method"><summary>How the trend is calculated</summary>'+
   '<p class="helper">Estimated 1RM uses the Epley equation with recorded weight and 1–10 reps. Warm-ups are excluded when marked. The status compares the median estimates of the latest three measured sessions with the prior three; a change greater than 3% is highlighted as improvement or possible regression. This is a practical display threshold, not a diagnostic cutoff. RPE is shown separately and does not alter the estimate. Far-from-failure sets may underestimate capacity.</p></details></section>';
 const effort=rpeComparison?
  '<p class="helper">At '+e(numberLabel(rpeComparison.weight,2))+' lb × '+e(rpeComparison.reps)+
  ' reps, recorded RPE changed from '+e(rpeComparison.previous)+' to '+e(rpeComparison.current)+'. RPE provides context; it does not change estimated strength.</p>':'';
 const more=renderOtherComparisons({state,e,history})+
  '<details class="progress-history-disclosure"><summary>Recorded sessions ('+history.length+')</summary>'+
  (history.length?'<div class="progress-session-list">'+history.slice().reverse().slice(0,20).map(record=>
   '<details class="progress-session"><summary><span>'+e(displayDate(record.date))+' · '+e(record.sessionName)+'</span>'+
   '<span class="progress-session-count">'+record.sets.filter(hasData).length+' logged sets</span></summary>'+
   '<div class="progress-session-body"><div class="progress-session-table"><div class="progress-session-head"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span></div>'+
   record.sets.map((set,index)=>'<div class="progress-session-row"><span>'+(index+1)+(set.warmup===true?' W':'')+
     '</span><span>'+e(formatNumber(set.weight===''?null:set.weight))+'</span><span>'+
     e(formatNumber(set.reps===''?null:set.reps))+'</span><span>'+e(formatNumber(set.rpe===''?null:set.rpe))+'</span></div>').join('')+'</div>'+
   (record.notes?'<p class="helper">Notes: '+e(record.notes)+'</p>':'')+
   '<button class="btn secondary small" data-action="open" data-id="'+e(record.sessionId)+'">Edit workout</button></div></details>'
  ).join('')+'</div><p class="helper">Showing up to 20 recent completed sessions. W = warm-up. Empty measurements stay blank.</p>':
  '<p class="helper">No completed workouts recorded for this exercise.</p>')+
  '</details>';
 return summary+chart+(effort?'<div class="progress-effort-note">'+effort+'</div>':'')+more;
}

function targetFields(ex,e){
 const target=ex.progressTarget||{};
 const control=(field,label,min,max,step='1')=>'<label class="field">'+label+
  '<input type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+
  '" data-progress-target="'+e(ex.id)+'" data-target-field="'+field+'" value="'+e(target[field]??'')+'" placeholder="—"></label>';
 return '<div class="progress-target-grid">'+control('sets','Working sets',1,12)+
  control('reps','Reps per set',1,30)+control('increment','Increase by (lb)',0.5,50,'any')+
  control('rpeCeiling','RPE ceiling (optional)',1,10,'0.5')+'</div>';
}
function renderOtherComparisons({state,e,history}){
 const weights=availableWeights(history);
 const type=state.progressCompareType==='weightAtReps'?'weightAtReps':'repsAtWeight';
 const preferred=Number(state.progressWeight);
 const chosenWeight=weights.includes(preferred)?preferred:weights.at(-1);
 const rep=Number(state.progressRepTarget)||5;
 const value=type==='weightAtReps'?rep:chosenWeight;
 const points=Number.isFinite(value)?comparisonPoints(history,type,value,state.progressRange,new Date()):[];
 const isWeight=type==='weightAtReps';
 return '<details class="progress-more-analysis" data-progress-comparison '+(state.progressCompareOpen?'open':'')+'>'+
  '<summary>Compare performance another way</summary>'+
  '<div class="progress-comparison-body"><div class="field-row">'+
    '<label class="field">Comparison<select data-progress-control="compareType">'+
      '<option value="repsAtWeight" '+(!isWeight?'selected':'')+'>Reps at a fixed weight</option>'+
      '<option value="weightAtReps" '+(isWeight?'selected':'')+'>Heaviest weight at a rep target</option></select></label>'+
    (isWeight?'<label class="field">At least<select data-progress-control="repTarget">'+
      [1,3,5,6,8,10,12,15,20,30].map(n=>'<option value="'+n+'" '+(rep===n?'selected':'')+'>'+n+' reps</option>').join('')+'</select></label>':
      '<label class="field">At weight<select data-progress-control="weightFilter">'+
       (weights.length?weights.map(n=>'<option value="'+e(n)+'" '+(n===chosenWeight?'selected':'')+'>'+e(n)+' lb</option>').join(''):
        '<option value="">No recorded loads</option>')+'</select></label>')+
   '</div><div class="progress-chart">'+(points.length?trendSvg(points,isWeight?'weight':'reps'):
    '<div class="empty">No matching completed sets in this period.</div>')+'</div>'+
   '<p class="helper">'+e(isWeight?'Heaviest load for at least the chosen reps; reps at higher loads are not converted.':'Best recorded reps at exactly the selected weight. Warm-up sets are excluded.')+'</p></div></details>';
}

function renderWeeklyMuscleSets({state,e,inline=false}) {
 const summary=muscleSetSummary(state.sessions,state.exercises);
 const rows=summary.rows;
 const table=rows.length?
  '<div class="muscle-week-list"><div class="muscle-week-heading"><span>Muscle group</span><span>This week</span><span>Last week</span></div>'+
  rows.map(row=>'<div class="muscle-week-row"><span>'+e(row.muscle)+'</span><strong>'+row.current+'</strong><span>'+row.previous+'</span></div>').join('')+'</div>':
  '<p class="helper">No sets with recorded repetitions were assigned to muscle groups in either week.</p>';
 return (inline?'<section class="card muscle-week-overview"><h2>Weekly muscle sets</h2>':'<details class="card muscle-week-overview"><summary>Weekly muscle sets <span class="helper">Optional</span></summary>')+
  '<p class="helper">Weekly totals use Monday–Sunday calendar weeks. Each set with recorded repetitions greater than zero counts once toward its exercise’s assigned muscle group. Mark warm-up sets in the workout More menu to exclude them; older unmarked sets are treated as working sets.</p>'+
  table+
  '<p class="helper">Changing an exercise’s muscle group also updates the classification of its historical sets. These are set counts, not weight × reps volume.</p>'+(inline?'</section>':'</details>');
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
