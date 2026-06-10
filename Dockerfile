# --- Stage 1: Build the React frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Run the Express backend ---
FROM node:20-slim
# Install Python 3, pip, and venv for markitdown support
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up virtual environment and install markitdown
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip3 install --no-cache-dir markitdown

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
# Copy built frontend assets to the folder relative to backend
COPY --from=frontend-builder /frontend/dist /frontend/dist

EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "server.js"]

