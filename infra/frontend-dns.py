#!/usr/bin/env python3
"""Los ALIAS del apex y de www hacia CloudFront.

Van como ALIAS y no como CNAME porque el apex de un dominio no admite CNAME
—lo prohíbe el DNS, no AWS— y porque un ALIAS no se cobra por consulta.

`UPSERT` en vez de `CREATE`: así correr el script dos veces no falla con
"ya existe", que es la mitad de lo que significa idempotente aquí.
"""

import argparse
import json

# La zona de CloudFront. Es una constante global de AWS, igual en todas las
# cuentas y regiones: no se busca, se sabe.
ZONA_DE_CLOUDFRONT = "Z2FDTNDATAQYW2"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dominio", required=True)
    p.add_argument("--destino", required=True)
    # Ver `frontend-config.py`: el backoffice no tiene `www.`.
    p.add_argument("--sin-www", action="store_true")
    a = p.parse_args()

    def alias(nombre):
        return {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": nombre,
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": ZONA_DE_CLOUDFRONT,
                    "DNSName": a.destino,
                    # Sin comprobación de salud: no hay a dónde caerse si
                    # CloudFront falla, y activarla costaría por consulta.
                    "EvaluateTargetHealth": False,
                },
            },
        }

    cambios = [alias(a.dominio)]
    if not a.sin_www:
        cambios.append(alias(f"www.{a.dominio}"))

    lote = {"Comment": "Sitio de Kustto en CloudFront", "Changes": cambios}

    print(json.dumps(lote))


if __name__ == "__main__":
    main()
