FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create directories for file processing
RUN mkdir -p uploads processed

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
