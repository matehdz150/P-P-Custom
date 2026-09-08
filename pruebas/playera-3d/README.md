# Preview de playera de manga corta

Modelo local de referencia basado en el perfil de `public/mockups/tshirtfront.png`:
cuerpo, hombros, mangas abiertas, bajo abierto y cuello. Frente y espalda tienen
UV independientes; la espalda no invierte el texto. No simula tallas ni caída
física de tela y no cambia archivos de fabricación.

La colocación se obtiene del área editable respecto a la transformación actual
del mockup Fabric. Conserva todo el raster y sus márgenes. Las fotos seleccionadas
y el color no recalibran la geometría. El 3D permanece montado al seleccionar fotos
para conservar la cámara. La taza utiliza igualmente una referencia canónica fija.

Se habilita para playeras con `front`, `back` y las mangas opcionales `leftmanga`
y `rightmanga`, como la ficha real “Playera de cuello redondo”. Nombres de lados
desconocidos no se habilitan silenciosamente. Las mangas tienen anclajes fijos en
el modelo, izquierda/derecha de quien viste, con escala relativa a los centímetros
del frente y proporción del raster. Se representan sobre la cara frontal de cada
manga del modelo de referencia; no simulan una impresión envolvente de 360°.
Sin medidas para colocar un diseño de manga se muestra el error, no se omite.

Pruebas de coordenadas y perfil, desde la raíz:

```sh
node --experimental-strip-types --test pruebas/playera-3d/mapeo.test.mjs pruebas/taza-3d/mapeo.test.mjs
```

Validación adicional realizada en Chromium local con catálogo interceptado:
texto en frente y espalda, rotación, cambio de color, alternancia foto/3D con el
mismo canvas y captura idéntica al regresar; taza con dos calibraciones distintas
sin mover su arte al seleccionarlas; layout móvil de 390 × 844. No se hicieron
pedidos, escrituras en AWS ni despliegues.
