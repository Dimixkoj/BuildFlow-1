import test from 'node:test';
import assert from 'node:assert/strict';
import {snapGeometryPoint,transformSelection,rotateSelection,resizeElement,alignSelection,offsetElement,trimExtendElement,apply3DTransform} from '../renderer/geometry-editing.mjs';
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
