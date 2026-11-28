import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGeometry} from '../renderer/geometry-validation.mjs';
const wall={id:'w1',type:'wall',label:'External wall',x:0,y:0,z:0,length:5,width:.2,height:3,rotation:0};
const door={id:'d1',type:'door',label:'Front door',x:0,y:0,z:0,length:.9,width:.08,height:2.1,rotation:0,hostId:'w1'};
test('accepts a valid wall and hosted door',()=>{const r=validateGeometry({elements:[wall,door]});assert.equal(r.valid,true);assert.deepEqual(r.errors,[])});
test('rejects non-finite coordinates and non-positive dimensions',()=>{const bad={...wall,x:NaN,length:0};const r=validateGeometry({elements:[bad]});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('x must be a finite number')));assert.ok(r.errors.some(x=>x.includes('length must be greater than zero')))});
test('rejects duplicate object IDs',()=>{const r=validateGeometry({elements:[wall,{...wall,type:'column'}]});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('duplicate object ID')))});
test('rejects openings extending beyond the host wall',()=>{const r=validateGeometry({elements:[wall,{...door,x:2.5}]});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('extends beyond its host wall')))});
test('rejects openings outside host wall vertical limits',()=>{const r=validateGeometry({elements:[wall,{...door,z:1.2}]});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('exceeds host wall vertical limits')))});
test('rejects invalid roof pitch',()=>{const roof={id:'r1',type:'roof',x:0,y:0,z:3,length:6,width:5,height:.2,rotation:0,roofStyle:'gable',pitch:75};const r=validateGeometry({elements:[roof]});assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('roof pitch')))});

test('validates persistent wall join references against model walls',()=>{
 const host={...wall,id:'host',x:0,y:2,length:4,rotation:90},end={...wall,id:'end',x:-2,y:0,length:4,rotation:0};
 const model={elements:[host,end],wallTopology:{schemaVersion:1,revision:1,joins:[{id:'j1',wallId:'end',otherWallId:'host',endpoint:'end',trim:.1,point:{x:0,y:0}}]}};
 assert.equal(validateGeometry(model).valid,true);
 model.wallTopology.joins[0].otherWallId='missing';
 assert.ok(validateGeometry(model).errors.some(x=>x.includes('relationship references a missing wall')));
});

test('rejects compound wall layers whose thickness does not match wall width',()=>{
 const layered={...wall,layers:[{id:'core',kind:'core',thickness:.1},{id:'finish',kind:'finish',thickness:.05}]};
 const r=validateGeometry({elements:[layered]});
 assert.equal(r.valid,false);
 assert.ok(r.errors.some(x=>x.includes('layer thickness total must match wall width')));
});
