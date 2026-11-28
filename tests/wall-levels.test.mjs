import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseBuildingLevels,wallVerticalSpan,wallsShareVerticalExtent,traceWallsAcrossLevels,levelWallGraph,elementOnLevel} from '../renderer/wall-levels.mjs';
import {rebuildWallTopology} from '../renderer/wall-topology.mjs';
import {resolveWallJunctionClusters} from '../renderer/wall-junctions.mjs';
const levels=[{id:'L0',name:'Ground',elevation:0,height:3,order:0},{id:'L1',name:'First',elevation:3,height:3,order:1},{id:'L2',name:'Second',elevation:6,height:3,order:2}];
const wall=(id,baseLevelId,extra={})=>({id,type:'wall',x:0,y:0,z:0,length:6,width:.2,height:3,rotation:0,baseLevelId,...extra});
test('resolves wall vertical extents from storey datums',()=>{const m={levels,elements:[]};assert.deepEqual(wallVerticalSpan(wall('a','L1'),m),{baseLevelId:'L1',topLevelId:null,zMin:3,zMax:6,baseElevation:3,topElevation:6})});
test('only walls with overlapping vertical extents can form same-node junctions',()=>{const m={levels,elements:[]};assert.equal(wallsShareVerticalExtent(wall('a','L0'),wall('b','L1'),m),false);assert.equal(wallsShareVerticalExtent(wall('a','L0',{height:4}),wall('b','L1'),m),true)});
test('traces aligned walls across adjacent levels and records layer changes',()=>{const layers=[{id:'core',kind:'core',material:'Block',thickness:.2}];const m={levels,elements:[wall('ground','L0',{layers}),wall('first','L1',{layers:[...layers,{id:'render',kind:'finish',material:'Render',thickness:.02}]})]};const t=traceWallsAcrossLevels(m);assert.equal(t.length,1);assert.equal(t[0].continuity,'continuous');assert.equal(t[0].layerContinuity,'changed');assert.equal(t[0].layerChanges.length,1)});
test('builds a per-level wall graph',()=>{const m={levels,elements:[wall('g','L0'),wall('f','L1')]};assert.deepEqual(levelWallGraph(m).map(x=>x.walls),[['g'],['f'],[]])});

test('does not create same-plan junctions between vertically separated storey walls',()=>{
 const model={levels,elements:[wall('ground','L0'),wall('first','L1',{rotation:90,x:0,y:0})]};
 assert.equal(rebuildWallTopology(model).joins.length,0);
 assert.equal(resolveWallJunctionClusters(model).length,0);
});

test('reports finish wrap and join behaviour changes between storeys',()=>{
 const a=[{id:'core',kind:'core',material:'Block',thickness:.2,joinBehaviour:'miter',wrapAtJunction:false}];
 const b=[{id:'core',kind:'core',material:'Block',thickness:.2,joinBehaviour:'butt',wrapAtJunction:true}];
 const model={levels,elements:[wall('before','L0',{layers:a}),wall('after','L1',{layers:b})]};
 const trace=traceWallsAcrossLevels(model)[0];
 assert.equal(trace.layerContinuity,'changed');
 assert.ok(trace.layerChanges.some(x=>x.key==='core'&&x.from.joinBehaviour==='miter'&&x.to.joinBehaviour==='butt'));
});

test('tracks one continuous wall through every occupied storey without assigning it to the level above its top',()=>{
 const m={levels,elements:[wall('multi','L0',{topLevelId:'L2',height:6})]};
 const trace=traceWallsAcrossLevels(m).find(x=>x.id==='wall-span:multi');
 assert.deepEqual(trace.occupiedLevelIds,['L0','L1']);
 assert.equal(elementOnLevel(m.elements[0],m,'L1'),true);
 assert.equal(elementOnLevel(m.elements[0],m,'L2'),false);
 assert.deepEqual(levelWallGraph(m).map(x=>x.walls),[['multi'],['multi'],[]]);
});

test('hosted openings remain on their own storey when the host wall spans multiple floors',()=>{
 const model={levels,elements:[wall('multi','L0',{topLevelId:'L2',height:6}),{id:'door',type:'door',x:0,y:0,z:0,length:1,width:.08,height:2,rotation:0,hostId:'multi'}]};
 assert.equal(elementOnLevel(model.elements[1],model,'L0'),true);
 assert.equal(elementOnLevel(model.elements[1],model,'L1'),false);
});
