// RIR is the active effort scale. Original historical RPE values are retained
// under their original field and interpreted, not silently relabeled.
export function validRir(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&n<=10&&n*2===Math.round(n*2)?n:null;
}
export function validLegacyRpe(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=1&&n<=10?n:null;
}
export function recordedRir(set){
 const rir=validRir(set?.rir);
 if(rir!==null)return rir;
 const original=validLegacyRpe(set?.rpe);
 return original===null?null:Math.round((10-original)*10)/10;
}
export function legacyEffort(set){
 return validRir(set?.rir)===null&&validLegacyRpe(set?.rpe)!==null;
}
export function rirInput(set){
 const n=recordedRir(set);
 return n===null?'':String(n);
}
export function targetRirFloor(target){
 if(Object.prototype.hasOwnProperty.call(target||{},'rirFloor'))return validRir(target.rirFloor);
 const old=validLegacyRpe(target?.rpeCeiling);
 return old===null?null:Math.max(0,Math.round((10-old)*10)/10);
}
