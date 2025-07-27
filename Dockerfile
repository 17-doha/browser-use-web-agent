# Stage 1: Install Playwright and browsers in a temp image
# Stage 1
FROM python:3.11-slim AS installer
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && \
    pip install playwright && \
    playwright install-deps chromium && \
    playwright install chromium && \
    rm -rf /var/lib/apt/lists/*


# Stage 2: Main app image
FROM python:3.11-slim

# Install system dependencies (same as needed in Stage 1 for runtime)
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
    && rm -rf /var/lib/apt/lists/*

# Copy Playwright cache from installer stage
COPY --from=installer /root/.cache/ms-playwright /root/.cache/ms-playwright

# Set working directory
WORKDIR /app

# Copy and install requirements (ensure it includes 'playwright' if needed)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Create generated directories
RUN mkdir -p static/screenshots static/gifs static/pdfs static/css static/js

# Optional: Add a non-root user for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Run the app
CMD ["python", "app.py"]
