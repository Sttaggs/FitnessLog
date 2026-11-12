// Photos remain on the user's device in IndexedDB unless explicitly exported.
const acceptedTypes=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);

export async function shrinkPhoto(file) {
  if (!file || !acceptedTypes.has(file.type.toLowerCase())) throw new Error('Choose a JPEG, PNG, WebP, or supported iPhone photo.');
  if (file.size > 25*1024*1024) throw new Error('Photo exceeds the 25 MB input limit.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Could not read this photo format.'));
      image.src=url;
    });
    const maxDimension=1600;
    const ratio=Math.min(1,maxDimension/Math.max(image.naturalWidth,image.naturalHeight));
    if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Photo dimensions are invalid.');
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Photo processing is unavailable.');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.83));
    if(!blob)throw new Error('Photo could not be processed.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

export function blobAsDataUrl(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error('Cannot export photo.'));
    reader.readAsDataURL(blob);
  });
}

export async function photosForBackup(photos) {
  const result=[];
  for(const photo of photos){
    if(!photo.blob)continue;
    result.push({
      id:photo.id,date:photo.date,view:photo.view,createdAt:photo.createdAt,
      dataUrl:await blobAsDataUrl(photo.blob)
    });
  }
  return result;
}

export async function restorePhotos(payload) {
  if(!Array.isArray(payload))throw new Error('Invalid photo backup.');
  const result=[];
  for(const item of payload){
    if(!item||typeof item.id!=='string'||!item.id||!/^\d{4}-\d\d-\d\d$/.test(item.date)||!['Front','Side','Back'].includes(item.view)||
       typeof item.dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,/i.test(item.dataUrl))throw new Error('Unsupported photo backup record.');
    const response=await fetch(item.dataUrl);
    const blob=await response.blob();
    if(blob.size>8*1024*1024)throw new Error('Backup contains an oversized photo.');
    result.push({id:item.id,date:item.date,view:item.view,createdAt:item.createdAt||'',blob});
  }
  return result;
}
