#!/usr/bin/env python3
"""La configuración de la distribución de CloudFront, en JSON.

Se genera con un script y no con un heredoc porque `update-distribution` pide
la configuración ENTERA en cada llamada: escribirla a mano en bash acabaría en
comillas escapadas dentro de comillas escapadas, que es como se cuelan los
errores que nadie ve hasta que la distribución queda a medias.

Lo que hay que saber antes de tocarla:

- `CallerReference` es FIJO. CloudFront no deja cambiarlo al actualizar, así
  que generarlo con la fecha rompería el script en la segunda ejecución.
- Los 403 se tratan como 404. Con OAC el bucket contesta 403 a un objeto que
  no existe —no tiene permiso de listar, así que no puede distinguir— y sin
  esta regla una URL equivocada enseñaría un XML de acceso denegado.
"""

import argparse
import json

# Políticas administradas de AWS. Son constantes globales, iguales en todas
# las cuentas: no hace falta buscarlas.
CACHE_OPTIMIZADO = "658327ea-f89d-4fab-a63d-7e88639e58f6"
# La zona de CloudFront para los ALIAS de Route53. También es constante.

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--sitio", required=True)
    p.add_argument("--publico", required=True)
    p.add_argument("--dominio", required=True)
    p.add_argument("--cert", required=True)
    p.add_argument("--oac", required=True)
    p.add_argument("--funcion", required=True)
    p.add_argument("--comentario", required=True)
    # El backoffice vive en un subdominio y no tiene `www.`: pedir un alias
    # que no está en el certificado hace que CloudFront rechace la
    # distribución entera con un error que no menciona el `www`.
    p.add_argument("--sin-www", action="store_true")
    a = p.parse_args()

    alias = [a.dominio] if a.sin_www else [a.dominio, f"www.{a.dominio}"]

    origen_sitio = f"{a.sitio}.s3.us-east-1.amazonaws.com"
    origen_publico = f"{a.publico}.s3.us-east-1.amazonaws.com"

    def origen(id_, dominio):
        return {
            "Id": id_,
            "DomainName": dominio,
            "OriginPath": "",
            "CustomHeaders": {"Quantity": 0},
            # OriginAccessIdentity vacío y OAC puesto: son dos mecanismos
            # distintos y el viejo (OAI) tiene que quedar explícitamente vacío.
            "S3OriginConfig": {"OriginAccessIdentity": ""},
            "OriginAccessControlId": a.oac,
            "ConnectionAttempts": 3,
            "ConnectionTimeout": 10,
        }

    def comportamiento(patron, destino, con_funcion):
        base = {
            "TargetOriginId": destino,
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 2,
                "Items": ["HEAD", "GET"],
                "CachedMethods": {"Quantity": 2, "Items": ["HEAD", "GET"]},
            },
            "Compress": True,
            "CachePolicyId": CACHE_OPTIMIZADO,
            "FunctionAssociations": {"Quantity": 0},
            "LambdaFunctionAssociations": {"Quantity": 0},
            "FieldLevelEncryptionId": "",
            "SmoothStreaming": False,
        }

        if con_funcion:
            base["FunctionAssociations"] = {
                "Quantity": 1,
                "Items": [
                    {"FunctionARN": a.funcion, "EventType": "viewer-request"}
                ],
            }

        if patron is not None:
            base["PathPattern"] = patron

        return base

    config = {
        "CallerReference": a.comentario,
        "Comment": a.comentario,
        "Enabled": True,
        "Aliases": {"Quantity": len(alias), "Items": alias},
        "DefaultRootObject": "index.html",
        "Origins": {
            "Quantity": 2,
            "Items": [
                origen("sitio", origen_sitio),
                origen("contenido", origen_publico),
            ],
        },
        # El sitio es lo que se sirve por defecto; los mockups y los medios
        # salen del bucket de contenido, bajo el MISMO dominio. Que compartan
        # origen no es cosmético: el editor lee los píxeles del mockup y desde
        # otro dominio el navegador se lo prohibiría.
        "DefaultCacheBehavior": comportamiento(None, "sitio", con_funcion=True),
        "CacheBehaviors": {
            "Quantity": 3,
            "Items": [
                comportamiento("/mockups/*", "contenido", con_funcion=False),
                comportamiento("/medios/*", "contenido", con_funcion=False),
                comportamiento("/eventos/*", "contenido", con_funcion=False),
            ],
        },
        "CustomErrorResponses": {
            "Quantity": 2,
            "Items": [
                {
                    "ErrorCode": 403,
                    "ResponsePagePath": "/404.html",
                    "ResponseCode": "404",
                    "ErrorCachingMinTTL": 10,
                },
                {
                    "ErrorCode": 404,
                    "ResponsePagePath": "/404.html",
                    "ResponseCode": "404",
                    "ErrorCachingMinTTL": 10,
                },
            ],
        },
        "ViewerCertificate": {
            "ACMCertificateArn": a.cert,
            "SSLSupportMethod": "sni-only",
            "MinimumProtocolVersion": "TLSv1.2_2021",
            "CertificateSource": "acm",
        },
        # Todas las regiones: los clientes están en México, y las clases
        # baratas dejan fuera justo los nodos de aquí. Con este tráfico la
        # diferencia de precio es de centavos y la de latencia no.
        # ── Los campos que sólo exige ACTUALIZAR ────────────────────────
        #
        # Vacíos y apagados, pero PRESENTES. `create-distribution` acepta que
        # falten y les pone el valor por defecto; `update-distribution` NO, y
        # responde `IllegalUpdate: <campo> is missing for the resource` — uno
        # cada vez, así que hay que descubrirlos de a uno. Sin ellos este
        # script sólo servía la PRIMERA vez, y eso se descubrió el día que
        # hizo falta actualizar de verdad.
        "Logging": {
            "Enabled": False,
            "IncludeCookies": False,
            "Bucket": "",
            "Prefix": "",
        },
        "OriginGroups": {"Quantity": 0},
        "Restrictions": {
            "GeoRestriction": {"RestrictionType": "none", "Quantity": 0}
        },
        "WebACLId": "",
        "ContinuousDeploymentPolicyId": "",
        "Staging": False,
        "PriceClass": "PriceClass_All",
        "HttpVersion": "http2and3",
        "IsIPV6Enabled": True,
    }

    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
