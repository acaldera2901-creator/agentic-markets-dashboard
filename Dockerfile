FROM python:3.12-slim

WORKDIR /app

# System deps for scipy / numpy compilation if wheels not available
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default command (overridden in docker-compose per service)
CMD ["python", "run.py"]
