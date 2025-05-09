#!/bin/bash
set -e
echo "Installing Python requirements..."
# Use pip3 if your system primarily uses python2 for 'pip'
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "Error: pip or pip3 command not found. Please install Python and pip."
    exit 1
fi
echo "Installation finished."