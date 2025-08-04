#!/bin/bash

# Exit on any error
set -e

# Deployment steps
echo "Starting deployment..."

# Install project dependencies (e.g., via pip for Python)
if [ -f requirements.txt ]; then
    echo "Installing Python dependencies..."
    python -m pip install -r requirements.txt
fi

# Install Playwright and download browsers
echo "Installing Playwright and browsers..."
python -m playwright install --with-deps

echo "Deployment completed successfully."