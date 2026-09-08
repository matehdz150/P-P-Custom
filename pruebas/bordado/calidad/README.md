# Suite de calidad de bordado

Esta suite empieza en geometría preparada y es independiente del clasificador
PHOTO/GRAPHIC. `Discovery` usa el diseño real del E2E, pero no tiene reglas
especiales.

```sh
python3 pruebas/bordado/calidad/fixtures.py
pnpm exec tsx pruebas/bordado/calidad/convert_v3.ts

docker run --rm --platform linux/arm64 \
  --entrypoint /usr/bin/python3 \
  -e HOME=/tmp/quality-home \
  -e XDG_CACHE_HOME=/tmp/quality-cache \
  -e XDG_CONFIG_HOME=/tmp/quality-config \
  -e DISPLAY=:99 \
  -e INKSTITCH_OFFLINE_SCRIPT=1 \
  -e KUSTTO_ENGINE_TIMEOUT=180 \
  -v "$PWD:/workspace" -w /workspace \
  kustto-embroidery-worker:experimental-v3 \
  pruebas/bordado/calidad/run_suite.py \
  --label candidate --fixtures fixtures-v3
```

Cada fixture contiene `input.svg`, `prepared.svg`, `design.dst`,
`stitchPlot.png`, `embroideredPreview.png`, `design.json` y `metadata.json`.
Las métricas por objeto que dependen de DST se obtienen mediante una corrida
aislada; para diseños con más de 20 objetos quedan explícitamente como
`geometry-only`, porque Tajima no conserva la identidad del objeto.

`compare.py` compara las corridas fijadas `before-v2` y `after-v3-candidate` y
falla conceptualmente el gate de promoción si una regresión requerida queda
roja. No cambia perfiles activos ni recursos AWS.

