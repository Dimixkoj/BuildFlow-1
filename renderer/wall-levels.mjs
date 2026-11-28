const EPS=1e-6;
const rad=d=>(Number(d)||0)*Math.PI/180;
const unit=w=>({x:Math.cos(rad(w.rotation)),y:Math.sin(rad(w.rotation))});
const point=(w,s)=>{const u=unit(w);return{x:w.x+u.x*s,y:w.y+u.y*s}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normAngle=a=>{while(a>Math.PI/2)a-=Math.PI;while(a< -Math.PI/2)a+=Math.PI;return a};
export function normaliseBuildingLevels(model){
 const raw=Array.isArray(model?.levels)?model.levels:Array.isArray(model?.storeys)?model.storeys:[];
 const levels=raw.map((l,i)=>({id:String(l.id||l.levelId||'level-'+i),name:String(l.name||l.label||'Level '+(i+1)),elevation:Number(l.elevation??l.z??0),height:Number(l.height??3),order:Number(l.order??i)})).filter(l=>Number.isFinite(l.elevation)&&Number.isFinite(l.height)&&l.height>0).sort((a,b)=>a.elevation-b.elevation||a.order-b.order);
 return levels;
}
export function wallVerticalSpan(wall,model){
 const levels=normaliseBuildingLevels(model),base=levels.find(l=>l.id===wall.baseLevelId)||levels.find(l=>l.id===wall.levelId);
 const top=levels.find(l=>l.id===wall.topLevelId);
 const z0=base?base.elevation:Number(wall.z)||0;
 const z1=top?top.elevation:z0+(Number(wall.height)||3);
 return{baseLevelId:base?.id||wall.baseLevelId||wall.levelId||null,topLevelId:top?.id||wall.topLevelId||null,zMin:Math.min(z0,z1),zMax:Math.max(z0,z1),baseElevation:z0,topElevation:z1};
}
export function wallsShareVerticalExtent(a,b,model,tolerance=EPS){
 const A=wallVerticalSpan(a,model),B=wallVerticalSpan(b,model);
 return Math.min(A.zMax,B.zMax)-Math.max(A.zMin,B.zMin)>tolerance;
}
export function traceWallsAcrossLevels(model,{planTolerance=.12,angleTolerance=3,layerTolerance=.01}={}){
 const walls=(model?.elements||[]).filter(e=>e?.type==='wall'),levels=normaliseBuildingLevels(model),traces=[];
 const layerSignature=w=>(w.layers||[]).map(l=>[l.id||'',l.kind||'',l.material||'',Number(l.thickness)||0].join(':')).join('|');
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j],A=wallVerticalSpan(a,model),B=wallVerticalSpan(b,model);
  if(Math.abs(A.baseElevation-B.baseElevation)<EPS&&A.baseLevelId===B.baseLevelId)continue;
  const angle=Math.abs(normAngle(rad(a.rotation)-rad(b.rotation)))*180/Math.PI;if(angle>angleTolerance)continue;
  const ua=unit(a),pa=point(a,-a.length/2),pb=point(b,-b.length/2);
  const offset=Math.abs((b.x-pa.x)*(-ua.y)+(b.y-pa.y)*ua.x);
  const along=(b.x-a.x)*ua.x+(b.y-a.y)*ua.y;
  const overlap=Math.max(0,Math.min(a.length/2,along+b.length/2)-Math.max(-a.length/2,along-b.length/2));
  if(offset>planTolerance||overlap<Math.min(a.length,b.length)*.5)continue;
  const adjacent=Math.abs(A.topElevation-B.baseElevation)<=planTolerance||Math.abs(B.topElevation-A.baseElevation)<=planTolerance||Math.abs(A.baseElevation-B.baseElevation)>EPS;
  if(!adjacent)continue;
  const sameLayers=layerSignature(a)===layerSignature(b),layerChanges=[];
  const aa=a.layers||[],bb=b.layers||[];
  if(!sameLayers){const ids=new Set([...aa,...bb].map(l=>l.id||l.kind||l.material));for(const id of ids){const x=aa.find(l=>(l.id||l.kind||l.material)===id),y=bb.find(l=>(l.id||l.kind||l.material)===id);if(!x||!y||Math.abs((+x.thickness||0)-(+y.thickness||0))>layerTolerance||x.material!==y.material)layerChanges.push({key:id,from:x?{material:x.material,thickness:x.thickness}:null,to:y?{material:y.material,thickness:y.thickness}:null})}}
  const lower=A.baseElevation<=B.baseElevation?a:b,upper=lower===a?b:a,ls=lower===a?A:B,us=lower===a?B:A;
  traces.push({id:'wall-trace:'+lower.id+':'+upper.id,lowerWallId:lower.id,upperWallId:upper.id,lowerLevelId:ls.baseLevelId,upperLevelId:us.baseLevelId,planOffset:offset,angleDifference:angle,overlapLength:overlap,point:{x:(Math.max(a.x-ua.x*a.length/2,b.x-ub.x*b.length/2)+Math.min(a.x+ua.x*a.length/2,b.x+ub.x*b.length/2))/2,y:(a.y+b.y)/2},verticalGap:us.baseElevation-ls.topElevation,continuity:Math.abs(us.baseElevation-ls.topElevation)<=planTolerance?'continuous':'stepped-or-offset',layerContinuity:sameLayers?'matching':'changed',layerChanges,source:'level-aware-wall-trace'});
 }
 return traces.sort((a,b)=>a.lowerLevelId?.localeCompare(b.lowerLevelId||'')||a.id.localeCompare(b.id));
}
export function levelWallGraph(model){
 const levels=normaliseBuildingLevels(model);
 return levels.map(level=>({levelId:level.id,name:level.name,elevation:level.elevation,walls:(model.elements||[]).filter(w=>w.type==='wall'&&wallVerticalSpan(w,model).baseLevelId===level.id).map(w=>w.id)}));
}

export function wallJoinCandidates(wall,walls,model){
 return(walls||[]).filter(other=>other.id===wall.id||wallsShareVerticalExtent(wall,other,model));
}

export function elementLevelId(element,model){
 if(element?.type==='wall')return wallVerticalSpan(element,model).baseLevelId;
 if(element?.hostId){const host=(model?.elements||[]).find(e=>e.id===element.hostId&&e.type==='wall');if(host)return wallVerticalSpan(host,model).baseLevelId}
 if(element?.levelId)return element.levelId;
 const levels=normaliseBuildingLevels(model);if(!levels.length)return null;const z=Number(element?.z)||0;
 return levels.reduce((best,l)=>Math.abs(l.elevation-z)<Math.abs(best.elevation-z)?l:best,levels[0]).id;
}
