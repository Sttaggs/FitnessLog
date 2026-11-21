// Wall-clock workout timing. Persist absolute timestamps, never an interval counter.
// This remains correct if the app is backgrounded, closed, or reopened.
export function parsedWorkoutTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const milliseconds=Date.parse(value);
 return Number.isFinite(milliseconds)?milliseconds:null;
}
export function ensureWorkoutStart(session,now=new Date()){
 if(!session||session.status!=='active')return false;
 if(parsedWorkoutTime(session.startTime)!==null)return false;
 session.startTime=now.toISOString();
 return true;
}
export function finishWorkoutTiming(session,now=new Date()){
 if(!session)return false;
 // Editing a finished session must not silently overwrite its original end time.
 if(session.status==='finished')return true;
 ensureWorkoutStart(session,now);
 const start=parsedWorkoutTime(session.startTime);
 const finish=now.getTime();
 if(start===null||!Number.isFinite(finish)||finish<start)return false;
 session.endTime=now.toISOString();
 return true;
}
export function workoutElapsedMs(session,now=Date.now()){
 const start=parsedWorkoutTime(session?.startTime);
 if(start===null)return null;
 const end=session?.status==='finished'?parsedWorkoutTime(session.endTime):
  session?.status==='active'?now:null;
 if(end===null||!Number.isFinite(end)||end<start)return null;
 return end-start;
}
export function clockDuration(milliseconds){
 if(milliseconds===null||!Number.isFinite(milliseconds)||milliseconds<0)return '—';
 const secs=Math.floor(milliseconds/1000);
 const hrs=Math.floor(secs/3600),mins=Math.floor(secs%3600/60),seconds=secs%60;
 return String(hrs).padStart(2,'0')+':'+String(mins).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
}
export function shortDuration(milliseconds){
 if(milliseconds===null||!Number.isFinite(milliseconds)||milliseconds<0)return '';
 const minutes=Math.floor(milliseconds/60000);
 const hours=Math.floor(minutes/60);
 const remain=minutes%60;
 if(hours)return hours+'h '+String(remain).padStart(2,'0')+'m';
 return minutes+' min';
}
export function localTimeLabel(value){
 const milliseconds=parsedWorkoutTime(value);
 if(milliseconds===null)return '—';
 return new Date(milliseconds).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
}
export function localDateTimeValue(value){
 const milliseconds=parsedWorkoutTime(value);
 if(milliseconds===null)return '';
 const d=new Date(milliseconds);
 const digits=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+digits(d.getMonth()+1)+'-'+digits(d.getDate())+
  'T'+digits(d.getHours())+':'+digits(d.getMinutes());
}
export function isoFromLocalDateTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return null;
 // Reject normalized dates such as February 30 and missing spring-DST hours.
 if(localDateTimeValue(d.toISOString())!==value)return null;
 return d.toISOString();
}
export function changeWorkoutTime(session,field,iso,now=Date.now()){
 if(!session||!['startTime','endTime'].includes(field))return false;
 const proposed=parsedWorkoutTime(iso);
 if(proposed===null)return false;
 if(field==='startTime'&&session.status==='active'&&proposed>now)return false;
 if(field==='endTime'&&session.status!=='finished')return false;
 const other=parsedWorkoutTime(session[field==='startTime'?'endTime':'startTime']);
 if(other!==null&&((field==='startTime'&&proposed>other)||(field==='endTime'&&proposed<other)))return false;
 session[field]=iso;
 return true;
}
