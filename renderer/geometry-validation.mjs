const TYPES=new Set(['wall','foundation','door','window','slab','roof','column','beam','stair','furniture','bed','sofa','table','wardrobe','light','cabinet','plumbing','electrical','landscape']);
const finite=v=>typeof v==='number'&&Number.isFinite(v),EPS=1e-6;
export function validateGeometry(model){
 const errors=[],warnings=[],items=Array.isArray(model?.elements)?model.elements:[];
 if(!model||!Array.isArray(model.elements))errors.push('Model elements collection is missing');
 const ids=new Set();
 for(let i=0;i<items.length;i++){
  const e=items[i],tag=e?.label||e?.type||'Object '+(i+1);
  if(!e||typeof e!=='object'){errors.push(tag+': invalid object record');continue}
  if(!e.id||typeof e.id!=='string')errors.push(tag+': missing stable object ID');
  else if(ids.has(e.id))errors.push(tag+': duplicate object ID '+e.id);else ids.add(e.id);
  if(!TYPES.has(e.type))errors.push(tag+': unsupported geometry type '+String(e.type));
  for(const k of ['x','y','z','length','width','height','rotation'])if(!finite(e[k]))errors.push(tag+': '+k+' must be a finite number');
  for(const k of ['length','width','height'])if(finite(e[k])&&e[k]<=EPS)errors.push(tag+': '+k+' must be greater than zero');
  if(finite(e.rotation)&&Math.abs(e.rotation)>36000)errors.push(tag+': rotation is outside the supported range');
  if(e.type==='roof'){if(!['flat','gable','hip','skillion'].includes(e.roofStyle||'gable'))errors.push(tag+': unsupported roof profile');const pitch=Number(e.pitch??30);if(!Number.isFinite(pitch)||pitch<0||pitch>60)errors.push(tag+': roof pitch must be between 0° and 60°')}
  if(['door','window'].includes(e.type)){if(e.height>3.5)warnings.push(tag+': unusually tall opening; verify the design');if(e.hostId&&!items.some(w=>w.id===e.hostId&&w.type==='wall'))errors.push(tag+': host wall reference is missing')}
 }
 const topology=model?.wallTopology;
 if(topology&&Array.isArray(topology.joins)){
  for(const join of topology.joins){
   const source=items.find(x=>x.id===join.wallId&&x.type==='wall'),target=items.find(x=>x.id===join.otherWallId&&x.type==='wall');
   if(!source||!target)errors.push('Wall join '+String(join.id||'')+': relationship references a missing wall');
   if(!['start','end'].includes(join.endpoint))errors.push('Wall join '+String(join.id||'')+': invalid endpoint reference');
   if(!Number.isFinite(join.trim)||join.trim<0)errors.push('Wall join '+String(join.id||'')+': invalid trim geometry');
   if(!join.point||!finite(join.point.x)||!finite(join.point.y))errors.push('Wall join '+String(join.id||'')+': invalid intersection point');
  }
 }
 for(const e of items.filter(x=>x&&['door','window'].includes(x.type)&&x.hostId)){
  const w=items.find(x=>x.id===e.hostId);if(!w)continue;
  const a=(Number(w.rotation)||0)*Math.PI/180,dx=e.x-w.x,dy=e.y-w.y,along=dx*Math.cos(a)+dy*Math.sin(a),across=-dx*Math.sin(a)+dy*Math.cos(a);
  if(Math.abs(across)>Math.max(.25,w.width*1.8))errors.push((e.label||e.type)+': opening is no longer aligned with its host wall');
  if(Math.abs(along)+e.length/2>w.length/2+EPS)errors.push((e.label||e.type)+': opening extends beyond its host wall');
  if(e.z<w.z-EPS||e.z+e.height>w.z+w.height+EPS)errors.push((e.label||e.type)+': opening exceeds host wall vertical limits');
 }
 for(const e of items.filter(x=>x&&x.type==='wall')){if(e.width>.6)warnings.push((e.label||'Wall')+': thickness exceeds 600 mm; confirm intended construction');if(e.height>6)warnings.push((e.label||'Wall')+': height exceeds 6 m; verify storey and support arrangement')}
 return{valid:errors.length===0,errors,warnings,checked:items.length};
}
