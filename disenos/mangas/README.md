# Mockups de manga

Los cuatro (corta/larga × izquierda/derecha) salen de `generar.mjs`, no se
dibujaron a mano uno por uno: son la misma silueta y la izquierda es el espejo
de la derecha, así que tocar el trazo en un sitio los arregla todos.

```bash
node generar.mjs
for f in *.svg; do rsvg-convert -w 2100 -h 1650 "$f" -o "${f%.svg}.png"; done
```

## Lo que no se puede cambiar sin romper el teñido

`lib/fabric/prenda.ts` separa la prenda del fondo **rellenando desde los
bordes** y borrando todo lo que pase de 236 de luminancia. De ahí salen tres
reglas que no son estéticas:

- El fondo es `#f1f3e8` (241 de luminancia) para que se borre.
- La tela es `#ffffff` y sólo sobrevive porque **el contorno oscuro la encierra
  por completo**. Un hueco en el trazo y el relleno se cuela: la prenda se
  ahueca y el teñido pinta el agujero.
- Si se recorta menos del 5% de la imagen, el teñido se apaga entero. Estos
  recortan el 70%.

Comprobado en las cuatro antes de subirlas. Si tocas la silueta, vuelve a
comprobarlo: el fallo no da error, sale una prenda que no se tiñe.

## Colores

Muestreados del mockup de playera que ya existía, no elegidos: fondo `#f1f3e8`,
tela `#ffffff`, costuras `#c4c7c0`.
