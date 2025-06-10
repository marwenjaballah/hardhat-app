#!/bin/bash

# Configuration
DOCKER_USER="viconee"  # Replace with your Docker Hub username
IMAGE_NAME="hardhat-app"
TAG="latest"

# Build the image
echo "Building Docker image..."
docker build -t ${DOCKER_USER}/${IMAGE_NAME}:${TAG} .

# Push the image
echo "Pushing Docker image to Docker Hub..."
docker push ${DOCKER_USER}/${IMAGE_NAME}:${TAG}

echo "Done! You can now use this image in your docker-compose.yml with:"
echo "image: ${DOCKER_USER}/${IMAGE_NAME}:${TAG}" 