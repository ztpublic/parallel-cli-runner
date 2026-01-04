# Dockerfile for building Parallel CLI Runner Windows x64 extension
# Cross-compiles Windows binary and packages VS Code extension

# =============================================================================
# Stage 1: Base image with Node.js and Rust toolchain
# =============================================================================
FROM node:20-bullseye AS base

# Install Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    mingw-w64 \
    zip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /project

# =============================================================================
# Stage 2: Install dependencies
# =============================================================================
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY vscode-extension/package*.json ./vscode-extension/

# Install dependencies
RUN npm ci
RUN npm ci --prefix vscode-extension

# =============================================================================
# Stage 3: Build Windows x64 binary (cross-compile)
# =============================================================================
FROM base AS build-win-x64

# Add Windows target
RUN rustup target add x86_64-pc-windows-gnu

# Copy dependencies from deps stage
COPY --from=deps /project /project

# Copy source code
COPY . .

# Build Windows binary
RUN cargo build --manifest-path src-tauri/Cargo.toml --release --target x86_64-pc-windows-gnu

# =============================================================================
# Stage 4: Build frontend
# =============================================================================
FROM base AS build-frontend

# Copy dependencies from deps stage
COPY --from=deps /project /project

# Copy source code
COPY . .

# Build frontend for VSCode
RUN npm run frontend:build:vscode

# =============================================================================
# Stage 5: Build extension TypeScript
# =============================================================================
FROM base AS build-extension-ts

# Copy dependencies from deps stage
COPY --from=deps /project /project

# Copy source code
COPY . .

# Compile extension TypeScript
RUN npm --prefix vscode-extension run compile

# =============================================================================
# Stage 6: Package Windows extension
# =============================================================================
FROM base AS package-win-x64

# Copy dependencies and build artifacts
COPY --from=deps /project /project
COPY --from=build-win-x64 /project/src-tauri/target/x86_64-pc-windows-gnu/release /tmp/backend
COPY --from=build-frontend /project /project
COPY --from=build-extension-ts /project /project

# Stage and package
WORKDIR /project
RUN mkdir -p vscode-extension/bin/win32-x64
RUN cp /tmp/backend/parallel-cli-runner.exe vscode-extension/bin/win32-x64/ 2>/dev/null || \
    cp /tmp/backend/parallel-cli-runner vscode-extension/bin/win32-x64/parallel-cli-runner.exe

RUN cd vscode-extension && ./node_modules/.bin/vsce package \
    --target win32-x64 \
    --out ../parallel-cli-runner-win32-x64.vsix

# =============================================================================
# Final stage: Export artifact
# =============================================================================
FROM base AS artifacts

# Copy packaged extension
COPY --from=package-win-x64 /project/parallel-cli-runner-win32-x64.vsix /artifacts/

WORKDIR /artifacts
RUN ls -lah
