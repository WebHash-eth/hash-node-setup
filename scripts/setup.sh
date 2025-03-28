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
NODE_DATA_DIR_NAME=.webhash-node-data

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

	export DOCKER_GID=$(getent group docker | cut -d: -f3)

	if [ -z "$DOCKER_GID" ]; then
		echo "Docker group not found. Unknown problem when installing docker."
		exit 1
	fi
}

# Function to get public IP
get_public_ip() {
	curl -s -4 ifconfig.me
}

select_storage_disk() {
	echo "Do you want to use a separate disk for storage? (y/n)"
	read -r use_separate_disk

	if [[ "$use_separate_disk" =~ ^[Nn] ]]; then
		CHOSEN_DISK="/"
		STORAGE_PATH="/root/$NODE_DATA_DIR_NAME"
		if sudo mkdir -p "$STORAGE_PATH" 2>/dev/null; then
			echo "✓ Using default path: $STORAGE_PATH"
			return 0
		else
			echo "Error: Cannot write to default path $CHOSEN_DISK. Please try another location."
			exit 1
		fi
	fi

	echo "Select storage location for IPFS:"
	echo "--------------------------------"

	# Get mounted paths and display as options
	declare -a mount_points

	counter=1
	echo "Available mount points:"
	echo "----------------------------------------"
	printf "  #  %-10s %-8s %-20s\n" "NAME" "SIZE" "MOUNTPOINT"
	echo "----------------------------------------"
	while IFS="|" read -r name size mountpoint; do
		if [ ! -z "$name" ] &&
			# exclude boot and swap partitions
			[[ ! "$mountpoint" =~ ^/boot ]] &&
			[[ ! "$mountpoint" = "[SWAP]" ]]; then
			mount_points+=("$mountpoint")
			printf "  %-2d %-10s %-8s %-20s\n" "$counter" "$name" "$size" "$mountpoint"
			((counter++))
		fi
	done < <(lsblk --json -o NAME,SIZE,MOUNTPOINT |
		jq -r '.blockdevices[] | recurse(.children[]?) | 
		select(.mountpoint != null) | 
		"\(.name)|\(.size)|\(.mountpoint)"')

	# Add custom path option
	mount_points+=("custom")
	echo "  $counter  Enter custom path"

	while true; do
		echo -e "\nEnter selection number:"
		read -r selection

		if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -le "$counter" ]; then
			if [ "${mount_points[$((selection - 1))]}" == "custom" ]; then
				echo "Enter custom path (e.g., /mnt/data):"
				read -r CHOSEN_DISK
			else
				CHOSEN_DISK="${mount_points[$((selection - 1))]}"
			fi

			echo "choosen diskk $CHOSEN_DISK"
			if [ "$CHOSEN_DISK" = "/" ]; then
				STORAGE_PATH="/root/$NODE_DATA_DIR_NAME"
			else
				STORAGE_PATH="$CHOSEN_DISK/$NODE_DATA_DIR_NAME"
			fi
			if sudo mkdir -p "$STORAGE_PATH" 2>/dev/null; then
				echo "✓ Selected disk: $CHOSEN_DISK"
				return 0
			else
				echo "Error: Cannot write to $CHOSEN_DISK. Please try another location."
			fi
		else
			echo "Invalid selection. Please try again."
		fi
	done
}

move_existing_data() {
	# Check if node_data volume exists
	if sudo docker volume ls -q | grep -q "^webhash-node_node_data$"; then
		echo "Moving IPFS data to $STORAGE_PATH"
		local existing_ipfs_dir=$(sudo docker volume inspect webhash-node_node_data | jq -r '.[0] | .Mountpoint')
		sudo cp -r "$existing_ipfs_dir" "$STORAGE_PATH_IPFS"
		sudo docker volume rm webhash-node_node_data >/dev/null
	fi

	# Check if node_export volume exists
	if sudo docker volume ls -q | grep -q "^webhash-node_node_export$"; then
		echo "Moving export data to $STORAGE_PATH"
		local existing_export_dir=$(sudo docker volume inspect webhash-node_node_export | jq -r '.[0] | .Mountpoint')
		sudo cp -r "$existing_export_dir" "$STORAGE_PATH_EXPORT"
		sudo docker volume rm webhash-node_node_export >/dev/null
	fi
}

# Function to start node, configure it and return peer ID
start_node() {
	local public_ip=$1
	echo "Starting node with public IP: $public_ip..."

	# Start the container with PRIVATE_KEY env var
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
	local address=$1
	local public_ip=$2
	local storage=$3
	# Capture the JSON response from node-init.js
	local response=$("$BUN_PATH" ./scripts/node-init.js "$address" "$public_ip" "$storage")
	# Extract telemetry config from response and write to .env file
	# NOTE: This env file is used in telegraf
	{
		echo "INFLUXDB_URL=$(echo "$response" | jq -r '.telemetry.url')"
		echo "INFLUXDB_TOKEN=$(echo "$response" | jq -r '.telemetry.token')"
		echo "INFLUXDB_ORG=$(echo "$response" | jq -r '.telemetry.org')"
		echo "INFLUXDB_BUCKET=$(echo "$response" | jq -r '.telemetry.bucket')"
		echo "ADDRESS=$address"
	} >.env
}

register_node() {
	echo "Registering node with peer ID: $PEER_ID"
	PRIVATE_KEY="$1" \
		PUBLIC_IP="$2" \
		PEER_ID="$3" \
		STORAGE="$4" \
		"$BUN_PATH" ./bin/register-node.js
	echo "Node registered successfully with peer ID: $PEER_ID"
}

clone_repo() {
	# Check if git is installed, if not install it
	if ! command -v git &>/dev/null; then
		echo "Git not found. Installing Git..."
		install_dependency git >/dev/null
	fi

	if [ -d "$REPO_PATH" ]; then
		echo "Repository exists. Stopping running containers..."
		if [ -f "$REPO_PATH/docker-compose.yaml" ]; then
			sudo docker compose -f "$REPO_PATH/docker-compose.yaml" down &>/dev/null || true
		fi
		rm -rf "$REPO_PATH"
	fi
	echo "Cloning repository..."
	git clone https://github.com/WebHash-eth/hash-node-setup.git $REPO_PATH --depth=1 &>/dev/null
	cd "$REPO_PATH"
}

clone_repo

# Main execution
install_docker

install_bun
ensure_jq
import_evm_key

PUBLIC_IP=$(get_public_ip)
echo "Public IP: $PUBLIC_IP"
PRIVATE_KEY=$(sudo cat $EVM_KEY_FILE | jq -r '.privateKey')
ADDRESS=$(sudo cat $EVM_KEY_FILE | jq -r '.address')

select_storage_disk

STORAGE="$(df -B1 $CHOSEN_DISK | awk 'NR==2 {print $4}')"
STORAGE_PATH_IPFS="$STORAGE_PATH/ipfs"
echo "STORAGE_PATH_IPFS=$STORAGE_PATH_IPFS" >>.env
STORAGE_PATH_EXPORT="$STORAGE_PATH/export"
echo "STORAGE_PATH_EXPORT=$STORAGE_PATH_EXPORT" >>.env

move_existing_data
node_init "$ADDRESS" "$PUBLIC_IP" "$STORAGE"
start_node "$PUBLIC_IP"

# Get and return peer ID
PEER_ID=$(sudo docker exec node ipfs id -f='<id>')
echo "Node started with peer ID: $PEER_ID"

register_node "$PRIVATE_KEY" "$PUBLIC_IP" "$PEER_ID" "$STORAGE"
