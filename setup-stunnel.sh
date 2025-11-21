#!/bin/bash

# Setup script for stunnel RTMPS proxy
# This script installs and configures stunnel for reliable RTMPS streaming

echo "Setting up stunnel for RTMPS streaming..."

# Check if stunnel is installed
if ! command -v stunnel &> /dev/null
then
    echo "stunnel could not be found, installing..."
    
    # Install stunnel based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install stunnel
        else
            echo "Homebrew not found. Please install Homebrew first or install stunnel manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install stunnel4
        elif command -v yum &> /dev/null; then
            sudo yum install stunnel
        else
            echo "Package manager not found. Please install stunnel manually."
            exit 1
        fi
    else
        echo "Unsupported OS. Please install stunnel manually."
        exit 1
    fi
else
    echo "stunnel is already installed"
fi

# Create stunnel configuration directory if it doesn't exist
sudo mkdir -p /etc/stunnel

# Copy configuration file
sudo cp stunnel.conf /etc/stunnel/rtmps.conf

# Create stunnel certificate directory if it doesn't exist
sudo mkdir -p /etc/stunnel/certs

echo "stunnel setup completed!"
echo ""
echo "To start stunnel, run:"
echo "sudo stunnel /etc/stunnel/rtmps.conf"
echo ""
echo "To start stunnel in the background:"
echo "sudo stunnel"
echo ""
echo "To verify stunnel is running:"
echo "ps aux | grep stunnel"