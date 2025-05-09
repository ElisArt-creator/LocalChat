#!/bin/bash
set -e
echo "Starting the application..."
# Use python3 if that's how you run Python 3 scripts
if command -v python3 &> /dev/null; then
    python3 app.py
elif command -v python &> /dev/null; then
    python app.py
else
    echo "Error: python or python3 command not found. Please install Python."
    exit 1
fi
echo "Application stopped."