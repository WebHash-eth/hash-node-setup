#!/bin/bash

# Exit on any error
set -e
# Exit on undefined variable
set -u
# Print each command before executing (optional, good for debugging)
# set -x

EVM_KEY_FILE=/opt/webhash-node/evm.key
BUN_PATH=~/.bun/bin/bun
REPO_PATH=~/.webhash-node

# Function to handle errors
trap 'echo "An error occurred. Exiting..." >&2' ERR

# Function to detect OS and install dependencies
install_dependency() {
	local package=$1

	if [ -f /etc/os-release ]; then
		. /etc/os-release
		OS=$ID
	elif [ -f /etc/redhat-release ]; then
		OS="rhel"
	elif [ -f /etc/debian_version ]; then
		OS="debian"
	else
		echo "Unsupported operating system"
		exit 1
	fi

	echo "Installing $package on $OS..."

	case $OS in
	"ubuntu" | "debian")
		sudo apt-get install -y "$package"
		;;
	"rhel" | "centos" | "fedora")
		sudo yum install -y "$package"
		;;
	*)
		echo "Unsupported operating system: $OS"
		exit 1
		;;
	esac
}

install_docker() {
	if ! command -v docker &>/dev/null; then
		echo "Docker not found. Installing Docker..."
		# Install Docker using the official install script
		curl -fsSL https://get.docker.com | sudo bash >/dev/null

		# Verify Docker installation
		docker_version=$(docker --version)
		if [ $? -eq 0 ]; then
			echo "Docker installation verified: $docker_version"
		else
			echo "Docker installation failed"
			exit 1
		fi
	else
		echo "Docker is already installed"
	fi
}

# Function to get public IP
get_public_ip() {
	curl -s -4 ifconfig.me
}

# Function to start node, configure it and return peer ID
start_node() {
	local public_ip=$1
	echo "Starting node..."

	# Start the container
	PRIVATE_KEY=$PRIVATE_KEY sudo -E docker compose up -d --build

	# Wait for node to be ready
	echo "Waiting for node container to be ready..."
	while ! sudo docker exec node ipfs id &>/dev/null; do
		echo "Waiting for daemon to start..."
		sleep 2
	done

	# Configure node
	echo "Configuring node..."
	sudo docker exec node ipfs config --json Addresses.Swarm "[\"/ip4/0.0.0.0/tcp/4001\", \"/ip4/0.0.0.0/udp/4001/quic\", \"/ip4/$public_ip/tcp/4001\", \"/ip4/$public_ip/udp/4001/quic\"]"

	# Restart to apply changes
	sudo docker restart node >/dev/null

	# Wait for restart
	while ! sudo docker exec node ipfs id &>/dev/null; do
		sleep 2
	done

}

# Function to import EVM key
import_evm_key() {
	if [ ! -f "$EVM_KEY_FILE" ]; then
		sudo mkdir -p "$(dirname "$EVM_KEY_FILE")"
		while true; do
			echo "Please enter your private key (0x... format):"
			read -r PRIVATE_KEY

			# Verify the key format and validity
			# Temporarily disable exit on error for this command
			set +e
			KEY_JSON=$("$BUN_PATH" ./bin/verify-key.js "$PRIVATE_KEY" 2>/dev/null) # redirect stderr to /dev/null
			STATUS=$?
			# Re-enable exit on error
			set -e
			if [ $STATUS -eq 0 ]; then
				local address=$(echo "$KEY_JSON" | awk -F'"' '/"address":/{print $4}')
				echo "✓ Key verified! Address: $address"
				echo "$KEY_JSON" | sudo tee "$EVM_KEY_FILE" >/dev/null
				break
			else
				echo "Invalid private key. Please try again."
			fi
		done
	fi
}

install_bun() {
	if ! command -v "$BUN_PATH" &>/dev/null; then
		if ! command -v unzip &>/dev/null; then
			# required for bun install
			install_dependency unzip >/dev/null
		fi
		echo "Bun not found. Installing Bun..."
		curl -fsSL https://bun.sh/install | bash >/dev/null
	else
		echo "Bun is already installed"
	fi
}

ensure_jq() {
	if ! command -v jq &>/dev/null; then
		echo "Installing jq..."
		install_dependency jq >/dev/null
	fi
}

node_init() {
	# Capture the JSON response from node-init.js
	local response=$("$BUN_PATH" ./scripts/node-init.js "$1" "$2" "$3")
	# Extract telemetry config from response and write to .env file
	# NOTE: This env file is used in telegraf
	{
		echo "INFLUXDB_URL=$(echo "$response" | jq -r '.telemetry.url')"
		echo "INFLUXDB_TOKEN=$(echo "$response" | jq -r '.telemetry.token')"
		echo "INFLUXDB_ORG=$(echo "$response" | jq -r '.telemetry.org')"
		echo "INFLUXDB_BUCKET=$(echo "$response" | jq -r '.telemetry.bucket')"
	} >>.env
}

register_node() {
	echo "Registering node with peer ID: $PEER_ID"
	PRIVATE_KEY="$1" \
		PUBLIC_IP="$2" \
		PEER_ID="$3" \
		STORAGE="$4" \
		"$BUN_PATH" ./bin/register-node.js >/dev/null
	echo "Node registered successfully with peer ID: $PEER_ID"
}

clone_repo() {
	# Check if git is installed, if not install it
	if ! command -v git &>/dev/null; then
		echo "Git not found. Installing Git..."
		install_dependency git >/dev/null
	fi

	rm -rf $REPO_PATH >/dev/null
	git clone https://github.com/WebHash-eth/hash-node-setup.git $REPO_PATH --depth=1 >/dev/null
	cd $REPO_PATH
}

clone_repo

# Main execution
install_docker
install_bun
ensure_jq
import_evm_key

PUBLIC_IP=$(get_public_ip)
PRIVATE_KEY=$(sudo cat $EVM_KEY_FILE | jq -r '.privateKey')
ADDRESS=$(sudo cat $EVM_KEY_FILE | jq -r '.address')
STORAGE="$(df -B1 / | awk 'NR==2 {print $4}')"

node_init "$ADDRESS" "$PUBLIC_IP" "$STORAGE"
start_node "$PUBLIC_IP"

# Get and return peer ID
PEER_ID=$(sudo docker exec node ipfs id -f='<id>')
echo "Node started with peer ID: $PEER_ID"

register_node "$PRIVATE_KEY" "$PUBLIC_IP" "$PEER_ID" "$STORAGE"
