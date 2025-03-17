#!/bin/sh

# Check if IPFS_PATH environment variable is set
if [ -z "$IPFS_PATH" ]; then
	echo "IPFS_PATH environment variable is not set"
	exit 1
fi

# Check if the IPFS_PATH directory exists
if [ ! -d "$IPFS_PATH" ]; then
	echo "Directory $IPFS_PATH does not exist"
	exit 0
fi

echo "Removing stale lockfile..."
rm -f "$IPFS_PATH/repo.lock"
