import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRoomBoundaries} from '../renderer/room-boundaries.mjs';
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
