const EPS=1e-8;
const rad=d=>(Number(d)||0)*Math.PI/180;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const frame=w=>{const a=rad(w.rotation),u={x:Math.cos(a),y:Math.sin(a)};return{u,n:{x:-u.y,y:u.x}}};
const point=(w,u,s)=>({x:w.x+u.x*s,y:w.y+u.y*s});
const area=pts=>Math.abs(pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+p.x*q.y-q.x*p.y},0)/2);

/**
 * Find endpoint-to-face relationships between two finite wall centrelines.
 * A join is only created when one wall actually terminates at the other;
 * interior crossings and parallel overlaps are deliberately not treated as
 * endpoint joins.
 */
function endpointHit(wall,other,sign,tolerance=.18){
 if(!wall||!other||wall.id===other.id||wall.type!=='wall'||other.type!=='wall')return null;
 const A=frame(wall),B=frame(other),det=cross(A.u,B.u);
 if(Math.abs(det)<1e-6)return null;
 const delta={x:other.x-wall.x,y:other.y-wall.y};
 const alongA=cross(delta,B.u)/det,alongB=cross(delta,A.u)/det;
 const halfA=wall.length/2,halfB=other.length/2;
 const tol=Math.max(tolerance,(wall.width+other.width)*.65);
 if(Math.abs(alongA-sign*halfA)>tol)return null;
 if(Math.abs(alongB)>halfB+other.width/2+tol)return null;
 const inward={x:-sign*A.u.x,y:-sign*A.u.y};
 const sideB=Math.sign(dot(inward,B.n));
 if(!sideB)return null;
 const denominator=dot(A.u,B.n);
 if(Math.abs(denominator)<1e-6)return null;
 const sideCuts=[-1,1].map(sideA=>{
  const start={x:wall.x-other.x+A.n.x*sideA*wall.width/2,y:wall.y-other.y+A.n.y*sideA*wall.width/2};
  return (sideB*other.width/2-dot(start,B.n))/denominator;
 });
 const inwardTrims=sideCuts.map(s=>sign<0?s+halfA:halfA-s);
 if(inwardTrims.some(t=>t<-.015||t>Math.max(wall.width,other.width)*3+.1))return null;
 const intersection=point({...wall,x:Number(wall.x)||0,y:Number(wall.y)||0},A.u,alongA);
 const otherAtEnd=Math.abs(Math.abs(alongB)-halfB)<=other.width/2+tol;
 return{
  wallId:wall.id,endpoint:sign<0?'start':'end',otherWallId:other.id,
  kind:otherAtEnd?'corner':'tee',point:intersection,
  angleDeg:Math.acos(Math.max(-1,Math.min(1,Math.abs(dot(A.u,B.u)))))*180/Math.PI,
  sideCuts,trim:(inwardTrims[0]+inwardTrims[1])/2,mode:'auto'
 };
}

export function computeWallJoinGeometry(wall,walls=[]){
 const half=Math.max(.001,(+wall.length||0)/2),width=Math.max(.01,+wall.width||.15);
 const cuts={start:[-half,-half],end:[half,half]},joins=[];
 for(const other of walls||[]){
  if(other?.type!=='wall'||other.id===wall.id)continue;
  for(const [name,sign] of [['start',-1],['end',1]]){
   const hit=endpointHit(wall,other,sign);if(!hit)continue;
   const target=cuts[name];
   for(let i=0;i<2;i++)target[i]=sign<0?Math.max(target[i],hit.sideCuts[i]):Math.min(target[i],hit.sideCuts[i]);
   joins.push(hit);
  }
 }
 const startTrim=Math.max(0,(cuts.start[0]+cuts.start[1])/2+half);
 const endTrim=Math.max(0,half-(cuts.end[0]+cuts.end[1])/2);
 const length=Math.max(.02,((cuts.end[0]-cuts.start[0])+(cuts.end[1]-cuts.start[1]))/2);
 return{startTrim,endTrim,length,centreOffset:(startTrim-endTrim)/2,startCut:cuts.start,endCut:cuts.end,joins};
}

export function wallFootprint(wall,walls=[]){
 const g=computeWallJoinGeometry(wall,walls),{u,n}=frame(wall),h=wall.width/2;
 const local=[[g.startCut[0],h],[g.endCut[0],h],[g.endCut[1],-h],[g.startCut[1],-h]];
 const cx=Number(wall.x)||0,cy=Number(wall.y)||0;return local.map(([s,side])=>({x:cx+u.x*s+n.x*side,y:cy+u.y*s+n.y*side}));
}

export function wallMetrics(wall,walls=[]){
 const join=computeWallJoinGeometry(wall,walls),footprint=wallFootprint(wall,walls);
 return{...join,footprint,planArea:area(footprint),effectiveLength:join.length};
}

/**
 * Persist the automatically resolved wall graph in the model. Relationship
 * IDs are deterministic, so unchanged joins remain stable across saves.
 * Geometry remains derived from live element parameters, avoiding stale cuts.
 */
export function rebuildWallTopology(model){
 if(!model||!Array.isArray(model.elements))return{schemaVersion:1,revision:0,joins:[]};
 const walls=model.elements.filter(e=>e?.type==='wall'),joins=[];
 for(const wall of walls){
  for(const other of walls){
   if(wall.id===other.id)continue;
   const g=computeWallJoinGeometry(wall,[other]);
   for(const j of g.joins){
    const key=[j.wallId,j.endpoint,j.otherWallId].join('|');
    joins.push({id:'wall-join:'+key,wallId:j.wallId,endpoint:j.endpoint,otherWallId:j.otherWallId,kind:j.kind,mode:'auto',point:j.point,angleDeg:j.angleDeg,trim:j.trim});
   }
  }
 }
 joins.sort((a,b)=>a.id.localeCompare(b.id));
 const previous=model.wallTopology||{},signature=JSON.stringify(joins);
 const unchanged=previous.signature===signature;
 model.wallTopology={schemaVersion:1,revision:unchanged?(previous.revision||1):(previous.revision||0)+1,signature,joins};
 return model.wallTopology;
}

export function wallTopologySummary(model){
 const topology=model?.wallTopology||rebuildWallTopology(model);
 return{revision:topology.revision||0,joinCount:(topology.joins||[]).length,cornerCount:(topology.joins||[]).filter(j=>j.kind==='corner').length,teeCount:(topology.joins||[]).filter(j=>j.kind==='tee').length};
}
