#!/bin/bash

# Exit on any error
set -e
# Exit on undefined variable
set -u
# Print each command before executing (optional, good for debugging)
# set -x

EVM_KEY_FILE=/opt/webhash-node/evm.key
BUN_PATH=~/.bun/bin/bun
REPO_PATH=/opt/webhash-node/repo
NODE_DATA_DIR_NAME=.webhash-node-data
CONFIG_FILE=/opt/webhash-node/config.json
CHAIN_ID="84532" # base sepolia
VERSION="0.3.0"

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

# Function to add or update environment variable
add_env() {
	local key=$1
	local value=$2
	local env_file=".env"

	sudo touch "$env_file"

	if grep -q "^${key}=" "$env_file"; then
		sudo sed -i.bak "s|^${key}=.*|${key}=${value}|" "$env_file" && rm "${env_file}.bak"
	else
		echo "${key}=${value}" | sudo tee -a "$env_file" >/dev/null
	fi
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
	# stop and remove old containers
	sudo docker stop node pinner telegraf &>/dev/null || true
	sudo docker rm node pinner telegraf &>/dev/null || true

	# Check if node_data volume exists
	if sudo docker volume ls -q | grep -q "^webhash-node_node_data$"; then
		echo "Moving IPFS data to $STORAGE_PATH_IPFS"
		local existing_ipfs_dir=$(sudo docker volume inspect webhash-node_node_data | jq -r '.[0] | .Mountpoint')
		echo "Existing IPFS dir: $existing_ipfs_dir"
		sudo cp -r "$existing_ipfs_dir" "$STORAGE_PATH_IPFS"

		# sudo docker volume rm webhash-node_node_data >/dev/null
	fi

	# Check if node_export volume exists
	if sudo docker volume ls -q | grep -q "^webhash-node_node_export$"; then
		echo "Moving export data to $STORAGE_PATH_EXPORT"
		local existing_export_dir=$(sudo docker volume inspect webhash-node_node_export | jq -r '.[0] | .Mountpoint')
		echo "Existing export dir: $existing_export_dir"
		sudo cp -r "$existing_export_dir" "$STORAGE_PATH_EXPORT"

		# sudo docker volume rm webhash-node_node_export >/dev/null
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
	sudo docker exec node ipfs config --json Addresses.Announce '[
	  "/ip4/'"$public_ip"'/tcp/4001",
	  "/ip4/'"$public_ip"'/udp/4001/quic-v1",
	  "/ip4/'"$public_ip"'/udp/4001/quic-v1/webtransport"
	]'
	sudo docker exec node ipfs config --json Reprovider.Strategy '"pinned"'
	sudo docker exec node ipfs config --json Routing.AcceleratedDHTClient true

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

update_config_json() {
	local key=$1
	local value=$2

	# if file doesnt exists or invalid json
	if ! sudo jq empty "$CONFIG_FILE" >/dev/null 2>&1; then
		echo "{}" | sudo tee "$CONFIG_FILE" >/dev/null
	fi

	# use temp file just to be safe
	local temp_config=$(mktemp)
	sudo cat "$CONFIG_FILE" >"$temp_config"
	jq --arg key "$key" --arg value "$value" '.[$key] = $value' "$temp_config" | sudo tee "$CONFIG_FILE" >/dev/null
	rm "$temp_config"
}

get_node_provider_url() {
	local target_chain_id=$1   # the expected chain ID (e.g., "84532", "1")
	local target_chain_name=$2 # human readable name of the chain
	local config_key=$3        # config key to use; will be used to read from config.json
	local result_url=""        # the validated WebSocket URL

	if [[ -f "$CONFIG_FILE" ]]; then
		local existing_url=$(sudo jq -r --arg key "$config_key" '.[$key] // empty' "$CONFIG_FILE" 2>/dev/null)
		if [[ -n "$existing_url" && "$existing_url" == wss://* ]]; then
			# Validate the chain ID of the existing URL
			local existing_chain_id=$("$BUN_PATH" "./bin/get-chain-id.js" "$existing_url" 2>/dev/null || echo "error")
			# if the chain ID is correct, use the existing URL
			if [[ "$existing_chain_id" == "$target_chain_id" ]]; then
				echo "✓ Using existing $target_chain_name Node Provider URL from config: $existing_url" >&2
				result_url="$existing_url"
			else
				echo "ℹ️ Existing URL in config for '$config_key' has incorrect chain ID (expected $target_chain_id, got $existing_chain_id). Prompting for new URL." >&2
			fi
		fi
	fi

	# If no valid URL found yet, prompt the user
	if [[ -z "$result_url" ]]; then
		while true; do
			echo "Please enter your $target_chain_name node provider WebSocket URL (wss://...):" >&2
			read -r input_url

			if [[ "$input_url" == wss://* ]]; then

				local remote_chain_id=$("$BUN_PATH" "./bin/get-chain-id.js" "$input_url" 2>/dev/null || echo "error")

				if [[ "$remote_chain_id" == "error" ]]; then
					echo "Error: Failed to get chain ID from the node provider URL." >&2
					echo "       Please check the URL, ensure the node is running, and verify network connectivity." >&2
					continue
				fi

				if [[ "$remote_chain_id" != "$target_chain_id" ]]; then
					echo "Error: Chain ID mismatch for $target_chain_name network." >&2
					echo "       Expected chain ID: $target_chain_id" >&2
					echo "       Got chain ID from URL: $remote_chain_id" >&2
					echo "Please provide a node provider URL for the correct network." >&2
					continue
				fi

				echo "✓ Chain ID verified successfully for $target_chain_name ($remote_chain_id)." >&2
				result_url="$input_url"
				break
			else
				echo "Invalid format. URL must start with wss://" >&2
			fi
		done
	fi
	echo "$result_url"
}

get_user_email() {
	local config_key="email"
	local result_email=""

	# Check if email exists in config
	if [[ -f "$CONFIG_FILE" ]]; then
		local existing_email=$(sudo jq -r --arg key "$config_key" '.[$key] // empty' "$CONFIG_FILE" 2>/dev/null)
		# Basic validation: check if it contains '@'
		if [[ -n "$existing_email" && "$existing_email" == *"@"* ]]; then
			echo "✓ Using existing email from config: $existing_email" >&2
			result_email="$existing_email"
		fi
	fi

	# If no valid email found in config, prompt the user
	if [[ -z "$result_email" ]]; then
		while true; do
			echo "Please enter your email address:" >&2
			read -r input_email

			# Basic validation: check if it contains '@'
			if [[ "$input_email" == *"@"* ]]; then
				echo "✓ Email format looks valid." >&2
				result_email="$input_email"
				# Save the email to config
				update_config_json "$config_key" "$result_email"
				break
			else
				echo "Invalid email format. Please ensure it contains '@'." >&2
			fi
		done
	fi
	echo "$result_email"
}

ensure_jq() {
	if ! command -v jq &>/dev/null; then
		echo "Installing jq..."
		install_dependency jq >/dev/null
	fi
}

node_init() {
	# Capture the JSON response from node-init.js
	local response=$(
		ADDRESS="$ADDRESS" \
			PUBLIC_IP="$PUBLIC_IP" \
			STORAGE="$STORAGE" \
			VERSION="$VERSION" \
			EMAIL="$EMAIL" \
			"$BUN_PATH" ./scripts/node-init.js
	)
	# Extract telemetry config from response and write to .env file
	# NOTE: These envs are used in telegraf
	add_env "INFLUXDB_URL" "$(echo "$response" | jq -r '.telemetry.url')"
	add_env "INFLUXDB_TOKEN" "$(echo "$response" | jq -r '.telemetry.token')"
	add_env "INFLUXDB_ORG" "$(echo "$response" | jq -r '.telemetry.org')"
	add_env "INFLUXDB_BUCKET" "$(echo "$response" | jq -r '.telemetry.bucket')"
	add_env "ADDRESS" "$ADDRESS"
}

register_node() {
	echo "Registering node with peer ID: $PEER_ID"
	# Use global variables directly
	PRIVATE_KEY="$PRIVATE_KEY" \
		PEER_ID="$PEER_ID" \
		STORAGE="$STORAGE" \
		CHAIN_ID="$CHAIN_ID" \
		"$BUN_PATH" ./bin/register-node.js
	echo "Node registered successfully with peer ID: $PEER_ID"
}

clone_repo() {
	# Check if git is installed, if not install it
	if ! command -v git &>/dev/null; then
		echo "Git not found. Installing Git..."
		install_dependency git >/dev/null
	fi

	sudo rm -rf "$REPO_PATH"
	sudo rm -rf "~/.webhash-node" # remove old path

	echo "Cloning repository..."
	sudo git clone https://github.com/WebHash-eth/hash-node-setup.git $REPO_PATH &>/dev/null
	cd "$REPO_PATH"
}

clone_repo

install_docker
install_bun
ensure_jq
import_evm_key

# Get Base Sepolia Node Provider URL (Primary)

NODE_PROVIDER_URL=$(get_node_provider_url "$CHAIN_ID" "Base Sepolia" "nodeProviderWsUrl")
ETH_MAINNET_NODE_PROVIDER_URL=$(get_node_provider_url "1" "Ethereum Mainnet" "ethMainnetNodeProviderWsUrl")

add_env "NODE_PROVIDER_URL" "$NODE_PROVIDER_URL"
add_env "ETH_MAINNET_NODE_PROVIDER_URL" "$ETH_MAINNET_NODE_PROVIDER_URL"

# Get user email
EMAIL=$(get_user_email)
update_config_json "email" "$EMAIL"

PUBLIC_IP=$(get_public_ip)
echo "Public IP: $PUBLIC_IP"
PRIVATE_KEY=$(sudo cat $EVM_KEY_FILE | jq -r '.privateKey')
ADDRESS=$(sudo cat $EVM_KEY_FILE | jq -r '.address')

select_storage_disk

STORAGE="$(df -B1 $CHOSEN_DISK | awk 'NR==2 {print $4}')"
STORAGE_PATH_IPFS="$STORAGE_PATH/ipfs"
add_env "STORAGE_PATH_IPFS" "$STORAGE_PATH_IPFS"
STORAGE_PATH_EXPORT="$STORAGE_PATH/export"
add_env "STORAGE_PATH_EXPORT" "$STORAGE_PATH_EXPORT"

move_existing_data
node_init
start_node "$PUBLIC_IP"

# Get and return peer ID
PEER_ID=$(sudo docker exec node ipfs id -f='<id>')
echo "Node started with peer ID: $PEER_ID"

register_node

# Update config only with the primary node provider URL (Base Sepolia)
update_config_json "chainId" "$CHAIN_ID"
update_config_json "nodeProviderWsUrl" "$NODE_PROVIDER_URL"
update_config_json "ethMainnetNodeProviderWsUrl" "$ETH_MAINNET_NODE_PROVIDER_URL"
update_config_json "storagePath" "$STORAGE_PATH"

echo ""
echo "----------------------------------------"
echo "Setup complete!"
echo "Join our Discord and Telegram for the latest updates and quick support if you have any questions:"
echo "Discord: https://discord.gg/zUpBGJ4uh5"
echo "Telegram: https://t.me/webhashgroup"
echo "----------------------------------------"

cd ~
