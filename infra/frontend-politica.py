#!/usr/bin/env python3
"""La política que deja entrar a CloudFront en un bucket, sin borrar el resto.

`put-bucket-policy` SUSTITUYE la política entera. El bucket de contenido puede
tener permisos de otras cosas, así que aquí se añade la sentencia si no está y
se conserva todo lo demás: escribir la nuestra a secas los borraría en
silencio, y eso sólo se descubre cuando algo deja de leer.

HAY MÁS DE UNA DISTRIBUCIÓN, y por eso la condición lleva una LISTA de ARNs
que se va uniendo. La versión anterior guardaba uno solo y borraba la sentencia
por `Sid` antes de escribir la suya: al desplegar el backoffice, el bucket de
contenido dejó de confiar en la distribución del sitio público y las imágenes
de la tienda se cayeron. No se notó al desplegar —CloudFront tenía todo en
caché— sino después, con un 403 que señalaba a S3 y no a esto.
"""

import argparse
import json

SID = "CloudFrontKustto"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--bucket", required=True)
    p.add_argument("--distribucion", required=True)
    p.add_argument("--actual", default="")
    a = p.parse_args()

    try:
        politica = json.loads(a.actual) if a.actual.strip() else {}
    except json.JSONDecodeError:
        politica = {}

    politica.setdefault("Version", "2012-10-17")

    otras = []
    arns = {a.distribucion}

    for sentencia in politica.get("Statement", []):
        if sentencia.get("Sid") != SID:
            otras.append(sentencia)
            continue

        # Las que ya estaban se conservan. `AWS:SourceArn` puede venir como
        # cadena (lo que escribía la versión vieja) o como lista.
        previo = (
            sentencia.get("Condition", {}).get("StringEquals", {}).get("AWS:SourceArn")
        )
        if isinstance(previo, str):
            arns.add(previo)
        elif isinstance(previo, list):
            arns.update(previo)

    otras.append(
        {
            "Sid": SID,
            "Effect": "Allow",
            # Se confía en el SERVICIO, y la condición lo ata a NUESTRAS
            # distribuciones. Sin la condición, cualquier distribución de
            # cualquier cuenta de AWS podría servir este bucket.
            "Principal": {"Service": "cloudfront.amazonaws.com"},
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{a.bucket}/*",
            # Ordenados para que dos corridas seguidas den el mismo JSON: sin
            # esto, la política "cambia" en cada despliegue sin cambiar nada.
            "Condition": {"StringEquals": {"AWS:SourceArn": sorted(arns)}},
        }
    )

    politica["Statement"] = otras
    print(json.dumps(politica))


if __name__ == "__main__":
    main()
