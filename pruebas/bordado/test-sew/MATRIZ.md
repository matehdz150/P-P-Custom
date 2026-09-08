# Matriz de prueba física de bordado

Para el taller. Un bloque por cada combinación de **caso × material** que se
cosa. Si un caso se cose en tres telas distintas, son tres bloques.

**Nada de lo que viene en los DST está validado físicamente.** Los parámetros
—separación, compensación de tiro, underlay— son hipótesis calculadas, nunca
cosidas. Esta prueba existe para decidir si sirven; si algo sale mal, el fallo
es del perfil, no del taller.

Lo que más nos sirve de vuelta: **qué habrías cambiado**. Si el ajuste que hace
falta es evidente para quien está delante de la máquina, escríbelo aunque no
encaje en ninguna casilla.

---

## Cómo puntuar

| | |
|---|---|
| **PASS** | Sale bien. Se lo entregarías a un cliente. |
| **ADJUST** | Se puede coser, pero hay que tocar algo. Di qué. |
| **FAIL** | No sirve como está. |

---

## Bloque de prueba

Copia este bloque una vez por prueba.

### Identificación

| | |
|---|---|
| Caso (carpeta) | `caso-__` |
| Fecha | |
| Taller / operario | |

### Montaje

| | |
|---|---|
| Producto / prenda | |
| Tela (composición y peso) | |
| Backing / estabilizador | |
| Aguja (tipo y calibre) | |
| Hilo (marca y grosor) | |
| Máquina (marca y modelo) | |
| Bastidor (medida) | |
| Velocidad (ppm) | |
| Tensión superior / bobina | *si la máquina la indica* |

### Resultado

| Aspecto | PASS / ADJUST / FAIL | Notas |
|---|---|---|
| Legibilidad del texto | | |
| Bordes y cantos | | |
| Contraformas (huecos de letras) | | |
| Cobertura (¿se ve la tela debajo?) | | |
| Fruncido de la tela (puckering) | | |
| Compensación de tiro (pull) | | |
| Empuje (push) | | |
| Roturas de hilo | | *cuántas y en qué parte* |
| Densidad (¿agujerea o se apelmaza?) | | |
| Columnas satin | | |
| Detalles perdidos | | |
| Registro entre colores | | |
| Percepción general | | |

### Preguntas abiertas

1. ¿Coserías esto para un cliente tal cual? **SÍ / NO**
2. Si es que no, ¿qué es lo primero que cambiarías?
3. ¿El DST se abrió y se cosió sin retocarlo en tu software?
4. ¿Cuánto tardó la máquina?
5. ¿Hay algo del diseño que sencillamente no se debería haber aceptado?

---

## Recuento

| caso | material | veredicto | quien | fecha |
|---|---|---|---|---|
| caso-01 | | | | |
| caso-02 | | | | |
| caso-03 | | | | |
| caso-04 | | | | |
| caso-05 | | | | |
| caso-06 | | | | |

---

## Cuándo se puede dar el perfil por validado

`physicallyValidated` sigue en **`false`** y **no se cambia con esta prueba
sola**. Para poder ponerlo en `true` hace falta, todo a la vez:

1. los casos simples —texto grande, logo monocromo— en **PASS**;
2. el texto en el mínimo aceptado (`caso-02`, cerca de los 6 mm de altura y
   1.2 mm de asta) en **PASS**: si ahí falla, el mínimo del perfil está mal y
   hay que subirlo;
3. las columnas **satin** en PASS: canto limpio, sin ondear y sin que se vea la
   tela por debajo;
4. los **rellenos** en PASS: sin fruncido y con la densidad adecuada;
5. los **running** en PASS: visibles y continuos, sin saltos;
6. la **compensación de tiro** aceptable: que el ancho cosido se parezca al
   ancho del diseño;
7. **ningún defecto sistemático**: que un mismo fallo no aparezca en varios
   casos distintos;
8. el taller confirma que **los DST se usan tal cual**, sin retocarlos.

Si un material concreto necesita otros números, **no se toca el perfil global**:
se crea después un perfil aparte por material o por taller. Un perfil que
promedia una piqué y una polar no vale para ninguna de las dos.
