import { computeWallJoinGeometry as resolveWallJoinGeometry } from './wall-topology.mjs';
const EPS=1e-8, rad=d=>d*Math.PI/180, uid=()=>globalThis.crypto?.randomUUID?.()||'obj-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const unit=e=>({x:Math.cos(rad(e.rotation||0)),y:Math.sin(rad(e.rotation||0))});
export function snapGeometryPoint(x,y,items,grid=.2,enabled=true,tolerance=.18){
 if(!enabled)return{x,y};let best={x:Math.round(x/grid)*grid,y:Math.round(y/grid)*grid},dist=Math.hypot(x-best.x,y-best.y);
 const consider=(px,py)=>{const d=Math.hypot(x-px,y-py);if(d<dist&&d<=tolerance){best={x:px,y:py};dist=d}};
 for(const e of items||[]){const u=unit(e),v={x:-u.y,y:u.x},L=e.length/2,W=e.width/2;
  for(const s of [-1,1]){consider(e.x+s*u.x*L,e.y+s*u.y*L);consider(e.x+s*v.x*W,e.y+s*v.y*W)}
  for(const sx of [-1,1])for(const sy of [-1,1])consider(e.x+u.x*sx*L+v.x*sy*W,e.y+u.y*sx*L+v.y*sy*W);
  consider(e.x,e.y);
 }
 return{x:+best.x.toFixed(4),y:+best.y.toFixed(4)};
}
export function transformSelection(model,ids,dx,dy,{snap=false,grid=.2}={}){
 const set=new Set(ids),moving=model.elements.filter(e=>set.has(e.id));if(!moving.length)return{ok:false,reason:'No objects selected'};
 let tx=dx,ty=dy;if(snap){tx=Math.round(tx/grid)*grid;ty=Math.round(ty/grid)*grid}
 const movingIds=new Set(moving.map(e=>e.id));
 for(const e of moving){e.x+=tx;e.y+=ty}
 for(const o of model.elements.filter(e=>['door','window'].includes(e.type)&&e.hostId&&movingIds.has(e.hostId)&&!movingIds.has(e.id))){o.x+=tx;o.y+=ty}
 return{ok:true,changed:moving.length,dx:tx,dy:ty};
}
export function rotateSelection(model,ids,degrees){
 const selected=model.elements.filter(e=>ids.includes(e.id));if(!selected.length)return{ok:false,reason:'No objects selected'};
 const cx=selected.reduce((s,e)=>s+e.x,0)/selected.length,cy=selected.reduce((s,e)=>s+e.y,0)/selected.length,a=rad(degrees),c=Math.cos(a),s=Math.sin(a),set=new Set(selected.map(e=>e.id));
 for(const e of selected){const x=e.x-cx,y=e.y-cy;e.x=cx+x*c-y*s;e.y=cy+x*s+y*c;e.rotation=((e.rotation||0)+degrees)%360}
 for(const o of model.elements.filter(e=>['door','window'].includes(e.type)&&set.has(e.hostId)&&!set.has(e.id))){const x=o.x-cx,y=o.y-cy;o.x=cx+x*c-y*s;o.y=cy+x*s+y*c;o.rotation=((o.rotation||0)+degrees)%360}
 return{ok:true,changed:selected.length};
}
export function resizeElement(model,id,dimension,factor){
 const e=model.elements.find(x=>x.id===id);if(!e)return{ok:false,reason:'Object not found'};
 if(!['length','width','height'].includes(dimension)||!Number.isFinite(factor)||factor<=0)return{ok:false,reason:'Invalid resize input'};
 const baseline=structuredClone(model),old=e[dimension],next=old*factor;if(!Number.isFinite(next)||next<.02)return{ok:false,reason:'Resulting dimension is too small'};
 e[dimension]=next;if(e.type==='wall'){const sync=syncHostedOpeningsAfterWallTransform(model,id,baseline);if(!sync.ok){model.elements=baseline.elements;return{ok:false,reason:sync.reason}}}
 return{ok:true,old,next};
}
export function alignSelection(model,ids,axis,mode='center'){
 const list=model.elements.filter(e=>ids.includes(e.id));if(list.length<2)return{ok:false,reason:'Select at least two objects'};
 if(!['x','y'].includes(axis)||!['center','min','max'].includes(mode))return{ok:false,reason:'Unsupported alignment'};
 const extent=(e,a)=>{const u=unit(e),v={x:-u.y,y:u.x},r=Math.abs(a==='x'?u.x:u.y)*e.length/2+Math.abs(a==='x'?v.x:v.y)*e.width/2;return{min:e[a]-r,max:e[a]+r,center:e[a]}};
 const ref=extent(list[0],axis),target=mode==='min'?ref.min:mode==='max'?ref.max:ref.center;
 for(const e of list.slice(1)){const b=extent(e,axis),delta=target-(mode==='min'?b.min:mode==='max'?b.max:b.center);e[axis]+=delta}
 return{ok:true,changed:list.length-1};
}
export function offsetElement(model,id,distance,side=1){
 const e=model.elements.find(x=>x.id===id);if(!e)return{ok:false,reason:'Object not found'};
 if(!Number.isFinite(distance)||Math.abs(distance)<EPS)return{ok:false,reason:'Offset distance must be non-zero'};
 const u=unit(e),n={x:-u.y*side,y:u.x*side},copy=structuredClone(e);copy.id=uid();copy.x+=n.x*Math.abs(distance);copy.y+=n.y*Math.abs(distance);copy.label=(e.label||e.type)+' · offset';model.elements.push(copy);return{ok:true,id:copy.id};
}
function cross(a,b){return a.x*b.y-a.y*b.x}
function intersect(p,r,q,s,allowOutside=false){const d=cross(r,s);if(Math.abs(d)<EPS)return null;const t=cross({x:q.x-p.x,y:q.y-p.y},s)/d,u=cross({x:q.x-p.x,y:q.y-p.y},r)/d;return (allowOutside||t>=-EPS&&t<=1+EPS)&&u>=-EPS&&u<=1+EPS?{x:p.x+t*r.x,y:p.y+t*r.y,t}:null}
export function trimExtendElement(model,id,referenceId,mode){
 const baseline=structuredClone(model),e=model.elements.find(x=>x.id===id),ref=model.elements.find(x=>x.id===referenceId);if(!e||!ref||e.id===ref.id)return{ok:false,reason:'Select a target and a different boundary object'};
 if(!['trim','extend'].includes(mode))return{ok:false,reason:'Unknown operation'};
 if(!['wall','beam'].includes(e.type))return{ok:false,reason:'Trim and extend currently operate on wall and beam centre-lines'};
 const u=unit(e),v={x:-u.y,y:u.x},start={x:e.x-u.x*e.length/2,y:e.y-u.y*e.length/2},end={x:e.x+u.x*e.length/2,y:e.y+u.y*e.length/2};
 const ru=unit(ref),rv={x:-ru.y,y:ru.x},corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:ref.x+ru.x*a*ref.length/2+rv.x*b*ref.width/2,y:ref.y+ru.y*a*ref.length/2+rv.y*b*ref.width/2}));
 const hits=[];for(let i=0;i<4;i++){const p=corners[i],q=corners[(i+1)%4],r={x:q.x-p.x,y:q.y-p.y},seg={x:end.x-start.x,y:end.y-start.y},h=intersect(start,seg,p,r,mode==='extend');if(h)hits.push(h)}
 const unique=hits.filter((h,i)=>hits.findIndex(x=>Math.hypot(x.x-h.x,x.y-h.y)<1e-5)===i).sort((a,b)=>a.t-b.t);
 if(!unique.length)return{ok:false,reason:'No intersection with the selected boundary'};
 const hit=mode==='trim'?unique.reduce((best,h)=>Math.abs(h.t-.5)<Math.abs(best.t-.5)?h:best):unique.reduce((best,h)=>Math.abs(h.t)<Math.abs(best.t)?h:best,unique[0]);
 const old=e.length,center={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
 if(mode==='trim'){
  const distStart=Math.hypot(hit.x-start.x,hit.y-start.y),distEnd=Math.hypot(hit.x-end.x,hit.y-end.y),keepStart=distStart>=distEnd;
  const fixed=keepStart?start:end, length=Math.hypot(hit.x-fixed.x,hit.y-fixed.y);
  if(length<.02||length>=old-EPS)return{ok:false,reason:'Boundary does not trim the selected object'};
  e.length=length;e.x=(fixed.x+hit.x)/2;e.y=(fixed.y+hit.y)/2;
 }else{
  const ds=Math.hypot(hit.x-start.x,hit.y-start.y),de=Math.hypot(hit.x-end.x,hit.y-end.y);
  if(Math.min(ds,de)<EPS)return{ok:false,reason:'Object already meets the boundary'};
  const extendStart=ds<de,newStart=extendStart?hit:start,newEnd=extendStart?end:hit,length=Math.hypot(newEnd.x-newStart.x,newEnd.y-newStart.y);
  if(length<=old+EPS)return{ok:false,reason:'Boundary is not beyond an endpoint'};
  e.length=length;e.x=(newStart.x+newEnd.x)/2;e.y=(newStart.y+newEnd.y)/2;
 }
 if(e.type==='wall'){const sync=syncHostedOpeningsAfterWallTransform(model,id,baseline);if(!sync.ok){model.elements=baseline.elements;return{ok:false,reason:sync.reason}}}
 return{ok:true,oldLength:old,newLength:e.length,referenceId:ref.id};
}

export function apply3DTransform(element,transform,baseline=element){
 element.x=transform.position.x;element.z=transform.position.y;element.y=transform.position.z;
 element.rotation=-transform.rotation.y*180/Math.PI;
 element.length=baseline.length*transform.scale.x;element.height=baseline.height*transform.scale.y;element.width=baseline.width*transform.scale.z;
 return element;
}

export function constrainHostedOpening(model,id){
 const o=model.elements.find(e=>e.id===id&&['door','window'].includes(e.type));if(!o||!o.hostId)return{ok:true,hosted:false};
 const w=model.elements.find(e=>e.id===o.hostId&&e.type==='wall');if(!w)return{ok:false,reason:'Host wall no longer exists'};
 if(o.length>w.length||o.height>w.height)return{ok:false,reason:'Opening is larger than its host wall'};
 const angle=rad(w.rotation||0),u={x:Math.cos(angle),y:Math.sin(angle)},dx=o.x-w.x,dy=o.y-w.y;
 const along=dx*u.x+dy*u.y,clamped=Math.max(-w.length/2+o.length/2,Math.min(w.length/2-o.length/2,along));
 o.x=w.x+u.x*clamped;o.y=w.y+u.y*clamped;o.rotation=w.rotation||0;
 o.z=Math.max(w.z,Math.min(o.z,w.z+w.height-o.height));
 return{ok:true,hosted:true,hostId:w.id};
}

export function syncHostedOpeningsAfterWallTransform(model,wallId,baselineModel){
 const wall=model.elements.find(e=>e.id===wallId&&e.type==='wall'),oldWall=baselineModel?.elements?.find(e=>e.id===wallId&&e.type==='wall');
 if(!wall||!oldWall)return{ok:false,reason:'Current or baseline host wall is missing'};
 const a0=rad(oldWall.rotation||0),a1=rad(wall.rotation||0),u0={x:Math.cos(a0),y:Math.sin(a0)},u1={x:Math.cos(a1),y:Math.sin(a1)},updated=[];
 for(const o of model.elements.filter(e=>['door','window'].includes(e.type)&&e.hostId===wallId)){
  const old=baselineModel.elements.find(e=>e.id===o.id);if(!old)continue;
  if(o.length>wall.length||o.height>wall.height)return{ok:false,reason:'Wall transform makes a hosted opening too large'};
  const dx=old.x-oldWall.x,dy=old.y-oldWall.y,local=(dx*u0.x+dy*u0.y)*(wall.length/oldWall.length);
  const along=Math.max(-wall.length/2+o.length/2,Math.min(wall.length/2-o.length/2,local));
  o.x=wall.x+u1.x*along;o.y=wall.y+u1.y*along;o.z=wall.z+(old.z-oldWall.z);o.rotation=wall.rotation||0;
  o.z=Math.max(wall.z,Math.min(o.z,wall.z+wall.height-o.height));updated.push(o.id);
 }
 return{ok:true,updated};
}


export function apply3DGroupTransform(model,ids,transform,baselineModel,pivotStart){
 const selected=new Set(ids||[]),members=(baselineModel?.elements||[]).filter(e=>selected.has(e.id));
 if(!members.length)return{ok:false,reason:'No objects selected'};
 const p0=pivotStart||{x:0,y:0,z:0},p1=transform?.position;
 const rotationY=Number(transform?.rotation?.y)||0,scale=transform?.scale||{x:1,y:1,z:1};
 if(!p1||![p1.x,p1.y,p1.z,scale.x,scale.y,scale.z,rotationY].every(Number.isFinite)||scale.x<=0||scale.y<=0||scale.z<=0)
  return{ok:false,reason:'Invalid 3D group transform'};
 const c=Math.cos(rotationY),s=Math.sin(rotationY),updated=[];
 for(const base of members){
  const target=model.elements.find(e=>e.id===base.id);if(!target)continue;
  const rx=base.x-p0.x,ry=base.z-p0.y,rz=base.y-p0.z;
  const sx=rx*scale.x,sy=ry*scale.y,sz=rz*scale.z;
  const tx=sx*c+sz*s,tz=-sx*s+sz*c;
  target.x=p1.x+tx;target.z=p1.y+sy;target.y=p1.z+tz;
  target.rotation=((base.rotation||0)-rotationY*180/Math.PI)%360;
  target.length=base.length*scale.x;target.height=base.height*scale.y;target.width=base.width*scale.z;
  updated.push(target.id);
 }
 for(const base of members.filter(e=>e.type==='wall')){const sync=syncHostedOpeningsAfterWallTransform(model,base.id,baselineModel);if(!sync.ok)return{ok:false,reason:sync.reason}}
 return{ok:true,changed:updated.length,updated};
}

export function attachOpeningToWall(model,openingId,wallId=null){
 const opening=model.elements.find(e=>e.id===openingId&&['door','window'].includes(e.type));
 if(!opening)return{ok:false,reason:'Door or window not found'};
 const candidates=model.elements.filter(e=>e.type==='wall'&&(!wallId||e.id===wallId)).map(w=>{
  const a=rad(w.rotation||0),ux=Math.cos(a),uy=Math.sin(a),dx=opening.x-w.x,dy=opening.y-w.y;
  const along=dx*ux+dy*uy,across=-dx*uy+dy*ux;
  return{wall:w,ux,uy,along,across,distance:Math.abs(across)};
 }).filter(v=>v.distance<=Math.max(.25,v.wall.width*1.8)&&Math.abs(v.along)<=v.wall.length/2+opening.length/2)
 .sort((a,b)=>a.distance-b.distance);
 const candidate=candidates[0];
 if(!candidate)return{ok:false,reason:wallId?'Opening is not close enough to the selected wall':'No suitable wall found near this opening'};
 const {wall,ux,uy}=candidate;
 if(opening.length>wall.length||opening.height>wall.height)return{ok:false,reason:'Opening is larger than its host wall'};
 const along=Math.max(-wall.length/2+opening.length/2,Math.min(wall.length/2-opening.length/2,candidate.along));
 opening.x=wall.x+ux*along;opening.y=wall.y+uy*along;
 opening.z=Math.max(wall.z,Math.min(opening.z,wall.z+wall.height-opening.height));
 opening.rotation=wall.rotation||0;opening.hostId=wall.id;
 return{ok:true,hostId:wall.id,position:{x:opening.x,y:opening.y,z:opening.z}};
}

/** Backwards-compatible geometry-editing export backed by the topology resolver. */
export function computeWallJoinGeometry(wall,walls=[]){
 return resolveWallJoinGeometry(wall,walls);
}
