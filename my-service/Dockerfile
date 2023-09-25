# Source: https://alexbrand.dev/post/how-to-package-rust-applications-into-minimal-docker-containers/

# Dockerfile for creating a statically-linked Rust application using docker's
# multi-stage build feature. This also leverages the docker build cache to avoid
# re-downloading dependencies if they have not changed.
FROM rust:1.72.0 AS builder
WORKDIR /usr/src/

ARG TARGETPLATFORM

# Download the target for static linking.
RUN if [ "$TARGETPLATFORM" = "linux/amd64" ]; then ARCHITECTURE=x86_64; elif [ "$TARGETPLATFORM" = "linux/arm64" ]; then ARCHITECTURE=aarch64; else ARCHITECTURE=unknown-error; fi \
    && rustup target add "$ARCHITECTURE-unknown-linux-musl"

# Create a dummy project and build the app's dependencies.
# If the Cargo.toml or Cargo.lock files have not changed,
# we can use the docker build cache and skip these (typically slow) steps.
RUN USER=root cargo new my-service
WORKDIR /usr/src/my-service
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release

# Copy the source and build the application.
COPY src ./src
RUN if [ "$TARGETPLATFORM" = "linux/amd64" ]; then ARCHITECTURE=x86_64; elif [ "$TARGETPLATFORM" = "linux/arm64" ]; then ARCHITECTURE=aarch64; else ARCHITECTURE=unknown-error; fi \
    && cargo install --target "$ARCHITECTURE-unknown-linux-musl" --path .

# Copy the statically-linked binary into a scratch container.
FROM scratch
COPY --from=builder /usr/local/cargo/bin/my-service .
USER 1000
CMD ["./my-service"]
