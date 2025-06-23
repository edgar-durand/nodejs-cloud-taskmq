# Integration Tests for CloudTaskMQ

This document explains how to run the integration tests for MongoDB and Redis storage adapters using Docker containers.

## Prerequisites

- Docker and Docker Compose installed
- Node.js and npm installed
- All project dependencies installed (`npm install`)

## Available Test Suites

### 1. Unit Tests (Memory Storage)
- **File**: `src/__tests__/integration.test.ts`
- **Storage**: Memory storage adapter
- **Command**: `npm run test:unit`

### 2. MongoDB Integration Tests
- **File**: `src/__tests__/integration-mongodb.test.ts`
- **Storage**: MongoDB with Docker container
- **Command**: `npm run test:integration:mongo`

### 3. Redis Integration Tests
- **File**: `src/__tests__/integration-redis.test.ts`
- **Storage**: Redis with Docker container
- **Command**: `npm run test:integration:redis`

## Quick Start

### Run All Integration Tests
```bash
# Start Docker containers
npm run docker:test:up

# Run all integration tests
npm run test:integration

# Stop and cleanup containers
npm run docker:test:down
```

### Run MongoDB Tests Only
```bash
# Start containers
npm run docker:test:up

# Run MongoDB integration tests
npm run test:integration:mongo

# Cleanup
npm run docker:test:down
```

### Run Redis Tests Only
```bash
# Start containers
npm run docker:test:up

# Run Redis integration tests
npm run test:integration:redis

# Cleanup
npm run docker:test:down
```

## Docker Services

### MongoDB Container
- **Image**: `mongo:7.0`
- **Port**: `27017`
- **Database**: `cloudtaskmq_test`
- **Connection**: `mongodb://localhost:27017/cloudtaskmq_test`

### Redis Container
- **Image**: `redis:7.2-alpine`
- **Port**: `6379`
- **Connection**: `redis://localhost:6379`

## Test Coverage

Both MongoDB and Redis integration tests cover:

### ✅ Basic Task Processing
- Task creation and processing
- Task failure handling
- Task status management

### ✅ Advanced Features
- **Task Chains**: Multiple related tasks with shared chain ID
- **Uniqueness Keys**: Preventing duplicate tasks
- **Rate Limiting**: Respecting queue rate limits
- **Event System**: Task completion and failure events

### ✅ Performance & Concurrency
- High-throughput task processing
- Concurrent task handling
- Connection resilience

### ✅ Storage-Specific Features
- MongoDB: Document persistence and complex queries
- Redis: Key-value storage and data persistence

## Troubleshooting

### Docker Issues
```bash
# Check if Docker is running
docker info

# Check container status
docker ps

# View container logs
docker logs cloudtaskmq-test-mongo
docker logs cloudtaskmq-test-redis

# Force restart containers
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### Test Issues
```bash
# Run tests with verbose output
npm run test:integration -- --verbose

# Run specific test file
npx jest src/__tests__/integration-mongodb.test.ts --verbose

# Run tests with coverage
npm run test:integration -- --coverage
```

### Container Health Checks
The tests automatically wait for containers to be healthy before running:
- **MongoDB**: Uses `mongosh --eval "db.adminCommand('ping')"`
- **Redis**: Uses `redis-cli ping`

### Common Issues

1. **Port Conflicts**: If ports 27017 or 6379 are in use:
   - Stop conflicting services
   - Or modify ports in `docker-compose.test.yml`

2. **Container Startup Timeout**: If containers take too long:
   - Check Docker resources
   - Increase timeout in test setup

3. **Permission Issues**: On some systems:
   ```bash
   sudo docker-compose -f docker-compose.test.yml up -d
   ```

## Test Structure

Each integration test file follows this pattern:

```typescript
describe('Storage Integration Tests', () => {
  beforeAll(async () => {
    // Start Docker container
    // Wait for health check
  });

  afterAll(async () => {
    // Stop container
  });

  beforeEach(async () => {
    // Initialize CloudTaskMQ with storage adapter
    // Clear existing data
  });

  afterEach(async () => {
    // Cleanup tasks
    // Shutdown CloudTaskMQ
  });

  // Test suites for different features...
});
```

## Performance Expectations

### MongoDB Tests
- **Startup**: ~10-15 seconds
- **Execution**: ~5-10 seconds
- **Total**: ~15-25 seconds

### Redis Tests
- **Startup**: ~5-10 seconds
- **Execution**: ~3-8 seconds
- **Total**: ~8-18 seconds

## CI/CD Integration

For continuous integration, add these steps:

```yaml
# Example GitHub Actions
- name: Start test containers
  run: npm run docker:test:up

- name: Wait for containers
  run: sleep 15

- name: Run integration tests
  run: npm run test:integration

- name: Cleanup containers
  run: npm run docker:test:down
  if: always()
```

## Development Tips

1. **Keep containers running** during development:
   ```bash
   npm run docker:test:up
   # Run tests multiple times
   npm run test:integration:mongo
   # When done
   npm run docker:test:down
   ```

2. **Debug container issues**:
   ```bash
   docker exec -it cloudtaskmq-test-mongo mongosh
   docker exec -it cloudtaskmq-test-redis redis-cli
   ```

3. **Monitor test data**:
   - MongoDB: Use MongoDB Compass on `localhost:27017`
   - Redis: Use RedisInsight on `localhost:6379`
