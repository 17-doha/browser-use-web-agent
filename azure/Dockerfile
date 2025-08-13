FROM python:3.11-slim

# Install system dependencies for Playwright and PostgreSQL
RUN apt-get update && apt-get install -y \
    fonts-liberation \
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
    libpq-dev \
    gcc \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update CA certificates for SSL connections
RUN update-ca-certificates

# Create www-data user and group (mimics Azure App Service default)
RUN groupadd -r www-data && useradd -r -g www-data -u 33 -m www-data

# Set working directory
WORKDIR /opt/defaultsite

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and its dependencies
RUN pip install playwright && playwright install-deps chromium

# Set custom browser path for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/www-data/.cache/ms-playwright

# Create directories for browser binaries and application data
RUN mkdir -p /home/www-data/.cache/ms-playwright \
    && mkdir -p static/screenshots static/gifs static/pdfs static/css static/js app_static/gifs app_static/pdfs \
    && mkdir -p /home/www-data/.config/browseruse /opt/defaultsite/.config/browseruse \
    && chown -R www-data:www-data /home/www-data /opt/defaultsite

# Copy application code
COPY . .

# Change ownership to www-data
RUN chown -R www-data:www-data /opt/defaultsite

# Switch to www-data user
USER www-data

# Install Playwright browsers
RUN playwright install chromium

# Verify browser installation
RUN python -c "from playwright.async_api import async_playwright; import asyncio; async def check(): ap = async_playwright(); await ap.__aenter__(); browser = await ap.chromium.launch(); await browser.close(); await ap.__aexit__(None, None, None); asyncio.run(check())"

# Expose port
ENV PORT=8080
EXPOSE 8080

# Set environment variables for SSL, database, and Playwright
ENV PYTHONUNBUFFERED=1
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_DIR=/etc/ssl/certs
ENV PYTHONPATH=/opt/defaultsite
ENV PGCLIENTENCODING=utf8

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/', timeout=5)" || exit 1

# Run the application with gunicorn
# Adjust 'app:app' to 'application:app' if your WSGI object is named 'application'
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "600", "--access-logfile", "-", "--error-logfile", "-", "--chdir", "/opt/defaultsite", "app:app"]