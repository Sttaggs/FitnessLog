// Built-in exercise suggestions provided by the FitnessLog owner.
// Names remain editable/user-extensible through the existing exercise library.
// Two categories intentionally contain "Close-grip bench press": it is stored once
// with Chest as primary muscle and Triceps as an optional secondary tag.
export const CATALOG_GROUPS=[
 {
  category:'Chest',muscle:'Chest',names:[
   'Machine chest press','Hammer machine chest press',
   'Hammer machine incline press','Hammer machine decline press',
   'Incline dumbbell press','Close-grip incline press','Close-grip bench press',
   'Machine chest fly (pec deck)','Dumbbell chest fly','Cable chest fly',
   'High-to-low cable fly','Low-to-high cable fly','Cable crossover',
   'Incline push-ups','Dips'
  ]
 },
 {
  category:'Shoulders',muscle:'Shoulders',names:[
   'Machine shoulder press','Hammer machine shoulder press',
   'Barbell seated military press','Dumbbell lateral raise',
   'Incline dumbbell lateral raise','Cable lateral raise',
   'Single-arm cable lateral raise','Dumbbell shoulder high pull',
   'Cable shoulder high pull','Dumbbell rear delt fly',
   'Incline dumbbell rear delt fly','Machine rear delt fly',
   'Cable rear delt fly','Single-arm cable rear delt fly',
   'Cable face pull','Cable X-pull','Prone snow angel'
  ]
 },
 {
  category:'Back',muscle:'Back',names:[
   'Pull-ups','Wide-grip lat pulldown','Close-grip lat pulldown',
   'Neutral-grip lat pulldown','Reverse-grip lat pulldown',
   'Supinated cable pulldown','Single-arm cable lat pulldown',
   'Hammer machine lat pulldown','Hammer machine row','Machine row',
   'Seated cable row','Close-grip cable row','Low cable row',
   'High cable row','High-bar cable row','Straight-arm cable pulldown',
   'Machine lat pullover','Cable shrug','Incline dumbbell scapular pull',
   'Cable scapular pull','Cable trap raise','Lower trapezius raise'
  ]
 },
 {
  category:'Biceps',muscle:'Biceps',names:[
   'EZ-bar curl','EZ-bar preacher curl','Incline EZ-bar curl',
   'Dumbbell curl','Incline dumbbell curl','Dumbbell waiter curl',
   'Cable biceps curl','Cable rope biceps curl','Machine biceps curl',
   'Machine preacher curl','Reverse-grip cable curl'
  ]
 },
 {
  category:'Triceps',muscle:'Triceps',names:[
   'Cable triceps pushdown','Rope triceps pushdown',
   'Overhead cable triceps extension','Single-arm cable triceps extension',
   'Incline EZ-bar triceps extension','Supine dumbbell triceps extension',
   'Machine triceps dip','Close-grip bench press'
  ]
 },
 {
  category:'Quadriceps',muscle:'Quadriceps',names:[
   'Barbell full-ROM squat','Heel-elevated squat','Leg press',
   'Machine leg extension','Glute-focused lunge'
  ]
 },
 {
  category:'Hamstrings and Glutes',muscle:'Hamstrings',names:[
   'Romanian deadlift (RDL)','Single-leg deadlift','Stiff-leg deadlift',
   'Machine hamstring curl','Glute-ham raise','Barbell hip thrust',
   'Machine hip thrust','Glute bridge'
  ]
 },
 {
  category:'Core and Mobility',muscle:'Core',names:[
   'Plank','Side plank','Reverse plank','Boat hold','Superman','Dead bug',
   'Bird dog','Low squat hip opener','Gentle spinal rotation',
   'Abdominal crunch','Cable abdominal crunch','Scapular push-up'
  ]
 },
 {
  category:'Cardio and Conditioning',muscle:'',names:[
   'Walking','Rucking','Jogging','Sprinting',
   'First-step acceleration drills','Hiking','Disc golf','Kayaking'
  ]
 }
];
export const CATALOG_CATEGORIES=CATALOG_GROUPS.map(group=>group.category);

// These targeted adjustments are editable after the catalog has been installed.
const variants={
 'Glute-focused lunge':{muscle:'Glutes',secondaryMuscles:['Quadriceps']},
 'Cable shrug':{muscle:'Traps',secondaryMuscles:['Back']},
 'Cable trap raise':{muscle:'Traps',secondaryMuscles:['Back']},
 'Lower trapezius raise':{muscle:'Traps',secondaryMuscles:['Back']},
 'Romanian deadlift (RDL)':{secondaryMuscles:['Glutes']},
 'Single-leg deadlift':{secondaryMuscles:['Glutes']},
 'Stiff-leg deadlift':{secondaryMuscles:['Glutes']},
 'Glute-ham raise':{secondaryMuscles:['Glutes']},
 'Barbell hip thrust':{muscle:'Glutes'},
 'Machine hip thrust':{muscle:'Glutes'},
 'Glute bridge':{muscle:'Glutes'},
 'Low squat hip opener':{muscle:''},
 'Gentle spinal rotation':{muscle:''},
 'Scapular push-up':{muscle:'Shoulders'},
 'Dips':{secondaryMuscles:['Triceps']}
};
export function normalizeCatalogName(value){
 return String(value||'').normalize('NFKC').toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function catalogItems(){
 const unique=new Map();
 for(const group of CATALOG_GROUPS){
  for(const name of group.names){
   const key=normalizeCatalogName(name);
   if(unique.has(key)){
    const prior=unique.get(key);
    if(group.muscle && group.muscle!==prior.muscle &&
       !prior.secondaryMuscles.includes(group.muscle)){
      prior.secondaryMuscles.push(group.muscle);
    }
    continue;
   }
   const variant=variants[name]||{};
   unique.set(key,{
    name,category:group.category,muscle:variant.muscle??group.muscle,
    secondaryMuscles:[...(variant.secondaryMuscles||[])]
   });
  }
 }
 return [...unique.values()];
}
export const CATALOG_EXERCISES=catalogItems();

/**
 * Generate only missing records, optionally enriching previously saved records
 * that have no category/muscle. Never replace an existing ID, training target,
 * user-assigned primary muscle, notes, or already defined secondary tag array.
 * Run once per catalog release, not on every launch, so user deletions persist.
 */
export function planCatalogInstall(existing,createId,createdAt){
 const byName=new Map((existing||[]).map(ex=>[normalizeCatalogName(ex.name),ex]));
 const toInsert=[],toUpdate=[];
 for(const item of CATALOG_EXERCISES){
  const match=byName.get(normalizeCatalogName(item.name));
  if(!match){
   toInsert.push({
    id:createId(),name:item.name,muscle:item.muscle,
    secondaryMuscles:[...item.secondaryMuscles],
    category:item.category,equipment:'',createdAt,origin:'starter-catalog'
   });
   continue;
  }
  const updated={...match};
  let changed=false;
  if(!updated.category){
   updated.category=item.category;
   changed=true;
  }
  if(!updated.muscle && item.muscle){
   updated.muscle=item.muscle;
   changed=true;
  }
  if(!Array.isArray(updated.secondaryMuscles)&&item.secondaryMuscles.length){
   updated.secondaryMuscles=item.secondaryMuscles.filter(m=>m!==updated.muscle);
   changed=true;
  }
  if(changed)toUpdate.push(updated);
 }
 return {toInsert,toUpdate};
}
