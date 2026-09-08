FROM ubuntu:22.04 AS builder

ARG INKSTITCH_VERSION=3.3.0
ARG INKSTITCH_ARCH=aarch64
ARG INKSTITCH_SHA256=8e6918e62dee98b8cdbb46a3aad12521b094d2608049abd7eda5771092e9835e

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        curl \
        libcurl4-openssl-dev \
        python3 \
        python3-pip \
        xz-utils \
    && python3 -m pip install --no-cache-dir --target /opt/python \
        awslambdaric==4.0.2 \
        Pillow==11.3.0 \
        pyembroidery==1.5.1 \
    && curl -fsSL \
        "https://github.com/inkstitch/inkstitch/releases/download/v${INKSTITCH_VERSION}/inkstitch-${INKSTITCH_VERSION}-linux-${INKSTITCH_ARCH}.tar.xz" \
        -o /tmp/inkstitch.tar.xz \
    && echo "${INKSTITCH_SHA256}  /tmp/inkstitch.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/inkstitch \
    && tar -xJf /tmp/inkstitch.tar.xz -C /opt/inkstitch --strip-components=1

FROM ubuntu:22.04

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        libgl1 \
        libgtk-3-0 \
        libwayland-server0 \
        python3 \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/inkstitch /opt/inkstitch
COPY --from=builder /opt/python /opt/python

ENV PYTHONPATH=/opt/python \
    HOME=/tmp/home \
    XDG_CACHE_HOME=/tmp/cache \
    XDG_CONFIG_HOME=/tmp/config \
    DISPLAY=:99 \
    INKSTITCH_OFFLINE_SCRIPT=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /var/task

COPY aws-benchmark/handler.py /var/task/handler.py
COPY casos/01-texto-simple/geometria.svg /var/task/cases/01-texto-simple/geometria.svg
COPY casos/02-logo-monocromo/geometria.svg /var/task/cases/02-logo-monocromo/geometria.svg
COPY casos/03-logo-cuatro-colores/geometria.svg /var/task/cases/03-logo-cuatro-colores/geometria.svg
COPY casos/04-ilustracion/geometria.svg /var/task/cases/04-ilustracion/geometria.svg
COPY casos/05-imagen-compleja/geometria.svg /var/task/cases/05-imagen-compleja/geometria.svg

ENTRYPOINT ["/usr/bin/python3", "-m", "awslambdaric"]
CMD ["handler.lambda_handler"]
