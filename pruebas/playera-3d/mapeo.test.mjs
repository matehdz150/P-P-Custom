// node --experimental-strip-types --test pruebas/playera-3d/mapeo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { areaEnMockup, esPlayera3D, PLAYERA, puntoPlayera, colocacionManga } from "../../apps/web/lib/prenda/mapeoPlayera.ts";
const cerca = (a, b) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);

test("el área del editor conserva escala, posición y márgenes en el mockup", () => {
	const mockup = {left:372.5, top:88.62, width:700, height:700*1984/2144};
	const area = {left:582, top:275, width:270, height:350};
	const mapped = areaEnMockup(area,mockup);
	cerca(mapped.left*mockup.width+mockup.left,area.left);
	cerca(mapped.top*mockup.height+mockup.top,area.top);
	cerca(mapped.width*mockup.width,area.width);
	cerca(mapped.height*mockup.height,area.height);
	cerca(mapped.width*PLAYERA.ancho/(mapped.height*PLAYERA.alto),area.width/area.height);
});

test("mover o escalar el mockup y el área juntos no recalibra el diseño", () => {
	const area={left:250,top:150,width:200,height:300};
	const mockup={left:100,top:50,width:700,height:648};
	const move=(r)=>({left:r.left*2+33,top:r.top*2-40,width:r.width*2,height:r.height*2});
	assert.deepEqual(areaEnMockup(move(area),move(mockup)),areaEnMockup(area,mockup));
});

test("espalda no invierte la lectura: la derecha del diseño sigue a la derecha de su cámara", () => {
	const front=puntoPlayera(0.65,0.4), back=puntoPlayera(0.65,0.4,true);
	cerca(front.x,-back.x); cerca(front.y,back.y);
	assert.ok(front.x>0 && back.x<0);
});

test("las mangas conservan longitud y caída del perfil, no crecen con el área de tinta", () => {
	const leftUpper=PLAYERA.contorno[2],leftLower=PLAYERA.contorno[3],armpit=PLAYERA.contorno[4];
	const rightUpper=PLAYERA.contorno[9],rightLower=PLAYERA.contorno[8];
	assert.ok(leftUpper[0]<leftLower[0] && leftLower[0]<armpit[0]);
	assert.ok(leftUpper[1]<leftLower[1]);
	cerca(leftUpper[1],rightUpper[1]); cerca(leftLower[1],rightLower[1]);
	assert.ok(Math.abs((leftLower[0]-leftUpper[0])-(rightUpper[0]-rightLower[0]))<0.005);
});

test("entrada incompleta falla sin centrar arbitrariamente; no habilitar prendas incompatibles", () => {
	assert.equal(areaEnMockup({left:0,top:0,width:10,height:20},{left:0,top:0,width:0,height:100}),null);
	assert.equal(esPlayera3D({name:'Playera básica',sides:['front','back']}),true);
	assert.equal(esPlayera3D({name:'Playera de cuello redondo',sides:['front','back','rightmanga','leftmanga'],forma:'plano'}),true);
	assert.equal(esPlayera3D({name:'Taza',sides:['wrap']}),false);
	assert.equal(esPlayera3D({name:'Playera',sides:['front','back','sleeve']}),false);
});

test("mangas del catálogo: escala física, proporción sin deformar y lateralidad de quien viste", () => {
	const frente={left:.3,top:.28,width:.387,height:.54};
	const medidas=[{sideKey:'front',widthCm:28,heightCm:35},{sideKey:'leftmanga',widthCm:9,heightCm:7},{sideKey:'rightmanga',widthCm:9,heightCm:7}];
	const left=colocacionManga('leftmanga',9/7,frente,medidas);
	const right=colocacionManga('rightmanga',9/7,frente,medidas);
	cerca(left.width/frente.width,9/28);
	cerca(left.width*PLAYERA.ancho/(left.height*PLAYERA.alto),9/7);
	cerca(left.width,right.width);
	assert.ok(left.left>.5 && right.left<.5);
	assert.equal(colocacionManga('leftmanga',9/7,frente,[]),null);
});
