# VTracer, congelado a mano

De dónde sale y por qué no es una dependencia de `package.json`.

## Qué es

`vtracer-wasm@0.1.0` — https://github.com/jsscheller/vtracer-wasm
Un empaquetado a WebAssembly de [VTracer](https://github.com/visioncortex/vtracer).
Licencia MIT; el texto original está en `LICENSE`, junto a estos archivos.

## Por qué copiado y no instalado

1. **El paquete oficial no sirve en el navegador.** `@visioncortex/vtracer` está
   compilado con `--target nodejs`: usa `require('fs')` y `readFileSync` para
   cargar su propio `.wasm`. Turbopack no lo resuelve y el build se cae, igual
   que pasó con `wawoff2`.
2. **`vtracer-wasm` sí es `--target web`**, pero es un 0.1.0 de un particular y
   **trae un fallo**: su JS pide `vtracer_bg.wasm` y el paquete entrega
   `vtracer.wasm`. Hay que pasarle la ruta a mano, así que dependerlo sin más no
   habría funcionado igualmente.
3. Copiado aquí, la versión queda **congelada**: nadie actualiza esto por
   sorpresa en un `pnpm install`, y lo que se prueba es lo que se produce. Esto
   acaba en archivos que van a una máquina de grabado.

## Los bytes exactos

Si alguno de estos hashes deja de coincidir, alguien cambió el binario:

| archivo | tamaño | sha256 |
|---|---|---|
| `vtracer.js` | 14,110 B | `b6df555c52e090c7a9da30cd7964a477b7d3a591dc2166a92c5f0ff24f3e7674` |\n| `vtracer.wasm` | 136,862 B | `b93108af0f23e13a64f4b23f2582312a325be9d7ff833e49d04554cd99606f0b` |\n| `arranque.js` | 361 B | `3a0fb36b73b43fcf1ea85ef0e5a55546fe42b99e653a32e460fee26248a0643c` |

Para comprobarlos:

```bash
shasum -a 256 apps/web/public/vendor/vtracer/*
```

## Para actualizarlo

```bash
npm pack vtracer-wasm@<version>
```

y copiar `vtracer.js`, `vtracer.wasm` y `LICENSE`. Después **volver a medir**:
el preset y el límite de nodos de `lib/impresion/vectorizar.ts` están calibrados
contra esta versión.
