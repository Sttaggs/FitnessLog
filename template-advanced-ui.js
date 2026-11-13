import {ADVANCED_TYPES,techniqueLabel,normalizeSetPlan} from './advanced-utils.js';

export function renderTemplateExerciseRow(entry,index,template,e,expanded=false){
 const count=Math.max(1,Math.min(20,Number(entry.sets)||1));
 const plans=Array.from({length:count},(_,j)=>normalizeSetPlan(entry.setPlans?.[j]));
 const partnerIndex=(template.exercises||[]).findIndex((other,j)=>j!==index&&
   entry.supersetId&&other.supersetId===entry.supersetId);
 const configured=partnerIndex>=0||plans.some(p=>p.technique!=='standard');
 const planRows=plans.map((plan,j)=>'<div class="template-plan-row">'+
  '<label>Set '+(j+1)+' type<select data-template-technique="'+index+'" data-set-index="'+j+'">'+
   ['standard',...ADVANCED_TYPES].map(type=>'<option value="'+type+'" '+(plan.technique===type?'selected':'')+'>'+techniqueLabel(type)+'</option>').join('')+
   '</select></label>'+
   (plan.technique!=='standard'?'<label>Extra '+(plan.technique==='myo'?'mini-sets':'stages')+
     '<input type="number" min="1" max="12" step="1" inputmode="numeric" data-template-stage-count="'+index+'" data-set-index="'+j+'" value="'+plan.stages+'"></label>':'')+
  '</div>').join('');
 return '<div class="item template-editor-row">'+
  '<div class="template-editor-row-head"><strong>'+e(entry.name)+'</strong>'+
   '<button type="button" class="btn ghost small" data-action="template-remove-exercise" data-index="'+index+'" aria-label="Remove '+e(entry.name)+'">Remove</button></div>'+
  '<div class="template-editor-row-bottom"><label>Sets<input type="number" inputmode="numeric" min="1" max="20" step="1" data-template-sets="'+index+'" value="'+e(entry.sets)+'" aria-label="Number of sets for '+e(entry.name)+'"></label>'+
   '<div class="template-order-buttons"><button type="button" class="btn secondary small" data-action="template-move-up" data-index="'+index+'" aria-label="Move '+e(entry.name)+' earlier" '+(index===0?'disabled':'')+'>↑</button>'+
   '<button type="button" class="btn secondary small" data-action="template-move-down" data-index="'+index+'" aria-label="Move '+e(entry.name)+' later" '+(index===template.exercises.length-1?'disabled':'')+'>↓</button></div></div>'+
  '<details class="template-advanced-options" data-template-advanced="'+index+'" '+(expanded?'open':'')+'><summary>Advanced options'+(configured?' · Configured':'')+'</summary>'+
   '<div class="template-advanced-options-body"><label class="field">Superset with<select data-template-partner="'+index+'">'+
    '<option value="">None</option>'+template.exercises.map((other,j)=>j===index?'':'<option value="'+j+'" '+(partnerIndex===j?'selected':'')+'>'+e(other.name)+'</option>').join('')+
   '</select></label><p class="helper">Link two exercises. Both keep their own sets.</p>'+
    '<div class="template-plan-list">'+planRows+'</div></div></details></div>';
}
