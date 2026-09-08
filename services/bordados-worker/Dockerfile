FROM ubuntu:22.04 AS builder
ARG INKSTITCH_VERSION=3.3.0
ARG INKSTITCH_SHA256=8e6918e62dee98b8cdbb46a3aad12521b094d2608049abd7eda5771092e9835e
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl python3 python3-pip xz-utils \
 && python3 -m pip install --no-cache-dir --target /opt/python awslambdaric==4.0.2 -r /dev/null \
 && python3 -m pip install --no-cache-dir --target /opt/python boto3==1.40.52 Pillow==11.3.0 pyembroidery==1.5.1 \
 && curl -fsSL "https://github.com/inkstitch/inkstitch/releases/download/v${INKSTITCH_VERSION}/inkstitch-${INKSTITCH_VERSION}-linux-aarch64.tar.xz" -o /tmp/inkstitch.tar.xz \
 && echo "${INKSTITCH_SHA256}  /tmp/inkstitch.tar.xz" | sha256sum -c - \
 && mkdir -p /opt/inkstitch && tar -xJf /tmp/inkstitch.tar.xz -C /opt/inkstitch --strip-components=1

FROM ubuntu:22.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libgl1 libgtk-3-0 libwayland-server0 python3 xvfb \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --create-home --home-dir /tmp/worker worker
COPY --from=builder /opt/inkstitch /opt/inkstitch
COPY --from=builder /opt/python /opt/python
COPY worker.py /var/task/worker.py
COPY quality.py /var/task/quality.py
ENV PYTHONPATH=/opt/python HOME=/tmp/worker XDG_CACHE_HOME=/tmp/worker/cache XDG_CONFIG_HOME=/tmp/worker/config DISPLAY=:99 INKSTITCH_OFFLINE_SCRIPT=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /var/task
USER worker
ENTRYPOINT ["/usr/bin/python3", "-m", "awslambdaric"]
CMD ["worker.lambda_handler"]
