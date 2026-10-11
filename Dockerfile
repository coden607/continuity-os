# Continuity OS Universal App Docker Container
FROM node:24-slim

WORKDIR /app

# Install Python 3, pip, and sqlite3
RUN apt-get update && \
    apt-get install -y python3 python3-pip sqlite3 --no-install-recommends && \
    pip install --no-cache-dir --break-system-packages pydantic && \
    rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json tsconfig.json ./

# Install dev dependencies for typechecking and run verification
RUN npm install

# Copy application files
COPY . .

# Run test suite at build time to ensure container integrity
RUN npm test && npm run typecheck

# Expose HTTP port
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Persistent storage volume for SQLite
VOLUME ["/app/data"]

CMD ["npm", "start"]
