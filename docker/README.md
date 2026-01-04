# Docker Build System

This directory contains the Docker-based build system for Parallel CLI Runner. It builds the **Windows x64 extension** via cross-compilation from Linux.

## Quick Start

### Using npm script (Recommended)

```bash
npm run docker:build
```

### Using the build script directly

```bash
cd docker
./build.sh
```

### Using docker-compose

```bash
cd docker
docker compose up
```

## Build Artifacts

The built VSIX file is placed in the `artifacts/` directory at the project root:

```
artifacts/
└── parallel-cli-runner-win32-x64.vsix
```

## Platform Notes

### Windows x64

The Windows binary is cross-compiled from Linux using the `x86_64-pc-windows-gnu` target with `mingw-w64`. This works reliably in Docker without requiring a Windows host.

### Mac ARM64

For Mac ARM64 builds, use the native macOS build scripts:

```bash
# On macOS only
npm run extension:package:mac-arm64
```

Docker-based Mac builds require [osxcross](https://github.com/tpoechtrager/osxcross), which is complex to set up and not recommended.

## Dockerfile Stages

| Stage | Purpose |
|-------|---------|
| `base` | Base image with Node.js and Rust |
| `deps` | Install npm dependencies |
| `build-win-x64` | Cross-compile Windows binary |
| `build-frontend` | Build Vite frontend |
| `build-extension-ts` | Compile VS Code extension TypeScript |
| `package-win-x64` | Package Windows extension |
| `artifacts` | Export built extension |

## Requirements

- Docker 20.10+
- Docker Compose 2.0+ (for docker-compose commands)
- ~2GB disk space for Docker images

## Troubleshooting

### Build fails with "permission denied"

Make sure the build script is executable:
```bash
chmod +x docker/build.sh
```

### Artifacts directory not found

The build script will create the `artifacts/` directory automatically.

### First build is slow

First-time builds download Rust toolchain and npm dependencies. Subsequent builds will be faster due to Docker layer caching.

### Out of disk space

Clean up unused Docker resources:
```bash
docker system prune -a
```
