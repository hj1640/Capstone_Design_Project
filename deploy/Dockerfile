FROM python:3.12-slim
WORKDIR /app
COPY requirements-service.txt .
RUN pip install --no-cache-dir -r requirements-service.txt \
    && useradd --create-home --uid 10001 fridge \
    && mkdir -p /data /private && chown fridge:fridge /data /private
COPY server ./server
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 FRIDGE_BIND=0.0.0.0 PORT=8766 FRIDGE_DB_PATH=/data/fridge.sqlite3
USER fridge
EXPOSE 8766
CMD ["python", "server/service.py"]
