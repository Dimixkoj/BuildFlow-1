import test from 'node:test';
import assert from 'node:assert/strict';
import {exportIFC,importIFC} from '../renderer/ifc-exchange.js';
import {rebuildWallTopology} from '../renderer/wall-topology.mjs';

test('IFC exchange preserves wall connection relationships, IDs, layers and hosted openings',()=>{
 const model={id:'roundtrip',title:'IFC roundtrip',units:'m',elements:[
  {id:'host',type:'wall',label:'Host wall',x:0,y:0,z:0,length:5,width:.3,height:3,rotation:90,joinPriority:40,wallRole:'external',layers:[{id:'core',kind:'core',material:'Blockwork',thickness:.2},{id:'render',kind:'finish',material:'Render',thickness:.1}]},
  {id:'branch',type:'wall',label:'Branch wall',x:-2.35,y:0,z:0,length:4.7,width:.3,height:3,rotation:0},
  {id:'door-1',type:'door',label:'Door',x:0,y:0,z:0,length:.9,width:.08,height:2.1,rotation:90,hostId:'host'}
 ]};
 rebuildWallTopology(model);
 const ifc=exportIFC(model);
 assert.match(ifc,/IFCRELCONNECTSELEMENTS/);
 assert.match(ifc,/IFCRELVOIDSELEMENT/);
 assert.match(ifc,/IFCRELFILLSELEMENT/);
 const imported=importIFC(ifc);
 const host=imported.elements.find(e=>e.id==='host'),door=imported.elements.find(e=>e.id==='door-1');
 assert.ok(host);assert.equal(host.wallRole,'external');assert.equal(host.layers.length,2);
 assert.equal(door.hostId,'host');
 assert.ok(imported.wallTopology.overrides.some(o=>o.wallId==='branch'&&o.otherWallId==='host'));
});
