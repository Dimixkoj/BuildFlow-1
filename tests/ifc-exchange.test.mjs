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
 const openingLine=ifc.split(String.fromCharCode(10)).find(line=>line.includes('=IFCOPENINGELEMENT(')),voidLine=ifc.split(String.fromCharCode(10)).find(line=>line.includes('=IFCRELVOIDSELEMENT(')),fillLine=ifc.split(String.fromCharCode(10)).find(line=>line.includes('=IFCRELFILLSELEMENT('));
 const openingRef=openingLine?.slice(0,openingLine.indexOf('=')),voidArgs=voidLine?.slice(voidLine.indexOf('(')+1,voidLine.lastIndexOf(')')),fillArgs=fillLine?.slice(fillLine.indexOf('(')+1,fillLine.lastIndexOf(')'));
 assert.ok(openingRef&&voidArgs?.endsWith(','+openingRef),'void relationship must reference a separate IFC opening element');
 assert.ok(fillArgs?.includes(openingRef+','),'fill relationship must link the opening to its door/window');
 const imported=importIFC(ifc);
 const host=imported.elements.find(e=>e.id==='host'),door=imported.elements.find(e=>e.id==='door-1');
 assert.ok(host);assert.equal(host.wallRole,'external');assert.equal(host.layers.length,2);
 assert.equal(door.hostId,'host');
 assert.ok(imported.wallTopology.overrides.some(o=>o.wallId==='branch'&&o.otherWallId==='host'));
});

test('IFC roundtrip preserves multiple storeys and interior wall connections as BIM relationships',()=>{
 const model={id:'multi-storey',title:'Multi-storey test',units:'m',levels:[{id:'L0',name:'Ground Floor',elevation:0,height:3},{id:'L1',name:'First Floor',elevation:3,height:3},{id:'L2',name:'Second Floor',elevation:6,height:3}],elements:[
  {id:'ground-wall',type:'wall',x:0,y:0,z:0,length:6,width:.2,height:3,rotation:0,baseLevelId:'L0',layers:[{id:'core',kind:'core',material:'Blockwork',thickness:.2}]},
  {id:'first-wall',type:'wall',x:0,y:0,z:3,length:6,width:.2,height:3,rotation:0,baseLevelId:'L1'},
  {id:'multi-wall',type:'wall',x:10,y:0,z:0,length:6,width:.2,height:6,rotation:0,baseLevelId:'L0',topLevelId:'L2'}
 ],wallTopology:{schemaVersion:1,revision:1,joins:[],overrides:[],connections:[{id:'cross-1',wallId:'ground-wall',otherWallId:'first-wall',endpoint:'interior',kind:'vertical-trace',mode:'trace',point:{x:0,y:0},continuationWallId:'first-wall'}]}};
 const ifc=exportIFC(model);
 assert.equal((ifc.match(/IFCBUILDINGSTOREY\(/g)||[]).length,3);
 assert.match(ifc,/IFCMATERIALLAYERSET/);
 const imported=importIFC(ifc);
 assert.equal(imported.levels.length,3);
 assert.equal(imported.elements.find(e=>e.id==='ground-wall').baseLevelId,'ifc-level:'+((ifc.match(/#(\d+)=IFCBUILDINGSTOREY/)||[])[1]));
 assert.ok(imported.wallTopology.connections.some(x=>x.endpoint==='interior'&&x.kind==='vertical-trace'));
 assert.ok(ifc.includes('IFCRELREFERENCEDINSPATIALSTRUCTURE('));
 assert.ok(imported.elements.find(e=>e.id==='multi-wall').referenceLevelIds.includes(imported.levels[1].id));
 assert.equal(imported.elements.find(e=>e.id==='multi-wall').topLevelId,'L2');
});

test('IFC roundtrip exports room spaces with storey and wall-boundary relationships',()=>{
 const boundary=[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}];
 const model={title:'Space exchange',levels:[{id:'L0',name:'Ground',elevation:0,height:3}],elements:[{id:'w1',type:'wall',x:2,y:0,length:4,width:.2,height:3,z:0,rotation:0,baseLevelId:'L0'}],roomSpaces:[{id:'manual-space',label:'Meeting room',levelId:'L0',boundary,wallIds:['w1'],areaOverride:12,height:3}]};
 const ifc=exportIFC(model);
 assert.ok(ifc.includes('IFCSPACE('));
 assert.ok(ifc.includes('IFCRELSPACEBOUNDARY('));
 const imported=importIFC(ifc),room=imported.roomSpaces.find(x=>x.id==='manual-space');
 assert.ok(room);
 assert.equal(room.levelId,imported.levels[0].id);
 assert.equal(room.areaOverride,12);
 assert.deepEqual(room.boundary,boundary);
 assert.deepEqual(room.wallIds,['w1']);
});
