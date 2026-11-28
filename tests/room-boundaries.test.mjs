import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoomBoundaries,setManualRoomSpace,deleteManualRoomSpace,resolveManualRoomSpaces} from '../renderer/room-boundaries.mjs';
const wall=(id,x,y,length,rotation)=>({id,type:'wall',x,y,z:0,length,width:.2,height:3,rotation,visible:true});
test('detects an enclosed room and measures the inside wall-face area',()=>{
 const model={elements:[wall('south',2,0,4,0),wall('east',4,2,4,90),wall('north',2,4,4,0),wall('west',0,2,4,90)]};
 const rooms=resolveRoomBoundaries(model);
 assert.equal(rooms.length,1);
 assert.ok(Math.abs(rooms[0].area-14.44)<.02);
 assert.deepEqual(new Set(rooms[0].wallIds),new Set(['south','east','north','west']));
});
test('does not report an open three-wall enclosure as a room',()=>{
 const model={elements:[wall('south',2,0,4,0),wall('east',4,2,4,90),wall('north',2,4,4,0)]};
 assert.equal(resolveRoomBoundaries(model).length,0);
});

test('detects rooms independently on two storeys without joining their walls vertically',()=>{
 const levels=[{id:'L0',name:'Ground',elevation:0,height:3},{id:'L1',name:'First',elevation:3,height:3}];
 const make=(id,x,y,length,rotation,baseLevelId)=>({...wall(id,x,y,length,rotation),baseLevelId});
 const model={levels,elements:['south','east','north','west'].flatMap((side)=>{const data={south:[2,0,4,0],east:[4,2,4,90],north:[2,4,4,0],west:[0,2,4,90]}[side];return[make(side+'-g',...data,'L0'),make(side+'-f',...data,'L1')]})};
 const rooms=resolveRoomBoundaries(model);
 assert.equal(rooms.length,2);
 assert.deepEqual(new Set(rooms.map(r=>r.levelId)),new Set(['L0','L1']));
});
test('supports a curved manual room boundary and editable room records',()=>{
 const model={elements:[]};
 const space=setManualRoomSpace(model,{id:'atrium',label:'Curved atrium',levelId:'L0',boundary:[{type:'arc',center:{x:0,y:0},radius:2,startAngle:0,endAngle:180,segments:32},{x:-2,y:0}]});
 const room=resolveManualRoomSpaces(model,'L0')[0];
 assert.equal(space.id,'atrium');assert.ok(room.area>6.1&&room.area<6.4);
 assert.equal(deleteManualRoomSpace(model,'atrium'),true);
 assert.equal(resolveManualRoomSpaces(model).length,0);
});

test('detects a circular room from a curved wall boundary',()=>{
 const model={elements:[{id:'curved-perimeter',type:'wall',x:0,y:0,z:0,length:Math.PI*4,width:.2,height:3,rotation:0,curve:{type:'arc',center:{x:0,y:0},radius:2,startAngle:0,endAngle:360,segments:48}}]};
 const rooms=resolveRoomBoundaries(model);
 assert.equal(rooms.length,1);
 assert.ok(rooms[0].area>11.1&&rooms[0].area<11.5);
});
