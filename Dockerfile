# =========================================
#  STAGE 1: BUILD REACT FRONTEND
# =========================================
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend

# Copy dependencies manifest and install
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build static bundle
COPY frontend/ ./
RUN npm run build

# =========================================
#  STAGE 2: BUILD FASTAPI BACKEND & RUN
# =========================================
FROM python:3.13-slim
WORKDIR /app

# System dependency installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend codebase
COPY backend/ ./backend/

# Copy built React frontend assets into backend/static
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Set runtime environments
ENV HOST=0.0.0.0
ENV PORT=8080
ENV MOCK_MODE=true

EXPOSE 8080

# Command to launch the FastAPI production uvicorn server
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
