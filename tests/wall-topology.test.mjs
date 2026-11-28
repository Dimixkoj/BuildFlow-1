import test from 'node:test';
import assert from 'node:assert/strict';
import {computeWallJoinGeometry,wallFootprint,wallMetrics,rebuildWallTopology,wallTopologySummary} from '../renderer/wall-topology.mjs';

const wall=(id,x,y,length=4,rotation=0,width=.2)=>({id,type:'wall',x,y,z:0,length,width,height:3,rotation});

test('persists deterministic corner relationships and stable revision',()=>{
 const a=wall('a',-2,0),b=wall('b',0,2,4,90),model={elements:[a,b]};
 const first=rebuildWallTopology(model),ids=first.joins.map(j=>j.id);
 assert.ok(first.joins.some(j=>j.wallId==='a'&&j.otherWallId==='b'&&j.kind==='corner'));
 const revision=first.revision;const second=rebuildWallTopology(model);
 assert.equal(second.revision,revision);assert.deepEqual(second.joins.map(j=>j.id),ids);
});

test('rebuilds persistent join relationships after wall move, rotation and extension',()=>{
 const host=wall('host',0,2,4,90),end=wall('end',-2,0,4,0),model={elements:[host,end]};
 const before=rebuildWallTopology(model),oldTrim=before.joins.find(j=>j.wallId==='end')?.trim;
 end.x=-1.9;
 const resized=rebuildWallTopology(model),newTrim=resized.joins.find(j=>j.wallId==='end')?.trim;
 assert.ok(resized.revision>before.revision);assert.ok(newTrim>oldTrim);end.x=-2;end.length=4.4;const extended=rebuildWallTopology(model);assert.ok(extended.revision>resized.revision);assert.ok(extended.joins.find(j=>j.wallId==='end').trim>newTrim);
 end.rotation=5;const rotated=rebuildWallTopology(model);assert.ok(rotated.revision>extended.revision);
});

test('resolves T-junctions without cutting the through wall',()=>{
 const through=wall('through',0,0,8,0),tee=wall('tee',0,1,2,90);
 const t=computeWallJoinGeometry(tee,[through,tee]),h=computeWallJoinGeometry(through,[through,tee]);
 assert.ok(t.startTrim>0);assert.equal(t.endTrim,0);assert.equal(h.startTrim,0);assert.equal(h.endTrim,0);
});

test('supports a multi-wall node with more than one relationship at an endpoint',()=>{
 const end=wall('end',-1.8,0,4,0),host1=wall('host1',0,0,5,90),host2=wall('host2',0,0,5,135);
 const model={elements:[end,host1,host2]},topology=rebuildWallTopology(model);
 const links=topology.joins.filter(j=>j.wallId==='end'&&j.endpoint==='end');
 assert.equal(links.length,2);
 const g=computeWallJoinGeometry(end,model.elements);
 assert.ok(g.endTrim>0);assert.ok(g.endCut.every(Number.isFinite));
});

test('leaves parallel overlaps and interior crossings unjoined',()=>{
 const a=wall('a',0,0,4,0),parallel=wall('parallel',0,.3,4,0),cross=wall('cross',0,0,4,90);
 assert.equal(computeWallJoinGeometry(a,[a,parallel]).joins.length,0);
 assert.equal(computeWallJoinGeometry(a,[a,cross]).joins.length,0);
});

test('wall footprint and metrics reflect mitered corner geometry',()=>{
 const host=wall('host',0,0,4,90),end=wall('end',-1.8,0,4,0),m=wallMetrics(end,[host,end]),p=wallFootprint(end,[host,end]);
 assert.equal(p.length,4);assert.ok(m.planArea<end.length*end.width);assert.ok(m.effectiveLength<end.length);
});

test('topology summary reports resolved relationship types',()=>{
 const model={elements:[wall('through',0,0,8,0),wall('tee',0,1,2,90)]};
 rebuildWallTopology(model);const summary=wallTopologySummary(model);
 assert.equal(summary.joinCount,1);assert.equal(summary.teeCount,1);
});

test('keeps a persistent relationship when the wall endpoint already meets the host face',()=>{
 const host=wall('host',0,0,4,90),end=wall('end',-2.1,0,4,0),model={elements:[host,end]};
 const topology=rebuildWallTopology(model),join=topology.joins.find(j=>j.wallId==='end'&&j.otherWallId==='host');
 assert.ok(join);assert.ok(join.trim<1e-8);
 const geometry=computeWallJoinGeometry(end,[host,end]);assert.ok(geometry.endTrim<1e-8);
});

test('higher-priority wall continues through a corner and lower-priority wall trims',()=>{
 const primary=wall('primary',-2,0,4,0,.2),secondary=wall('secondary',0,2,4,90,.2);
 primary.joinPriority=100;secondary.joinPriority=10;
 const a=computeWallJoinGeometry(primary,[primary,secondary]);
 const b=computeWallJoinGeometry(secondary,[primary,secondary]);
 assert.equal(a.endTrim,0);assert.ok(b.startTrim>0);
});
