import { rebuildWallTopology } from './wall-topology.mjs';

const EPS=1e-7,rad=d=>(Number(d)||0)*Math.PI/180;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const mul=(a,s)=>({x:a.x*s,y:a.y*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const signedArea=p=>p.reduce((s,v,i)=>{const n=p[(i+1)%p.length];return s+v.x*n.y-n.x*v.y},0)/2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lineIntersection=(p,d,q,e)=>{const den=cross(d,e);if(Math.abs(den)<EPS)return null;const t=cross(sub(q,p),e)/den;return add(p,mul(d,t))};
const keyPoint=p=>Math.round(p.x*1e5)+','+Math.round(p.y*1e5);

function segmentHit(a,b,c,d){
 const r=sub(b,a),s=sub(d,c),den=cross(r,s);if(Math.abs(den)<EPS)return null;
 const q=sub(c,a),t=cross(q,s)/den,u=cross(q,r)/den;
 if(t< -EPS||t>1+EPS||u< -EPS||u>1+EPS)return null;
 return{point:add(a,mul(r,Math.max(0,Math.min(1,t)))),t,u};
}
function wallSegment(w){
 const a=rad(w.rotation),u={x:Math.cos(a),y:Math.sin(a)},h=w.length/2;
 return{wall:w,a:{x:w.x-u.x*h,y:w.y-u.y*h},b:{x:w.x+u.x*h,y:w.y+u.y*h}};
}
function offsetInnerPolygon(points,edgeWidths){
 const ccw=signedArea(points)>0?points:[...points].reverse(),widths=signedArea(points)>0?edgeWidths:[...edgeWidths].reverse();
 const lines=ccw.map((p,i)=>{const q=ccw[(i+1)%ccw.length],d=sub(q,p),len=Math.hypot(d.x,d.y)||1,n={x:-d.y/len,y:d.x/len},off=widths[i]/2;return{p:add(p,mul(n,off)),d}});
 return ccw.map((p,i)=>{const prev=lines[(i+lines.length-1)%lines.length],next=lines[i];return lineIntersection(prev.p,prev.d,next.p,next.d)||p});
}
function canonicalCycle(ids){const variants=[];for(const seq of [ids,[...ids].reverse()])for(let i=0;i<seq.length;i++)variants.push([...seq.slice(i),...seq.slice(0,i)].join('>'));return variants.sort()[0]}

/**
 * Finds bounded faces in the planar wall-centreline graph, then offsets each
 * face to the room-side wall finish faces. Areas are plan areas in model units.
 */
export function resolveRoomBoundaries(model,{minimumArea=.25,tolerance=.015}={}){
 const walls=(model?.elements||[]).filter(e=>e?.type==='wall'&&e.visible!==false&&Number(e.length)>0&&Number(e.width)>0);
 if(walls.length<3)return[];
 rebuildWallTopology(model);
 const segments=walls.map(wallSegment),cuts=segments.map(s=>[{t:0,point:s.a},{t:1,point:s.b}]);
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const hit=segmentHit(segments[i].a,segments[i].b,segments[j].a,segments[j].b);if(!hit)continue;
  cuts[i].push({t:hit.t,point:hit.point});cuts[j].push({t:hit.u,point:hit.point});
 }
 const nodes=new Map(),edges=[],adj=new Map();
 const nodeId=p=>{const k=keyPoint(p);if(!nodes.has(k))nodes.set(k,{id:k,point:p});return k};
 for(let i=0;i<segments.length;i++){
  const s=segments[i],unique=cuts[i].sort((a,b)=>a.t-b.t).filter((v,k,a)=>k===0||Math.abs(v.t-a[k-1].t)>tolerance);
  for(let j=0;j<unique.length-1;j++){
   const a=nodeId(unique[j].point),b=nodeId(unique[j+1].point);if(a===b)continue;
   const id=edges.length;edges.push({id,a,b,wallId:s.wall.id,width:s.wall.width});
   if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);
   adj.get(a).push({edge:id,to:b,angle:Math.atan2(nodes.get(b).point.y-nodes.get(a).point.y,nodes.get(b).point.x-nodes.get(a).point.x)});
   adj.get(b).push({edge:id,to:a,angle:Math.atan2(nodes.get(a).point.y-nodes.get(b).point.y,nodes.get(a).point.x-nodes.get(b).point.x)});
  }
 }
 for(const list of adj.values())list.sort((a,b)=>a.angle-b.angle);
 const visited=new Set(),faces=[];
 for(const edge of edges)for(const direction of [[edge.a,edge.b],[edge.b,edge.a]]){
  const start=direction.join('>');if(visited.has(start))continue;
  let from=direction[0],to=direction[1],cycle=[],boundary=[],guard=0;
  while(guard++<edges.length*2+4){
   const directed=from+'>'+to;if(visited.has(directed))break;visited.add(directed);cycle.push(from);
   const edgeId=adj.get(from)?.find(x=>x.to===to)?.edge;if(edgeId===undefined)break;boundary.push(edges[edgeId]);
   const options=adj.get(to)||[],reverseIndex=options.findIndex(x=>x.to===from);if(reverseIndex<0)break;
   const next=options[(reverseIndex-1+options.length)%options.length];from=to;to=next.to;
   if(from===direction[0]&&to===direction[1])break;
  }
  if(cycle.length<3||from!==direction[0]||to!==direction[1])continue;
  const identity=canonicalCycle(cycle);if(faces.some(f=>f.identity===identity))continue;
  const points=cycle.map(id=>nodes.get(id).point),area=signedArea(points);if(area<=minimumArea)continue;
  const widths=boundary.map(e=>e.width),inner=offsetInnerPolygon(points,widths),netArea=Math.abs(signedArea(inner));
  if(netArea<=minimumArea||inner.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
  faces.push({identity,points,inner,area,netArea,perimeter:points.reduce((s,p,i)=>s+distance(p,points[(i+1)%points.length]),0),wallIds:[...new Set(boundary.map(e=>e.wallId))]});
 }
 return faces.sort((a,b)=>a.area-b.area).map((f,i)=>({id:'room:'+f.identity,label:'Room '+(i+1),boundary:f.inner,centrelineBoundary:f.points,centrelineArea:f.area,area:f.netArea,perimeter:f.perimeter,wallIds:f.wallIds,source:'joined-wall-faces',verified:false}));
}
