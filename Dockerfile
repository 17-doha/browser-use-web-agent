FROM python:3.11-slim

# Install system dependencies for Playwright and PostgreSQL
RUN apt-get update && apt-get install -y \
    # Essential system packages
    ca-certificates \
    fonts-liberation \
    fonts-unifont \
    libpq-dev \
    gcc \
    wget \
    gnupg \
    # Playwright/Chromium dependencies
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xvfb \
    # Additional fonts that might be needed
    fonts-dejavu-core \
    fonts-freefont-ttf \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update CA certificates for SSL connections
RUN update-ca-certificates

# Ensure www-data user exists and has a home directory
RUN id -u www-data >/dev/null 2>&1 || (groupadd -r www-data && useradd -r -g www-data -u 33 www-data) \
    && mkdir -p /home/www-data \
    && chown www-data:www-data /home/www-data

# Set working directory
WORKDIR /opt/defaultsite

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install gunicorn (in case it's not in requirements.txt)
RUN pip install --no-cache-dir gunicorn

# Install Playwright
RUN pip install playwright

# Set custom browser path for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/www-data/.cache/ms-playwright

# Create directories for browser binaries and application data
RUN mkdir -p /home/www-data/.cache/ms-playwright \
    && mkdir -p /home/www-data/.config/browseruse/profiles \
    && mkdir -p static/screenshots static/gifs static/pdfs static/css static/js app_static/gifs app_static/pdfs \
    && mkdir -p /opt/defaultsite/.config/browseruse/profiles \
    && chown -R www-data:www-data /home/www-data /opt/defaultsite

# Copy application code
COPY . .

# Change ownership to www-data
RUN chown -R www-data:www-data /opt/defaultsite

# Switch to www-data user
USER www-data

# Install Playwright browsers (without system dependencies to avoid the font issue)
RUN playwright install chromium

# Try to verify browser installation (don't fail build if this doesn't work)
RUN python -c "from playwright.async_api import async_playwright; import asyncio; async def check(): ap = async_playwright(); await ap.__aenter__(); browser = await ap.chromium.launch(); await browser.close(); await ap.__aexit__(None, None, None); asyncio.run(check())" || echo "Browser verification failed, but continuing..."

# Expose port
ENV PORT=8080
EXPOSE 8080

# Set environment variables for SSL, database, Playwright, and Browser-Use
ENV PYTHONUNBUFFERED=1
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_DIR=/etc/ssl/certs
ENV PYTHONPATH=/opt/defaultsite
ENV PGCLIENTENCODING=utf8
# Override browser-use config directory to writable location
ENV XDG_CONFIG_HOME=/home/www-data/.config
ENV BROWSER_USE_CONFIG_DIR=/home/www-data/.config/browseruse

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/', timeout=5)" || exit 1

# Run the application with gunicorn
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "600", "--access-logfile", "-", "--error-logfile", "-", "--chdir", "/opt/defaultsite", "app:app"]