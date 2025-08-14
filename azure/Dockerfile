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
    # Additional fonts and dependencies
    fonts-dejavu-core \
    fonts-freefont-ttf \
    libgbm1 \
    libxcursor1 \
    libxi6 \
    libxrender1 \
    libxkbcommon0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update CA certificates for SSL connections
RUN update-ca-certificates

# Ensure www-data user exists and has a home directory
RUN id -u www-data >/dev/null 2>&1 || (groupadd -r www-data && useradd -r -g www-data -u 33 -m -d /home/www-data www-data)

# Set working directory
WORKDIR /opt/defaultsite

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install gunicorn
RUN pip install --no-cache-dir gunicorn

# Install Playwright
RUN pip install playwright

# Set custom browser path for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/www-data/.cache/ms-playwright

# Create directories for browser binaries and application data
RUN mkdir -p /home/www-data/.cache/ms-playwright \
    && mkdir -p /home/www-data/.config/browseruse/profiles \
    && mkdir -p /opt/defaultsite/static/screenshots \
    && mkdir -p /opt/defaultsite/static/gifs \
    && mkdir -p /opt/defaultsite/static/pdfs \
    && mkdir -p /opt/defaultsite/static/css \
    && mkdir -p /opt/defaultsite/static/js \
    && mkdir -p /opt/defaultsite/app_static/gifs \
    && mkdir -p /opt/defaultsite/app_static/pdfs \
    && mkdir -p /opt/defaultsite/.config/browseruse/profiles \
    && chown -R www-data:www-data /home/www-data /opt/defaultsite

# Copy application code
COPY . .

# Install Playwright browsers as www-data user
USER www-data
RUN playwright install chromium

# Debug: Check browser installation
RUN find /home/www-data/.cache/ms-playwright -name "chrome" -type f 2>/dev/null | head -5 || echo "No chrome binary found"
RUN ls -la /home/www-data/.cache/ms-playwright/ || echo "Playwright cache directory empty"

# Switch back to root for final setup
USER root
# Ensure permissions are correct
RUN chown -R www-data:www-data /home/www-data /opt/defaultsite

# Switch back to www-data user
USER www-data

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
# Additional Playwright environment variables for Docker
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
ENV DISPLAY=:99
# Disable sandboxing for Chromium in Docker
ENV PLAYWRIGHT_CHROMIUM_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/', timeout=5)" || exit 1

# Run the application with gunicorn and more verbose logging
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "1200", "--workers", "2", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "debug", "--chdir", "/opt/defaultsite", "app:app"]