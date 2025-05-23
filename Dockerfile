FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Ensure binaries are executable
RUN chmod -R 755 node_modules/.bin

# Copy the rest of the project files
COPY . .

EXPOSE 8540

# Run the Hardhat Ignition deployment command

# CMD sh -c "yes | npx hardhat ignition deploy ./ignition/modules/Lock.ts --network localhost"

CMD [ "npm", "run", "watch:deploy" ]
