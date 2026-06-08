# Multi-stage build for the ag-ui demo backend (examples/ag-ui).
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
# Strip uv's editable self-reference (`-e .` / local file:// paths): the build
# context here is only requirements.txt, and the app's own `src/` is imported
# directly by uvicorn (`src.server:app`) from the runner's /app — no editable
# install is needed. Without this, pip tries to install the local project and
# fails ("does not appear to be a Python project").
RUN grep -vE '^-e |^\. |^\.$|file://' requirements.txt > /tmp/deps.txt \
  && pip install --user --no-cache-dir -r /tmp/deps.txt

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 8000
CMD ["./entrypoint.sh"]
