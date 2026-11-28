import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseBuildingLevels,wallVerticalSpan,wallsShareVerticalExtent,traceWallsAcrossLevels,levelWallGraph} from '../renderer/wall-levels.mjs';
const levels=[{id:'L0',name:'Ground',elevation:0,height:3,order:0},{id:'L1',name:'First',elevation:3,height:3,order:1},{id:'L2',name:'Second',elevation:6,height:3,order:2}];
const wall=(id,baseLevelId,extra={})=>({id,type:'wall',x:0,y:0,z:0,length:6,width:.2,height:3,rotation:0,baseLevelId,...extra});
test('resolves wall vertical extents from storey datums',()=>{const m={levels,elements:[]};assert.deepEqual(wallVerticalSpan(wall('a','L1'),m),{baseLevelId:'L1',topLevelId:null,zMin:3,zMax:6,baseElevation:3,topElevation:6})});
test('only walls with overlapping vertical extents can form same-node junctions',()=>{const m={levels,elements:[]};assert.equal(wallsShareVerticalExtent(wall('a','L0'),wall('b','L1'),m),false);assert.equal(wallsShareVerticalExtent(wall('a','L0',{height:4}),wall('b','L1'),m),true)});
test('traces aligned walls across adjacent levels and records layer changes',()=>{const layers=[{id:'core',kind:'core',material:'Block',thickness:.2}];const m={levels,elements:[wall('ground','L0',{layers}),wall('first','L1',{layers:[...layers,{id:'render',kind:'finish',material:'Render',thickness:.02}]})]};const t=traceWallsAcrossLevels(m);assert.equal(t.length,1);assert.equal(t[0].continuity,'continuous');assert.equal(t[0].layerContinuity,'changed');assert.equal(t[0].layerChanges.length,1)});
test('builds a per-level wall graph',()=>{const m={levels,elements:[wall('g','L0'),wall('f','L1')]};assert.deepEqual(levelWallGraph(m).map(x=>x.walls),[['g'],['f'],[]])});
