import { computeWallJoinGeometry, rebuildWallTopology } from './wall-topology.mjs';

const rad=d=>(Number(d)||0)*Math.PI/180;
const unit=w=>({x:Math.cos(rad(w.rotation)),y:Math.sin(rad(w.rotation))});
const normal=w=>{const u=unit(w);return{x:-u.y,y:u.x}};
const point=(w,s,side=0)=>{const u=unit(w),n=normal(w);return{x:w.x+u.x*s+n.x*side,y:w.y+u.y*s+n.y*side}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const stable=(...parts)=>parts.map(v=>String(v??'')).join('|');

export function wallPriority(wall){
 const role=String(wall?.wallRole||wall?.function||'').toLowerCase();
 const rolePriority=role==='primary'||role==='structural'||role==='spine'?300:role==='external'||role==='perimeter'?200:role==='partition'||role==='internal'?100:0;
 const typePriority=Number(wall?.wallTypePriority??wall?.typePriority);
 const explicit=Number(wall?.joinPriority);
 return Number.isFinite(explicit)?explicit:Number.isFinite(typePriority)?typePriority:rolePriority;
}

/**
 * Groups endpoint relationships into shared junction nodes. Every member is
 * solved against the complete cluster, not just the first neighbour found.
 * The returned node is shared by all members and has a deterministic ID.
 */
export function resolveWallJunctionClusters(model,{tolerance=.08}={}){
 if(!model||!Array.isArray(model.elements))return[];
 const topology=rebuildWallTopology(model),walls=model.elements.filter(e=>e?.type==='wall');
 const records=(topology.joins||[]).map(j=>({...j,wall:walls.find(w=>w.id===j.wallId),other:walls.find(w=>w.id===j.otherWallId)})).filter(j=>j.wall&&j.other&&!topology.overrides?.some(o=>o.wallId===j.wallId&&o.otherWallId===j.otherWallId&&o.endpoint===j.endpoint&&o.mode==='unjoin'));
 const groups=[];
 for(const record of records){
  let group=groups.find(g=>distance(g.anchor,record.point)<=tolerance);
  if(!group){group={anchor:{...record.point},records:[]};groups.push(group)}
  group.records.push(record);
 }
 return groups.map(g=>{
  const byWall=new Map();
  for(const r of g.records){const key=stable(r.wallId,r.endpoint);if(!byWall.has(key))byWall.set(key,{wall:r.wall,endpoint:r.endpoint,relationships:[]});byWall.get(key).relationships.push(r)}
  const members=[...byWall.values()];
  const uniqueWalls=[...new Map(members.map(m=>[m.wall.id,m.wall])).values()];
  if(uniqueWalls.length<2)return null;
  const manual=model.wallTopology?.overrides||[];
  const override=manual.find(o=>o.kind==='cluster'&&o.memberIds?.length===uniqueWalls.length&&o.memberIds.every(id=>uniqueWalls.some(w=>w.id===id)));
  const ordered=[...uniqueWalls].sort((a,b)=>wallPriority(b)-wallPriority(a)||String(a.id).localeCompare(String(b.id)));
  const continuation=override?.continuationWallId?uniqueWalls.find(w=>w.id===override.continuationWallId):ordered[0];
  const memberResults=members.map(m=>{
   const all=uniqueWalls.filter(w=>w.id!==m.wall.id);
   const geometry=computeWallJoinGeometry(m.wall,[m.wall,...all]);
   return{wallId:m.wall.id,endpoint:m.endpoint,priority:wallPriority(m.wall),continues:m.wall.id===continuation?.id,relationships:m.relationships.map(r=>r.id),startCut:geometry.startCut,endCut:geometry.endCut,startTrim:geometry.startTrim,endTrim:geometry.endTrim};
  });
  const pointIds=uniqueWalls.map(w=>w.id).sort();
  return{id:'junction:'+pointIds.join(':'),point:g.anchor,kind:uniqueWalls.length>2?'multiway':members.some(m=>m.relationships.some(r=>r.kind==='tee'))?'tee':'corner',wallIds:pointIds,continuationWallId:continuation?.id||null,members:memberResults,manual:!!override};
 }).filter(Boolean).sort((a,b)=>a.id.localeCompare(b.id));
}

export function setWallJoinOverride(model,{wallId,otherWallId,endpoint='end',mode='unjoin',continuationWallId=null}={}){
 if(!model||!Array.isArray(model.elements))throw new TypeError('A model with elements is required');
 const valid=new Set(model.elements.filter(e=>e.type==='wall').map(e=>e.id));
 if(!valid.has(wallId)||!valid.has(otherWallId)||wallId===otherWallId)throw new Error('Both wall references must identify different existing walls');
 if(!['start','end'].includes(endpoint)||!['join','unjoin','auto','override'].includes(mode))throw new Error('Unsupported join control');
 const topology=model.wallTopology||rebuildWallTopology(model),overrides=[...(topology.overrides||[])];
 const key=o=>o.wallId===wallId&&o.otherWallId===otherWallId&&o.endpoint===endpoint;
 const index=overrides.findIndex(key);
 if(mode==='auto'){if(index>=0)overrides.splice(index,1)}
 else{const value={id:'manual-join:'+stable(wallId,endpoint,otherWallId),wallId,otherWallId,endpoint,mode,continuationWallId};if(index>=0)overrides[index]=value;else overrides.push(value)}
 topology.overrides=overrides;model.wallTopology=topology;return topology;
}

export function setJunctionContinuation(model,memberIds,continuationWallId){
 if(!Array.isArray(memberIds)||memberIds.length<2||!memberIds.includes(continuationWallId))throw new Error('Choose a continuation wall from the junction members');
 const topology=model.wallTopology||rebuildWallTopology(model),overrides=[...(topology.overrides||[])];
 const sorted=[...new Set(memberIds)].sort(),id='manual-cluster:'+sorted.join(':');
 const value={id,kind:'cluster',memberIds:sorted,continuationWallId};
 const index=overrides.findIndex(o=>o.id===id);if(index>=0)overrides[index]=value;else overrides.push(value);
 topology.overrides=overrides;model.wallTopology=topology;return value;
}

export function normaliseWallLayers(wall){
 const layers=Array.isArray(wall?.layers)&&wall.layers.length?wall.layers:[{id:'core',name:wall?.material||'Wall core',kind:'core',material:wall?.material||'Masonry',thickness:Number(wall?.width)||.15}];
 const clean=layers.map((layer,index)=>({id:String(layer.id||'layer-'+index),name:String(layer.name||layer.material||'Layer '+(index+1)),kind:String(layer.kind||'finish'),material:String(layer.material||'Unspecified'),thickness:Number(layer.thickness),priority:Number(layer.priority)||0,wrapAtJunction:layer.wrapAtJunction!==false,joinBehaviour:layer.joinBehaviour||'miter'}));
 if(clean.some(l=>!Number.isFinite(l.thickness)||l.thickness<=0))throw new Error('Every wall layer must have a positive finite thickness');
 return clean;
}

/**
 * Produces layer-by-layer join offsets from the wall centreline. Core layers
 * remain the controlling datum; finish/insulation layers can wrap or terminate
 * independently at the junction. These are construction coordinates for the
 * renderer/IFC layer-set writer, not a structural design calculation.
 */
export function resolveCompoundWallJoin(wall,clusterMember){
 const layers=normaliseWallLayers(wall),total=layers.reduce((s,l)=>s+l.thickness,0),width=Number(wall.width)||total;
 if(Math.abs(total-width)>.002)throw new Error('Wall layer thickness total ('+total.toFixed(3)+' m) does not match wall width ('+width.toFixed(3)+' m)');
 let offset=-total/2;
 const layerGeometry=layers.map(layer=>{
  const inner=offset,outer=offset+layer.thickness;offset=outer;
  return{...layer,innerOffset:inner,outerOffset:outer,termination:layer.kind==='core'?'core-junction':layer.wrapAtJunction?'wrap':'butt',joinBehaviour:layer.joinBehaviour};
 });
 const u=unit(wall),n=normal(wall),endpoint=clusterMember?.endpoint||'end',s=endpoint==='start'?-wall.length/2:wall.length/2;
 return{wallId:wall.id,totalThickness:total,endpoint,layerGeometry,endpointCentre:point(wall,s),normal:n,direction:u};
}

export function compoundWallMetrics(wall){
 const layers=normaliseWallLayers(wall),totalThickness=layers.reduce((s,l)=>s+l.thickness,0);
 return{layerCount:layers.length,totalThickness,thicknessMatchesWidth:Math.abs(totalThickness-(Number(wall.width)||totalThickness))<=.002,coreLayers:layers.filter(l=>l.kind==='core').length,finishLayers:layers.filter(l=>l.kind==='finish').length,insulationLayers:layers.filter(l=>l.kind==='insulation').length};
}
