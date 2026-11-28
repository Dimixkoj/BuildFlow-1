import test from 'node:test';
import assert from 'node:assert/strict';
import {computeWallJoinGeometry,snapGeometryPoint,transformSelection,rotateSelection,resizeElement,alignSelection,offsetElement,trimExtendElement,apply3DTransform,apply3DGroupTransform,attachOpeningToWall,constrainHostedOpening,syncHostedOpeningsAfterWallTransform} from '../renderer/geometry-editing.mjs';
const wall=(id,x,y,length=4,rotation=0)=>({id,type:'wall',x,y,z:0,length,width:.2,height:3,rotation});
test('snaps to grid and nearby geometry points',()=>{const p=snapGeometryPoint(1.01,.99,[wall('w',2,1)],.2,true,.2);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(snapGeometryPoint(1.01,.99,[],.2,false).x,1.01)});
test('moves a selected wall and hosted opening together',()=>{const w=wall('w',0,0),d={id:'d',type:'door',hostId:'w',x:0,y:0};const m={elements:[w,d,wall('other',4,0)]};const r=transformSelection(m,['w'],1,2);assert.equal(r.ok,true);assert.equal(w.x,1);assert.equal(d.y,2)});
test('rotates a selected group around its centroid',()=>{const m={elements:[wall('a',0,0),wall('b',2,0)]};rotateSelection(m,['a','b'],90);assert.ok(Math.abs(m.elements[0].y+1)<1e-8);assert.ok(Math.abs(m.elements[1].y-1)<1e-8)});
test('resizes a parametric dimension',()=>{const m={elements:[wall('a',0,0)]};const r=resizeElement(m,'a','length',1.1);assert.equal(r.ok,true);assert.equal(m.elements[0].length,4.4)});
test('aligns selected object centres on X',()=>{const m={elements:[wall('a',0,0),wall('b',2,4)]};alignSelection(m,['a','b'],'x','center');assert.equal(m.elements[1].x,0)});
test('creates a parallel offset copy',()=>{const m={elements:[wall('a',0,0)]};const r=offsetElement(m,'a',.5,1);assert.equal(r.ok,true);assert.equal(m.elements.length,2);assert.ok(Math.abs(m.elements[1].y-.5)<1e-8)});
test('trims a line to a crossing boundary',()=>{const m={elements:[wall('target',0,0,6),wall('boundary',2.5,0,.2,90)]};const r=trimExtendElement(m,'target','boundary','trim');assert.equal(r.ok,true);assert.ok(m.elements[0].length<6)});
test('extends a line to a boundary beyond its endpoint',()=>{const m={elements:[wall('target',0,0,4),wall('boundary',3,0,.2,90)]};const r=trimExtendElement(m,'target','boundary','extend');assert.equal(r.ok,true);assert.ok(m.elements[0].length>4)});

test('maps 3D gizmo transforms back into parametric model dimensions',()=>{const e=wall('3d',0,0);const base={...e};apply3DTransform(e,{position:{x:4,y:2,z:-3},rotation:{y:Math.PI/2},scale:{x:2,y:3,z:.5}},base);assert.equal(e.x,4);assert.equal(e.z,2);assert.equal(e.y,-3);assert.equal(e.length,8);assert.equal(e.height,9);assert.equal(e.width,.1);assert.equal(e.rotation,-90)});

test('keeps a hosted opening centred on its wall after movement',()=>{const w=wall('host',0,0,4,0);const d={id:'door',type:'door',hostId:'host',x:1,y:.4,z:0,length:1,width:.08,height:2,rotation:0};const m={elements:[w,d]};const r=constrainHostedOpening(m,'door');assert.equal(r.ok,true);assert.ok(Math.abs(d.y)<1e-8);assert.equal(d.x,1);assert.equal(d.rotation,0)});
test('clamps hosted openings within wall end limits',()=>{const w=wall('host',0,0,4,0);const d={id:'door',type:'door',hostId:'host',x:9,y:0,z:0,length:1,width:.08,height:2,rotation:0};const m={elements:[w,d]};constrainHostedOpening(m,'door');assert.equal(d.x,1.5)});

test('moves hosted openings with a transformed wall in 3D',()=>{const oldWall=wall('host',0,0,4,0),oldDoor={id:'door',type:'door',hostId:'host',x:1,y:0,z:0,length:1,width:.08,height:2,rotation:0};const baseline={elements:[{...oldWall},{...oldDoor}]};const model={elements:[{...oldWall,x:2,y:3,rotation:90},{...oldDoor}]};const r=syncHostedOpeningsAfterWallTransform(model,'host',baseline);assert.equal(r.ok,true);assert.ok(Math.abs(model.elements[1].x-2)<1e-8);assert.ok(Math.abs(model.elements[1].y-4)<1e-8);assert.equal(model.elements[1].rotation,90)});

test('applies a 3D group translation and rotation around its shared pivot',()=>{
 const a=wall('a',0,0),b=wall('b',2,0),baseline={elements:[{...a},{...b}]},model={elements:[{...a},{...b}]};
 const r=apply3DGroupTransform(model,['a','b'],{position:{x:5,y:0,z:2},rotation:{y:Math.PI/2},scale:{x:1,y:1,z:1}},baseline,{x:1,y:0,z:0});
 assert.equal(r.ok,true);assert.equal(r.changed,2);
 assert.ok(Math.abs(model.elements[0].x-5)<1e-8);assert.ok(Math.abs(model.elements[0].y-3)<1e-8);
 assert.ok(Math.abs(model.elements[1].x-5)<1e-8);assert.ok(Math.abs(model.elements[1].y-1)<1e-8);
 assert.equal(model.elements[0].rotation,-90);
});
test('scales selected group members in all three parametric dimensions',()=>{
 const a=wall('a',0,0),baseline={elements:[{...a}]},model={elements:[{...a}]};
 const r=apply3DGroupTransform(model,['a'],{position:{x:0,y:0,z:0},rotation:{y:0},scale:{x:2,y:3,z:.5}},baseline,{x:0,y:0,z:0});
 assert.equal(r.ok,true);assert.equal(model.elements[0].length,8);assert.equal(model.elements[0].height,9);assert.equal(model.elements[0].width,.1);
});

test('attaches an opening to a wall centreline and clamps it inside the wall',()=>{
 const w=wall('host',0,0,4,90),d={id:'door',type:'door',hostId:null,x:0.2,y:9,z:-1,length:1,width:.08,height:2,rotation:0},model={elements:[w,d]};
 const r=attachOpeningToWall(model,'door');
 assert.equal(r.ok,true);assert.equal(d.hostId,'host');assert.equal(d.rotation,90);
 assert.ok(Math.abs(d.x)<1e-8);assert.ok(Math.abs(d.y-1.5)<1e-8);assert.equal(d.z,0);
});
test('rejects an opening that cannot fit its selected host wall',()=>{
 const w=wall('short',0,0,1),d={id:'window',type:'window',x:0,y:0,z:0,length:1.2,width:.08,height:1,rotation:0},model={elements:[w,d]};
 const r=attachOpeningToWall(model,'window','short');assert.equal(r.ok,false);assert.match(r.reason,/larger than its host wall/);
});
test('resolves an L-corner by trimming the terminating wall to the host face',()=>{
 const host=wall('host',0,0,4,90),end=wall('end',-2.1,0,4,0);
 const r=computeWallJoinGeometry(end,[host,end]);
 assert.ok(Math.abs(r.startTrim-.1)<1e-8);assert.equal(r.endTrim,0);
 assert.ok(Math.abs(r.length-3.9)<1e-8);
});
test('resolves a T-junction without shortening the through-wall',()=>{
 const through=wall('through',0,0,6,0),tee=wall('tee',0,1.1,2,90);
 const r=computeWallJoinGeometry(tee,[through,tee]);
 assert.ok(Math.abs(r.startTrim-.1)<1e-8);assert.ok(Math.abs(r.endTrim-.1)<1e-8);
 const host=computeWallJoinGeometry(through,[through,tee]);
 assert.equal(host.startTrim,0);assert.equal(host.endTrim,0);
});
test('does not alter parallel walls or an interior cross-junction',()=>{
 const a=wall('a',0,0,4,0),parallel=wall('b',0,.4,4,0),crossing=wall('c',0,0,4,90);
 const p=computeWallJoinGeometry(a,[a,parallel]);assert.equal(p.length,4);
 const x=computeWallJoinGeometry(a,[a,crossing]);assert.equal(x.length,4);
});
