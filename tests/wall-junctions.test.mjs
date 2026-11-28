import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWallJunctionClusters,wallPriority,setJunctionContinuation,normaliseWallLayers,resolveCompoundWallJoin,compoundWallMetrics,setWallJoinOverride} from '../renderer/wall-junctions.mjs';
const wall=(id,x,y,length=4,rotation=0,width=.3,extra={})=>({id,type:'wall',x,y,z:0,length,width,height:3,rotation,...extra});

test('groups three-wall endpoint relationships into one shared junction cluster',()=>{
 const model={elements:[wall('primary',-2,0,4,0,.3,{joinPriority:50}),wall('north',0,2,4,90),wall('south',0,-2,4,90)]};
 const clusters=resolveWallJunctionClusters(model);
 assert.ok(clusters.length>=1);
 const multi=clusters.find(c=>c.wallIds.length===3);
 assert.ok(multi,'expected one 3-wall cluster');
 assert.equal(multi.continuationWallId,'primary');
 assert.equal(new Set(multi.members.map(m=>m.wallId)).size,3);
});

test('wall type and explicit join priority determine continuation wall',()=>{
 const a=wall('a',0,0,4,0,.2,{wallRole:'primary'}),b=wall('b',0,0,4,90,.2,{joinPriority:900});
 assert.equal(wallPriority(b)>wallPriority(a),true);
});

test('manual continuation override is persistent and used by cluster solver',()=>{
 const model={elements:[wall('a',-2,0,4,0),wall('b',0,2,4,90)]};
 const c=resolveWallJunctionClusters(model)[0];
 setJunctionContinuation(model,c.wallIds,'b');
 const updated=resolveWallJunctionClusters(model).find(x=>x.id===c.id);
 assert.equal(updated.continuationWallId,'b');assert.equal(updated.manual,true);
});

test('manual join, unjoin and auto reset are stored without deleting wall geometry',()=>{
 const model={elements:[wall('a',0,0),wall('b',0,2,4,90)]};
 setWallJoinOverride(model,{wallId:'a',otherWallId:'b',endpoint:'end',mode:'unjoin'});
 assert.equal(model.wallTopology.overrides[0].mode,'unjoin');
 setWallJoinOverride(model,{wallId:'a',otherWallId:'b',endpoint:'end',mode:'auto'});
 assert.equal(model.wallTopology.overrides.length,0);
 assert.equal(model.elements.length,2);
});

test('normalises compound wall layers and checks aggregate thickness',()=>{
 const w=wall('layered',0,0,4,0,.3,{layers:[{id:'block',kind:'core',material:'Concrete block',thickness:.2},{id:'render',kind:'finish',material:'Cement render',thickness:.025},{id:'insulation',kind:'insulation',material:'EPS',thickness:.05},{id:'paint',kind:'finish',material:'Paint',thickness:.025}]});
 assert.equal(normaliseWallLayers(w).length,4);
 assert.equal(compoundWallMetrics(w).thicknessMatchesWidth,true);
 const join=resolveCompoundWallJoin(w,{endpoint:'end'});
 assert.equal(join.layerGeometry.length,4);
 assert.equal(join.layerGeometry.find(l=>l.id==='insulation').termination,'wrap');
});

test('rejects layer stacks that do not match the wall core width',()=>{
 const w=wall('bad',0,0,4,0,.3,{layers:[{kind:'core',thickness:.2}]});
 assert.throws(()=>resolveCompoundWallJoin(w,{endpoint:'end'}),/does not match wall width/);
});
