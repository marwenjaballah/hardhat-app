FROM node:18-alpine

WORKDIR /usr/src/app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Ensure binaries are executable
RUN chmod -R 755 node_modules/.bin

# Copy the rest of the project
COPY . .

# Default command
CMD ["tail", "-f", "/dev/null"]
 