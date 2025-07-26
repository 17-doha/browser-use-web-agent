FROM python:3.11-slim

# Install system dependencies for Playwright
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
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers
RUN pip install playwright && playwright install --with-deps chromium

# Set working directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code (including static files)
COPY . .

# Create static directories if not copied
RUN mkdir -p static/screenshots static/gifs static/pdfs static/css static/js

# Debug: List copied files to verify
RUN ls -la /app/static/css && ls -la /app/static/js || echo "Static files missing!"

# Expose port
EXPOSE 5000

# Run the app
CMD ["python", "app.py"]
