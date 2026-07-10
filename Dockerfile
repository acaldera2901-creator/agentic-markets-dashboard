FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# #PRELAUNCH-AUDIT #33: non girare come root. Utente non privilegiato + ownership
# di /app (il daemon scrive log/cache lì). .dockerignore tiene .env fuori dall'immagine.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["python", "run.py"]
