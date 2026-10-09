FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# emergentintegrations is not on PyPI, and litellm is a private wheel used only
# when Claude resume parsing runs (lazy import in ai.py). Everything else in
# requirements.txt is installed so the API, seed data, and admin reports work.
COPY backend/requirements.txt /tmp/requirements.txt
RUN grep -v -E '^(emergentintegrations|litellm @)' /tmp/requirements.txt > /tmp/requirements.docker.txt \
    && pip install --no-cache-dir -r /tmp/requirements.docker.txt

COPY backend/ /app/

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
