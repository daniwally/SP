# Build stage - Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Backend
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code to /app/backend
COPY backend/ /app/backend/

# Copy built frontend to static folder
COPY --from=frontend-build /app/frontend/dist /app/static

# Copy background images to static
COPY backend/static/backgrounds /app/static/backgrounds

# Expose port
EXPOSE 8000

# Run from backend directory
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
