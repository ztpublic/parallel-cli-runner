#!/bin/bash
# Docker build script for Parallel CLI Runner Windows extension

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$PROJECT_ROOT/artifacts"

# Print banner
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Parallel CLI Runner - Docker Build${NC}"
echo -e "${BLUE}  Windows x64 Extension${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

# Print status
echo -e "${GREEN}[INFO]${NC} Building Windows x64 extension..."
echo -e "${GREEN}[INFO]${NC} Project root: $PROJECT_ROOT"
echo -e "${GREEN}[INFO]${NC} Artifacts directory: $ARTIFACTS_DIR"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Build
docker build \
    --target artifacts \
    -f docker/Dockerfile \
    -t parallel-cli-runner:win-x64 \
    .

# Extract artifacts from the image
docker run --rm \
    -v "$ARTIFACTS_DIR:/artifacts" \
    parallel-cli-runner:win-x64 \
    bash -c "cp /artifacts/*.vsix /host/artifacts/ 2>/dev/null || true" || \
docker run --rm \
    -v "$ARTIFACTS_DIR:/host/artifacts" \
    parallel-cli-runner:win-x64 \
    bash -c "cp /artifacts/*.vsix /host/artifacts/ 2>/dev/null || cp -r /artifacts/* /host/artifacts/"

echo ""
echo -e "${GREEN}[INFO]${NC} Build complete!"
echo ""
echo -e "${GREEN}[INFO]${NC} Artifacts:"
ls -lah "$ARTIFACTS_DIR/"*.vsix 2>/dev/null || echo "No artifacts found"
echo ""
