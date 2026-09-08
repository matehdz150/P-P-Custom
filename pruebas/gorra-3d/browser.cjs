/* Requiere pnpm dev y Playwright con Chromium. No agrega al carrito ni escribe
 * datos de catálogo. PLAYWRIGHT_MODULE permite usar una instalación aislada. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const output = mkdtempSync(join(tmpdir(), 'kustto-gorra-regresion-'));
const base = process.env.PREVIEW_URL || 'http://localhost:3000';
async function tinta(page, png) {
  return page.evaluate(async data => {
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width=img.width;c.height=img.height;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    const bands=[];let band=null;
    // Sólo el centro del visor: excluye toolbars y texto del aviso inferior.
    for(let y=Math.floor(c.height*.2);y<c.height*.65;y++) {
      let count=0,x0=Infinity,x1=-Infinity;
      for(let x=Math.floor(c.width*.2);x<c.width*.8;x++) {
      const i=(y*c.width+x)*4;
      if(d[i+3]>200 && Math.max(d[i],d[i+1],d[i+2])<90) {
        x0=Math.min(x0,x);x1=Math.max(x1,x);count++;
      }
      }
      if(!count) {band=null;continue;}
      if(!band) {band={x0,x1,y0:y,y1:y,count:0};bands.push(band);}
      band.x0=Math.min(band.x0,x0);band.x1=Math.max(band.x1,x1);band.y1=y;band.count+=count;
    }
    // Los ojales oscuros de la foto no son parte del texto de prueba.
    const {x0,x1,y0,y1}=bands.sort((a,b)=>b.count-a.count)[0]||{};
    return {width:x1-x0+1,height:y1-y0+1,cx:(x0+x1)/2,cy:(y0+y1)/2};
  }, 'data:image/png;base64,'+png.toString('base64'));
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/design/?id=fef3cb1d-5c43-49cf-b5ad-6dfc3209fe9c');
    await page.getByRole('button',{name:'Probar',exact:true}).waitFor({timeout:60000});
    await page.getByRole('button',{name:'Texto',exact:true}).click();
    await page.getByRole('button',{name:'Inter',exact:true}).click();
    await page.getByRole('button',{name:'Probar',exact:true}).click();
    const model=page.getByRole('img',{name:/Vista 3D.*gorra/});
    await model.waitFor();await page.waitForTimeout(3000);
    await page.mouse.move(1100,750);
    const host=await model.elementHandle();
    const canvas=await model.locator('canvas').elementHandle();
    const before=await model.screenshot({path:join(output,'modelo.png')});
    const bounds=await model.boundingBox();
    const modelInk=await tinta(page,before);
    await page.getByRole('button',{name:'Delante 1',exact:true}).click();
    await page.waitForTimeout(600);await page.mouse.move(1100,750);
    const photo=await page.screenshot({clip:bounds,path:join(output,'foto.png')});
    const photoInk=await tinta(page,photo);
    assert.ok(modelInk.width>0 && photoInk.width>0);
    assert.ok(Math.abs(modelInk.width/photoInk.width-1)<.04,JSON.stringify({modelInk,photoInk}));
    assert.ok(Math.abs(modelInk.cy-photoInk.cy)<10,JSON.stringify({modelInk,photoInk}));
    assert.ok(Math.abs(modelInk.cx-photoInk.cx)<10);
    for(const name of ['Delante 2','Delante 3','Modelo 3D']) await page.getByRole('button',{name,exact:true}).click();
    await page.waitForTimeout(500);await page.mouse.move(1100,750);
    assert.ok(await model.locator('canvas').evaluate((el,old)=>el===old,canvas));
    assert.ok(before.equals(await model.screenshot()),'cambió al alternar fotos');
    // La órbita también sobrevive al display:none y al ResizeObserver.
    await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
    await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.6,bounds.y+bounds.height*.55,{steps:20});await page.mouse.up();
    await page.mouse.move(1100,750);await page.waitForTimeout(1800);
    const viewMatrix=()=>model.locator('canvas').evaluate(c=>{
      const gl=c.getContext('webgl2'), program=gl.getParameter(gl.CURRENT_PROGRAM);
      return Array.from(gl.getUniform(program,gl.getUniformLocation(program,'viewMatrix')));
    });
    let last=await viewMatrix(), stable=0;
    // SwiftShader puede tardar más que una GPU real. Esperar la cámara en
    // reposo, no asumir que 1800 ms equivalen al mismo número de frames.
    for(let attempt=0;attempt<100 && stable<3;attempt++) {
      await page.waitForTimeout(100);
      const now=await viewMatrix();
      stable=Math.max(...now.map((v,i)=>Math.abs(v-last[i])))<1e-7?stable+1:0;
      last=now;
    }
    assert.equal(stable,3,'la órbita no terminó de asentarse');
    const rotated=await model.screenshot({path:join(output,'rotado.png')});
    const cameraBefore=await viewMatrix();
    assert.ok(!rotated.equals(before),'la gorra no gira');
    await page.getByRole('button',{name:'Delante 2',exact:true}).click();
    await page.getByRole('button',{name:'Modelo 3D',exact:true}).click();
    await page.mouse.move(1100,750);await page.waitForTimeout(600);
    const returned=await model.screenshot({path:join(output,'rotado-regreso.png')});
    const orbitDifference=await page.evaluate(async images=>{
      const pixels=[];
      for(const src of images){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);pixels.push(ctx.getImageData(0,0,c.width,c.height).data);}
      let sum=0;for(let i=0;i<pixels[0].length;i++)sum+=Math.abs(pixels[0][i]-pixels[1][i]);return sum/pixels[0].length;
    },[rotated,returned].map(png=>'data:image/png;base64,'+png.toString('base64')));
    // OrbitControls conserva un residuo de damping subpíxel al dejar de emitir
    // change; otra invalidación puede dibujar ese último paso, no otra órbita.
    // Comparar la cámara, no la luminosidad: un borde de sombra PCF puede
    // variar entre píxeles por el residuo del damping sin cambiar de órbita.
    const cameraAfter=await viewMatrix();
    assert.equal(cameraBefore.length,16);assert.equal(cameraAfter.length,16);
    const cameraDifference=Math.max(...cameraBefore.map((v,i)=>Math.abs(v-cameraAfter[i])));
    assert.ok(cameraDifference<.0001,'se perdió la órbita al volver: '+cameraDifference);
    assert.ok(await host.evaluate(el=>el.isConnected));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({output,modelInk,photoInk,photoSwitchStable:true,orbitDifference,cameraDifference,errors},null,2));
    // Abrir el preview real también en móvil, no sólo redimensionar el desktop.
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(base+'/design/?id=fef3cb1d-5c43-49cf-b5ad-6dfc3209fe9c');
    await mobile.getByRole('button',{name:'Previsualizar',exact:true}).waitFor({timeout:60000});
    await mobile.getByRole('button',{name:'Previsualizar',exact:true}).click();
    const mobileModel=mobile.getByRole('img',{name:/Vista 3D.*gorra/});
    await mobileModel.waitFor();await mobile.waitForTimeout(3000);
    assert.ok(await mobileModel.locator('canvas').isVisible());
    await mobile.screenshot({path:join(output,'mobile.png')});
    assert.deepEqual(errors,[]);
    console.log('Mobile: modelo visible sin errores');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
