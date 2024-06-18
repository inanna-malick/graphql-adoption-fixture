FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV DATABASE_URL="sqlite:////app/data/inventory.db"
EXPOSE 8000

CMD ["sh", "-c", "mkdir -p /app/data && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
