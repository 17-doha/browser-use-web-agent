# Stage 1: Install Playwright and browsers in a temp image
FROM python:3.11-slim AS installer

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libx11-xcb1 \
    libxcursor1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    fonts-liberation \
    libxss1 \
    libnspr4 \
    libpangocairo-1.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright and browsers
RUN pip install playwright && \
    playwright install-deps && \
    playwright install chromium && \
    echo "Playwright installed successfully"  # Debug

# Stage 2: Main app image
FROM python:3.11-slim

# Copy Playwright cache from installer stage
COPY --from=installer /root/.cache/ms-playwright /root/.cache/ms-playwright

# Set working directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Create generated directories
RUN mkdir -p static/screenshots static/gifs static/pdfs static/css static/js

# Debug: Check browser cache
RUN ls /root/.cache/ms-playwright/chromium-*/chrome-linux || echo "Browser cache missing!"

# Expose port
EXPOSE 5000

# Run the app
CMD ["python", "app.py"]
