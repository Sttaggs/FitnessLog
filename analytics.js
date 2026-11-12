// Pure exercise-specific analysis. Missing measurements are not counted as zero.
export function numericValue(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function exerciseHistory(sessions, exerciseId) {
  const results = [];
  if (!exerciseId) return results;
  for (const session of sessions) {
    if (session.status !== 'finished' || !session.date) continue;
    const entries = (session.exercises || []).filter(entry => entry.exerciseId === exerciseId);
    if (!entries.length) continue;
    results.push({
      sessionId: session.id,
      date: session.date,
      sessionName: session.name || 'Workout',
      createdAt: session.createdAt || '',
      sets: entries.flatMap(entry => entry.sets || []),
      notes: entries.map(entry => entry.notes).filter(Boolean).join(' · ')
    });
  }
  return results.sort((a,b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function exerciseWeights(history) {
  return [...new Set(history.flatMap(session => session.sets.map(set => numericValue(set.weight)))
    .filter(value => value !== null && value >= 0))]
    .sort((a,b) => a-b);
}

export function performanceValue(session, metric, weightFilter='all') {
  const sets = session.sets || [];
  const values = [];
  for (const set of sets) {
    if (metric === 'reps' && weightFilter !== 'all' && numericValue(set.weight) !== Number(weightFilter)) continue;
    const v = numericValue(set[metric === 'weight' ? 'weight' : metric]);
    if (v === null) continue;
    if ((metric === 'weight' || metric === 'reps') && v < 0) continue;
    if (metric === 'rpe' && (v < 1 || v > 10)) continue;
    values.push(v);
  }
  if (!values.length) return null;
  if (metric === 'rpe') return Math.round((values.reduce((a,b) => a+b,0) / values.length) * 10)/10;
  return Math.max(...values);
}

export function trendPoints(history, metric='weight', range='90', referenceDate=new Date(), weightFilter='all') {
  const days = range === 'all' ? null : Number(range);
  const cutoff = new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate());
  if (days !== null && Number.isFinite(days)) cutoff.setDate(cutoff.getDate() - days + 1);
  return history.filter(session => {
    if (days === null) return true;
    if (!Number.isFinite(days) || days <= 0) return false;
    return new Date(session.date+'T12:00:00') >= cutoff;
  }).map(session => ({...session,value:performanceValue(session,metric,weightFilter)}))
    .filter(session => session.value !== null);
}

export function trendSvg(points, metric='weight') {
  if (!points.length) return '';
  const width=640,height=250,left=54,right=22,top=20,bottom=46;
  const chartHeight=height-top-bottom,chartWidth=width-left-right;
  const values=points.map(p=>p.value);
  let min=Math.min(...values),max=Math.max(...values);
  if (metric==='rpe') {min=1;max=10;}
  else {
    const spread=Math.max(max-min,1);
    min=Math.max(0,min-spread*.2);
    max=max+spread*.2;
  }
  if(max<=min)max=min+1;
  const y=v=>top+(max-v)/(max-min)*chartHeight;
  const x=i=>left+(points.length===1?chartWidth/2:i*chartWidth/(points.length-1));
  const coords=points.map((p,i)=>({x:x(i),y:y(p.value),p}));
  const path=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
  const unit=metric==='weight'?'lb':metric==='reps'?'reps':'RPE';
  const fmt=value=>Number.isInteger(value)?String(value):value.toFixed(1);
  const grid=Array.from({length:5},(_,i)=>{
    const value=min+(max-min)*i/4,cy=y(value);
    return '<line x1="'+left+'" x2="'+(width-right)+'" y1="'+cy+'" y2="'+cy+'" stroke="#3a4551" stroke-width="1" />'+
      '<text x="'+(left-9)+'" y="'+(cy+4)+'" fill="#a6b1bc" text-anchor="end" font-size="12">'+fmt(value)+'</text>';
  }).join('');
  const circles=coords.map(({x:cx,y:cy,p}) =>
    '<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="#a9f071" stroke="#0e1116" stroke-width="2"><title>'+p.date+': '+fmt(p.value)+' '+unit+'</title></circle>'
  ).join('');
  const first=points[0].date,last=points[points.length-1].date;
  return '<svg viewBox="0 0 '+width+' '+height+'" class="progress-trend-svg" role="img" aria-label="'+unit+' trend across '+points.length+' recorded sessions">'+
    grid+'<path d="'+path+'" fill="none" stroke="#a9f071" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
    circles+'<text x="'+left+'" y="'+(height-10)+'" fill="#a6b1bc" font-size="12">'+first+'</text>'+
    (points.length>1?'<text x="'+(width-right)+'" y="'+(height-10)+'" text-anchor="end" fill="#a6b1bc" font-size="12">'+last+'</text>':'')+
    '</svg>';
}
