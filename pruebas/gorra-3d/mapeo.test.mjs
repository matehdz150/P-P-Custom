// node --test pruebas/gorra-3d/mapeo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const modulo = async (file, replacements = {}) => {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  for (const [from,to] of Object.entries(replacements)) code = code.replace(from,to);
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return {url, exports:await import(url)};
};
const {exports:map} = await modulo('../../apps/web/lib/prenda/mapeoGorra.ts');
const perspectiva = await modulo('../../apps/web/lib/prenda/perspectiva.ts');
const {exports:{invertir}} = await modulo('../../apps/web/lib/prenda/componer.ts', {'"./perspectiva"':JSON.stringify(perspectiva.url)});
// Calibración pública de la foto frontal del catálogo, leída el 7-09-2026.
const foto={lado:'front',url:'/medios'+map.REGISTRO_GORRA.foto,esquinas:[
  {x:.20559064716312056,y:.25300876102707126}, {x:.8063289561170213,y:.25830630248279624},
  {x:.8354249778368794,y:.5597280746960924}, {x:.18543605939716312,y:.5492997241337496},
]};
const k=perspectiva.exports.coeficientes(foto.esquinas), inv=invertir(k);
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('el registro selecciona la foto calibrada, no la primera ni la seleccionada',()=>{
  const otra={...foto,url:'/foto-lateral.png'};
  const a=map.referenciaDeGorra([otra,foto]), b=map.referenciaDeGorra([foto,otra]);
  assert.deepEqual(a,b);
  assert.equal(map.referenciaDeGorra([otra]),undefined);
  assert.equal(map.referenciaDeGorra([{...foto,esquinas:[{x:NaN,y:0}]}]),undefined);
  assert.notEqual(a.esquinas,foto.esquinas);
  assert.notEqual(a.esquinas[0],foto.esquinas[0]);
});
test('esquinas, centro, márgenes y cualquier punto interior coinciden con la foto',()=>{
  for(let y=0;y<=10;y++) for(let x=0;x<=10;x++) {
    const u=x/10,v=y/10,w=k.g*u+k.h*v+1;
    const photo={x:(k.a*u+k.b*v+k.c)/w,y:(k.d*u+k.e*v+k.f)/w};
    const uv=map.uvDeGorra(photo,inv);
    cerca((uv.u-.25)*2,u); cerca((.75-uv.v)*2,v);
  }
});
test('la proyección usa el GLB real, sin mutar la UV original ni depender de zoom',()=>{
  const glb=readFileSync(new URL('../../apps/web/public/modelos/gorra.glb',import.meta.url));
  assert.equal(createHash('sha256').update(glb).digest('hex'),'3f7d78ed5a6d104b4998f5840601f925f6d9655d39099751da43b13a80de6c10','El modelo cambió: revisar el registro con la foto');
  const jsonSize=glb.readUInt32LE(12), gltf=JSON.parse(glb.toString('utf8',20,20+jsonSize));
  const box={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity};
  for(const mesh of gltf.meshes) {
    const acc=gltf.accessors[mesh.primitives[0].attributes.POSITION], view=gltf.bufferViews[acc.bufferView];
    for(let i=0;i<acc.count;i++) {
      const offset=28+jsonSize+(view.byteOffset||0)+(acc.byteOffset||0)+i*(view.byteStride||12);
      const p=map.proyectarGorra(glb.readFloatLE(offset),glb.readFloatLE(offset+4),glb.readFloatLE(offset+8));
      box.x0=Math.min(box.x0,p.x);box.x1=Math.max(box.x1,p.x);
      box.y0=Math.min(box.y0,p.y);box.y1=Math.max(box.y1,p.y);
    }
  }
  const s=map.REGISTRO_GORRA.silueta;
  const top=map.puntoEnFotoGorra({x:box.x0,y:box.y1},box);
  const bottom=map.puntoEnFotoGorra({x:box.x1,y:box.y0},box);
  cerca(top.x,s.left);cerca(top.y,s.top);cerca(bottom.x,s.left+s.width);cerca(bottom.y,s.top+s.height);
  assert.ok(box.x1-box.x0>1 && box.y1-box.y0>1);
  assert.ok(Math.abs((box.y1-box.y0)/(box.x1-box.x0)-1155/1260)<1e-6,'La elevación debe conservar la proporción de la silueta');
  const THREE=require('three'),meshes=[];
  const accessor=index=>{
    const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],n=a.type==='VEC3'?3:1;
    const result=[];
    for(let i=0;i<a.count*n;i++) {
      const offset=28+jsonSize+(v.byteOffset||0)+(a.byteOffset||0)+i*4;
      result.push(a.componentType===5126?glb.readFloatLE(offset):glb.readUInt32LE(offset));
    }
    return result;
  };
  for(const m of gltf.meshes){const p=m.primitives[0],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(accessor(p.attributes.POSITION),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(accessor(p.attributes.NORMAL),3));g.setIndex(accessor(p.indices));const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.name=m.name;meshes.push(mesh);}
  const dir=new THREE.Vector3(0,Math.sin(map.REGISTRO_GORRA.elevacion),Math.cos(map.REGISTRO_GORRA.elevacion));
  // Toda el área, incluidos los extremos, debe alcanzar el panel con tinta,
  // no la visera ni una pieza sin UV (evita recortes silenciosos de logos grandes).
  for(let row=0;row<=4;row++) for(let col=0;col<=4;col++){
    const u=col/4,v=row/4,w=k.g*u+k.h*v+1;
    const px=(k.a*u+k.b*v+k.c)/w,py=(k.d*u+k.e*v+k.f)/w;
    const x=box.x0+(px-s.left)/s.width*(box.x1-box.x0),y=box.y1-(py-s.top)/s.height*(box.y1-box.y0);
    const origin=new THREE.Vector3(x,y*Math.cos(map.REGISTRO_GORRA.elevacion),-y*Math.sin(map.REGISTRO_GORRA.elevacion)).addScaledVector(dir,5);
    const hit=new THREE.Raycaster(origin,dir.clone().negate()).intersectObjects(meshes)[0];
    assert.ok(hit,`El punto ${u},${v} no alcanza la gorra`);
    if(hit.object.name!=='frente') {
      const g=hit.object.geometry,n=g.getAttribute('normal'),p=g.getAttribute('position'),t=[hit.face.a,hit.face.b,hit.face.c];
      const ny=t.reduce((s,i)=>s+n.getY(i),0)/3,nz=t.reduce((s,i)=>s+n.getZ(i),0)/3,z=t.reduce((s,i)=>s+p.getZ(i),0)/3;
      assert.ok(map.superficieFrontalGorra(ny,nz,z),`El punto ${u},${v} queda fuera del panel: ${JSON.stringify({ny,nz,z,hit:hit.point})}`);
    }
  }
});
test('fuera del área queda margen liso, no repetición de la última letra',()=>{
  for(const u of [-.2,1.2]) {
    const v=.5,w=k.g*u+k.h*v+1;
    const p={x:(k.a*u+k.b*v+k.c)/w,y:(k.d*u+k.e*v+k.f)/w};
    const uv=map.uvDeGorra(p,inv);
    assert.ok(uv.u<.25||uv.u>.75);
  }
});
