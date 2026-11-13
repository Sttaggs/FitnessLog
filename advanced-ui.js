import {ADVANCED_TYPES,isAdvancedSet,setTechnique,techniqueLabel,MAX_STAGES} from './advanced-utils.js';

export function supersetLabel(entry,entries){
 if(!entry?.supersetId)return '';
 const groupIds=[...new Set((entries||[]).map(x=>x.supersetId).filter(Boolean))];
 const index=groupIds.indexOf(entry.supersetId);
 const peers=(entries||[]).filter(x=>x.supersetId===entry.supersetId);
 if(index<0||peers.length!==2)return '';
 const position=peers.findIndex(x=>x.id===entry.id);
 return 'Superset '+String.fromCharCode(65+index%26)+(position+1);
}
export function renderSupersetSettings(entry,entries,e){
 const peer=(entries||[]).find(x=>x.id!==entry.id&&x.supersetId&&x.supersetId===entry.supersetId);
 const choices=(entries||[]).filter(x=>x.id!==entry.id);
 return '<details class="exercise-secondary-config"><summary>Superset (optional)'+(peer?' · Linked':'')+'</summary>'+
  '<div class="advanced-settings-body">'+
   (peer?'<p class="helper">Linked with '+e(peer.name)+'. Each exercise keeps independent sets.</p>'+
     '<button type="button" class="btn secondary small" data-action="unlink-superset" data-id="'+e(entry.id)+'">Unlink</button>':'')+
   (choices.length?'<label class="field">Link with exercise<select data-superset-partner="'+e(entry.id)+'">'+
    '<option value="">Choose an exercise</option>'+choices.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+'</option>').join('')+
    '</select></label><button type="button" class="btn secondary small" data-action="link-superset" data-id="'+e(entry.id)+'">Link as superset</button>':
    '<p class="helper">Add another exercise to link a superset.</p>')+'</div></details>';
}
export function renderAdvancedSetPanel(entry,set,e,isOpen=false){
 if(!isAdvancedSet(set))return '';
 const type=setTechnique(set),stages=Array.isArray(set.stages)?set.stages:[];
 const openKey=entry.id+':'+set.id;
 const details=stages.map((stage,j)=>'<div class="advanced-stage-row'+(type==='myo'?' myo':'')+'">'+
  '<span class="advanced-stage-label">'+(type==='myo'?'Mini '+(j+1):'Stage '+(j+2))+'</span>'+
  (type==='myo'?'':'<input type="number" min="0" step="any" inputmode="decimal" aria-label="Stage '+(j+2)+' weight in pounds" placeholder="lb" data-scope="stage:'+e(entry.id)+':'+e(set.id)+':'+e(stage.id)+'" data-field="weight" value="'+e(stage.weight??'')+'">')+
  '<input type="number" min="0" step="1" inputmode="numeric" aria-label="'+(type==='myo'?'Mini-set':'Stage')+' '+(j+1)+' repetitions" placeholder="Reps" data-scope="stage:'+e(entry.id)+':'+e(set.id)+':'+e(stage.id)+'" data-field="reps" value="'+e(stage.reps??'')+'">'+
  (type==='myo'?'':'<input type="number" min="1" max="10" step="0.5" inputmode="decimal" aria-label="Stage '+(j+2)+' RPE" placeholder="RPE" data-scope="stage:'+e(entry.id)+':'+e(set.id)+':'+e(stage.id)+'" data-field="rpe" value="'+e(stage.rpe??'')+'">')+
  '<button type="button" class="btn danger set-delete" data-action="remove-stage" data-exercise="'+e(entry.id)+'" data-set="'+e(set.id)+'" data-stage="'+e(stage.id)+'" aria-label="Remove stage '+(j+1)+'">×</button></div>').join('');
 return '<details class="advanced-set-panel" data-advanced-set="'+e(openKey)+'" '+(isOpen?'open':'')+'>'+
  '<summary>'+e(techniqueLabel(set))+' · '+(stages.length+1)+' '+(type==='myo'?'parts':'stages')+'</summary>'+
  '<div class="advanced-set-inner"><p class="helper">'+
    (type==='myo'?'The main row is the activation set. Mini-sets use its weight; record repetitions below.':
     type==='drop'?'The main row is the first load. Enter reduced-weight stages below.':
      'Use the main row as step one, then enter ascending or descending steps.')+
    '</p>'+details+
   (stages.length<MAX_STAGES?'<button type="button" class="btn secondary small" data-action="add-stage" data-exercise="'+e(entry.id)+'" data-set="'+e(set.id)+'">＋ Add '+(type==='myo'?'mini-set':'stage')+'</button>':'')+
  '</div></details>';
}
export function renderAdvancedTools(entry,e){
 return '<details class="exercise-advanced-tools"><summary>Advanced sets <span aria-hidden="true">⌄</span></summary>'+
 '<div class="exercise-advanced-tools-body">'+
 ADVANCED_TYPES.map(type=>'<button type="button" class="btn secondary small" data-action="add-advanced-set" data-type="'+type+'" data-id="'+e(entry.id)+'">＋ '+techniqueLabel(type)+'</button>').join('')+
 (entry.sets?.length?'<div class="advanced-convert"><p class="helper">Change an existing set</p><div class="advanced-convert-fields">'+
   '<label>Set<select data-convert-set="'+e(entry.id)+'">'+entry.sets.map((set,i)=>'<option value="'+e(set.id)+'">Set '+(i+1)+'</option>').join('')+'</select></label>'+
   '<label>Type<select data-convert-type="'+e(entry.id)+'">'+['standard',...ADVANCED_TYPES].map(type=>'<option value="'+type+'">'+techniqueLabel(type)+'</option>').join('')+'</select></label>'+
   '<button type="button" class="btn secondary small" data-action="convert-set" data-id="'+e(entry.id)+'">Apply</button></div></div>':'')+
 '</div></details>';
}
