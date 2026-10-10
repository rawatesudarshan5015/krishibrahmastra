FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV + PaddleOCR
RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Generate Prisma client
COPY prisma/ ./prisma/
RUN prisma generate

COPY . .

EXPOSE 8000
