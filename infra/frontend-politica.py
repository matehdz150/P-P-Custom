#!/usr/bin/env python3
"""La política que deja entrar a CloudFront en un bucket, sin borrar el resto.

`put-bucket-policy` SUSTITUYE la política entera. El bucket de contenido puede
tener permisos de otras cosas, así que aquí se añade la sentencia si no está y
se conserva todo lo demás: escribir la nuestra a secas los borraría en
silencio, y eso sólo se descubre cuando algo deja de leer.
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
    sentencias = [s for s in politica.get("Statement", []) if s.get("Sid") != SID]

    sentencias.append(
        {
            "Sid": SID,
            "Effect": "Allow",
            # Se confía en el SERVICIO, y la condición lo ata a esta
            # distribución concreta. Sin la condición, cualquier distribución
            # de cualquier cuenta de AWS podría servir este bucket.
            "Principal": {"Service": "cloudfront.amazonaws.com"},
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{a.bucket}/*",
            "Condition": {"StringEquals": {"AWS:SourceArn": a.distribucion}},
        }
    )

    politica["Statement"] = sentencias
    print(json.dumps(politica))


if __name__ == "__main__":
    main()
