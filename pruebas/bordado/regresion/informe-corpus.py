"""Lee resultados-corpus.json y saca las tablas del informe.

No decide nada: sólo agrupa lo que midió el banco.
"""

import io
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
d = json.load(io.open(os.path.join(AQUI, "resultados-corpus.json"), encoding="utf-8"))
d = [x for x in d if "error" not in x]

ETAPAS = [
    "decode",
    "render",
    "analisisOriginal",
    "segmentacion",
    "cuantizacion",
    "limpieza",
    "analisisComponentes",
    "distancia",
    "medicion",
    "esqueleto",
    "sobrante",
    "contornos",
    "total",
]


def pct(valores, p):
    if not valores:
        return 0.0
    v = sorted(valores)
    i = min(len(v) - 1, max(0, int(round((len(v) - 1) * p))))
    return v[i]


def clase_real(x):
    """Lo que el algoritmo decidió, reducido a grafico/foto.

    Agotar el presupuesto NO es clasificar como foto: es no haber podido
    prepararlo. Cuenta como grafico porque el diseño no se declaró fotografia.
    """
    if x.get("presupuestoAgotado"):
        return "grafico"
    return "foto" if x["earlyReject"] or x["clase"] == "photo" else "grafico"


print("=" * 92)
print("1. CORPUS")
print("=" * 92)
familias = {}
for x in d:
    familias.setdefault(x["familia"], []).append(x)
for f, xs in sorted(familias.items()):
    print(f"  {f:14} {len(xs):3}")
print(f"  {'TOTAL':14} {len(d):3}")

print()
print("=" * 92)
print("2. MATRIZ DE CLASIFICACION (excluye los ambiguos, que no tienen respuesta)")
print("=" * 92)
matriz = {}
for x in d:
    if x["espera"] == "ambiguo":
        continue
    matriz.setdefault((x["espera"], clase_real(x)), []).append(x)
print(f"{'':22}{'-> grafico':>14}{'-> foto':>12}")
for esperado in ("grafico", "foto"):
    g = len(matriz.get((esperado, "grafico"), []))
    p = len(matriz.get((esperado, "foto"), []))
    print(f"esperado {esperado:12} {g:>13} {p:>11}")

falsos_foto = matriz.get(("grafico", "foto"), [])
falsos_grafico = matriz.get(("foto", "grafico"), [])
ciertos = len(matriz.get(("grafico", "grafico"), [])) + len(
    matriz.get(("foto", "foto"), [])
)
duros = sum(1 for x in d if x["espera"] != "ambiguo")
print()
presupuesto = [x for x in d if x.get("presupuestoAgotado")]
print(f"  completados  : {len([x for x in d if not x['earlyReject'] and not x.get('presupuestoAgotado')])}")
print(f"  early reject : {len([x for x in d if x['earlyReject']])}")
print(f"  presupuesto  : {len(presupuesto)}  ({', '.join(x['archivo'][:28] for x in presupuesto)})")
print(f"  true graphic : {len(matriz.get(('grafico','grafico'), []))}")
print(f"  true photo   : {len(matriz.get(('foto','foto'), []))}")
print(f"  false photo  : {len(falsos_foto)}   <- rechazar un diseño valido")
print(f"  false graphic: {len(falsos_grafico)}")
print(f"  accuracy (referencia): {ciertos}/{duros} = {ciertos/max(1,duros)*100:.1f}%")

print()
print("=" * 92)
print("3. FALSOS")
print("=" * 92)
if not falsos_foto and not falsos_grafico:
    print("  ninguno")
for x in falsos_foto:
    print(f"  FALSO PHOTO   {x['archivo']:38} suav={x['suavidadInterior']:.3f}  ({x['nota']})")
for x in falsos_grafico:
    print(
        f"  FALSO GRAFICO {x['archivo']:38} suav={x['suavidadInterior']:.3f}  "
        f"regiones={x['regiones']} decision={x['decision']}  ({x['nota']})"
    )

print()
print("=" * 92)
print("4. DISTRIBUCION DE suavidadInterior")
print("=" * 92)
por_espera = {}
for x in d:
    por_espera.setdefault(x["espera"], []).append(x["suavidadInterior"])
for e in ("grafico", "ambiguo", "foto"):
    v = sorted(por_espera.get(e, []))
    if not v:
        continue
    print(
        f"  {e:9} n={len(v):3}  min={v[0]:.3f}  p50={pct(v,0.5):.3f}  "
        f"p90={pct(v,0.9):.3f}  max={v[-1]:.3f}"
    )
graficos = sorted(por_espera.get("grafico", []))
fotos = sorted(por_espera.get("foto", []))
if graficos and fotos:
    print()
    print(f"  grafico mas suave : {graficos[-1]:.3f}")
    print(f"  foto menos suave  : {fotos[0]:.3f}")
    print(f"  hueco             : {fotos[0] - graficos[-1]:+.3f}   (umbral 0.61)")

print()
print("  los cinco graficos mas suaves:")
for x in sorted(
    [x for x in d if x["espera"] == "grafico"],
    key=lambda x: -x["suavidadInterior"],
)[:5]:
    print(f"    {x['suavidadInterior']:.3f}  {x['archivo']:38} ({x['nota']})")
print("  las cinco fotos menos suaves:")
for x in sorted(
    [x for x in d if x["espera"] == "foto"], key=lambda x: x["suavidadInterior"]
)[:5]:
    print(f"    {x['suavidadInterior']:.3f}  {x['archivo']:38} ({x['nota']})")

print()
print("=" * 92)
print("5. AMBIGUOS (no tienen respuesta correcta; se mira donde caen)")
print("=" * 92)
print(f"{'archivo':40}{'suav':>7}{'clase':>13}{'decision':>10}   nota")
for x in sorted(
    [x for x in d if x["espera"] == "ambiguo"], key=lambda x: x["suavidadInterior"]
):
    print(
        f"{x['archivo'][:39]:40}{x['suavidadInterior']:>7.3f}{x['clase']:>13}"
        f"{x['decision']:>10}   {x['nota']}"
    )

print()
print("=" * 92)
print("5b. POR CASO")
print("=" * 92)
print(f"{'archivo':38}{'esp':>9}{'clase':>13}{'decision':>10}{'early':>7}{'presup':>9}"
      f"{'ms':>8}{'esq ms':>8}{'comp':>6}{'ramas':>7}{'obj':>6}")
for x in sorted(d, key=lambda x: (x["espera"], x["archivo"])):
    c = x.get("coste") or {}
    print(
        f"{x['archivo'][:37]:38}{x['espera']:>9}{x['clase']:>13}{x['decision']:>10}"
        f"{('si' if x['earlyReject'] else '-'):>7}"
        f"{(x.get('presupuestoAgotado') or '-')[:8]:>9}"
        f"{x['tiempos']['total']:>8.0f}{c.get('msEsqueleto',0):>8.0f}"
        f"{x['componentesDespues']:>6}{c.get('ramas',0):>7}{x['objetos']:>6}"
    )

print()
print("=" * 92)
print("6. TIEMPOS (ms)")
print("=" * 92)
print(f"{'etapa':22}{'p50':>9}{'p95':>9}{'max':>9}{'% del total p50':>18}")
total_p50 = pct([x["tiempos"].get("total", 0) for x in d], 0.5)
for etapa in ETAPAS:
    v = [x["tiempos"].get(etapa, 0) for x in d if etapa in x["tiempos"]]
    if not v:
        continue
    p50 = pct(v, 0.5)
    parte = f"{p50/total_p50*100:.1f}%" if total_p50 and etapa != "total" else ""
    print(f"{etapa:22}{p50:>9.1f}{pct(v,0.95):>9.1f}{max(v):>9.1f}{parte:>18}")

print()
print("  solo los que NO se rechazan temprano (los que pagan todo el pipeline):")
completos = [x for x in d if not x["earlyReject"]]
v = [x["tiempos"]["total"] for x in completos]
print(
    f"    n={len(completos)}  p50={pct(v,0.5):.0f}ms  p95={pct(v,0.95):.0f}ms  max={max(v):.0f}ms"
)
v2 = [x["tiempos"]["total"] for x in d if x["earlyReject"]]
if v2:
    print(
        f"  rechazo temprano: n={len(v2)}  p50={pct(v2,0.5):.0f}ms  max={max(v2):.0f}ms"
    )

print()
print("  las ocho mas caras:")
for x in sorted(d, key=lambda x: -x["tiempos"]["total"])[:8]:
    t = x["tiempos"]
    caro = max(
        ((k, v) for k, v in t.items() if k not in ("total", "decode")),
        key=lambda kv: kv[1],
        default=("-", 0),
    )
    print(
        f"    {t['total']:7.0f}ms  {x['archivo'][:36]:38} objetos={x['objetos']:<4} "
        f"regiones={x['regiones']:<4} mayor={caro[0]}({caro[1]:.0f}ms)"
    )
