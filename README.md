# Hash Node Setup Guide

## Quick Start

Run the following command to download and execute the setup script:

```bash
curl -fsSL https://raw.githubusercontent.com/WebHash-eth/hash-node-setup/refs/heads/main/scripts/setup.sh > setup.sh && chmod +x setup.sh && ./setup.sh
```

## What the Script Does

The setup script automates the entire process of setting up a Hash Node. Here's a detailed breakdown of what happens:

1. **Initial Setup**

   - Downloads and sets up the necessary repository
   - Installs Git if not already present
   - Clones the Hash Node setup repository

2. **Dependencies Installation**

   - Installs Docker if not present (using official Docker installation script)
   - Installs Bun runtime for JavaScript execution

3. **Key Configuration**

   - Prompts for your private key (in 0x... format)
   - Validates the private key format and authenticity
   - Securely stores the key in `/opt/webhash-node/evm.key`

4. **Node Configuration**

   - Starts the IPFS node using Docker
   - Automatically configures network settings
   - Sets up proper swarm addresses using your public IP
   - Configures necessary ports (4001 TCP/UDP)

5. **Node Registration**
   - Retrieves your public IP address automatically from `ifconfig.me`
   - Registers your node with the Hash Network Contracts

## Requirements

- A Unix-like operating system (Ubuntu, Debian, RHEL, CentOS, or Fedora)
- Root/sudo access
- Internet connectivity

## Security Notes

- The script requires sudo privileges for Docker operations and key storage
- Your private key is stored in `/opt/webhash-node/evm.key`

## Ports Used

- TCP/UDP 4001: IPFS swarm port
