# CloudTaskMQ Node.js Example API

A comprehensive example showcasing all features of the CloudTaskMQ library through a RESTful API.

## 🚀 Features Demonstrated

### Core CloudTaskMQ Features
- ✅ **Multiple Storage Adapters** (Memory, Redis, MongoDB)
- ✅ **Task Queues** with different priorities and configurations
- ✅ **Rate Limiting** with configurable limits
- ✅ **Task Chains** for sequential processing
- ✅ **Batch Processing** for handling multiple items
- ✅ **Event System** with comprehensive event listeners
- ✅ **Error Handling** and retry mechanisms
- ✅ **Task Status Tracking** and monitoring

### Real-World Use Cases
- 📧 **Email Processing** (welcome emails, notifications)
- 🖼️ **Image Processing** (resize, watermark, format conversion)
- 📊 **Data Export** (CSV, JSON, XML formats)
- 📈 **Report Generation** with async processing
- 🔄 **Batch Operations** for bulk data processing
- 🔗 **Chained Tasks** for complex workflows

## 📁 Project Structure

```
nodejs-working-example/
├── src/
│   ├── config/
│   │   ├── index.ts              # Environment configuration
│   │   └── cloudtaskmq.ts        # CloudTaskMQ initialization
│   ├── services/
│   │   ├── email.service.ts      # Email processing service
│   │   └── image.service.ts      # Image processing service
│   ├── processors/
│   │   └── index.ts              # Task processors registration
│   ├── routes/
│   │   ├── tasks.ts              # Task management endpoints
│   │   ├── upload.ts             # File upload endpoints
│   │   └── dashboard.ts          # Dashboard and monitoring
│   └── server.ts                 # Main server file
├── package.json
├── tsconfig.json
├── docker-compose.yml            # Redis & MongoDB setup
├── Dockerfile
└── README.md
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Docker & Docker Compose (for Redis/MongoDB)

### 1. Install Dependencies
```bash
cd nodejs-working-example
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
# Key configurations:
# - STORAGE_ADAPTER=memory|redis|mongodb
# - EMAIL settings for notifications
# - Rate limiting settings
```

### 3. Start Storage Services (Optional)
```bash
# Start Redis and MongoDB with Docker
docker-compose up -d

# Or use memory adapter (no external dependencies)
# Set STORAGE_ADAPTER=memory in .env
```

### 4. Start the API
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 🎯 API Endpoints

### 📊 Dashboard & Monitoring
```bash
# Dashboard overview
GET http://localhost:3000/api/dashboard

# Recent tasks across all queues
GET http://localhost:3000/api/dashboard/recent-tasks

# System health check
GET http://localhost:3000/api/dashboard/health

# Clear completed tasks
DELETE http://localhost:3000/api/dashboard/queue/{queueName}/completed

# Retry failed tasks
POST http://localhost:3000/api/dashboard/queue/{queueName}/retry-failed
```

### 📧 Email Tasks
```bash
# Send email
curl -X POST http://localhost:3000/api/tasks/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Test Email",
    "text": "Hello from CloudTaskMQ!",
    "html": "<h1>Hello from CloudTaskMQ!</h1>"
  }'

# Send welcome email
curl -X POST http://localhost:3000/api/tasks/welcome-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "userName": "John Doe"
  }'
```

### 🖼️ Image Processing
```bash
# Upload and process image
curl -X POST http://localhost:3000/api/upload/image \
  -F "image=@/path/to/image.jpg" \
  -F "resize_width=800" \
  -F "resize_height=600" \
  -F "quality=85" \
  -F "format=jpeg" \
  -F "watermark_text=CloudTaskMQ" \
  -F "watermark_position=bottom-right"

# Generate thumbnails
curl -X POST http://localhost:3000/api/upload/thumbnails \
  -F "image=@/path/to/image.jpg"

# Batch process multiple images
curl -X POST http://localhost:3000/api/upload/batch \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "quality=80" \
  -F "generate_thumbnails=true"
```

### 📊 Data Processing
```bash
# Export data
curl -X POST http://localhost:3000/api/tasks/data-export \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "format": "csv"
  }'

# Generate report
curl -X POST http://localhost:3000/api/tasks/report \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "sales",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }'

# Batch processing
curl -X POST http://localhost:3000/api/tasks/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"id": 1}, {"id": 2}, {"id": 3}],
    "operation": "process"
  }'
```

### 🔗 Task Chains
```bash
# Create task chain
curl -X POST http://localhost:3000/api/tasks/chain \
  -H "Content-Type: application/json" \
  -d '{
    "steps": 5,
    "payload": {
      "userId": "user123",
      "operation": "sequential-process"
    }
  }'
```

### 📈 Task Monitoring
```bash
# Get task status
GET http://localhost:3000/api/tasks/{taskId}/status

# Get queue statistics
GET http://localhost:3000/api/tasks/queue/{queueName}/stats

# List processed files
GET http://localhost:3000/api/upload/processed

# Download processed file
GET http://localhost:3000/api/upload/processed/{filename}
```

## 🔧 Configuration Options

### Storage Adapters
```env
# Memory (no external dependencies)
STORAGE_ADAPTER=memory

# Redis (requires Redis server)
STORAGE_ADAPTER=redis
REDIS_URL=redis://localhost:6379

# MongoDB (requires MongoDB server)
STORAGE_ADAPTER=mongodb
MONGODB_URL=mongodb://localhost:27017/cloudtaskmq-example
```

### Rate Limiting
```env
ENABLE_RATE_LIMITING=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### Task Configuration
```env
MAX_RETRIES=3
TASK_TIMEOUT=30000
CONCURRENT_WORKERS=5
```

## 🎮 Usage Examples

### 1. Complete Email Workflow
```bash
# 1. Send welcome email
curl -X POST http://localhost:3000/api/tasks/welcome-email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "userName": "John"}'

# 2. Check task status
curl http://localhost:3000/api/tasks/{taskId}/status

# 3. Monitor queue
curl http://localhost:3000/api/dashboard
```

### 2. Image Processing Pipeline
```bash
# 1. Upload and process image
curl -X POST http://localhost:3000/api/upload/image \
  -F "image=@photo.jpg" \
  -F "resize_width=1200" \
  -F "quality=90"

# 2. Generate thumbnails
curl -X POST http://localhost:3000/api/upload/thumbnails \
  -F "image=@photo.jpg"

# 3. List processed files
curl http://localhost:3000/api/upload/processed
```

### 3. Complex Workflow with Chains
```bash
# Create a 5-step processing chain
curl -X POST http://localhost:3000/api/tasks/chain \
  -H "Content-Type: application/json" \
  -d '{
    "steps": 5,
    "payload": {"dataId": "batch123", "operation": "transform"}
  }'
```

## 🐳 Docker Deployment

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Manual Docker Build
```bash
# Build image
docker build -t cloudtaskmq-example .

# Run container
docker run -p 3000:3000 \
  -e STORAGE_ADAPTER=memory \
  cloudtaskmq-example
```

## 📊 Monitoring Dashboard

Visit `http://localhost:3000/api/dashboard` for real-time monitoring:

- **Queue Statistics**: Tasks pending, processing, completed, failed
- **Recent Tasks**: Latest task activities across all queues
- **System Health**: Storage adapter status, memory usage
- **Queue Management**: Clear completed tasks, retry failed tasks

## 🎯 Key Learning Points

### CloudTaskMQ Features Demonstrated:
1. **Multi-adapter Support**: Switch between Memory, Redis, and MongoDB
2. **Rate Limiting**: Protect your system from overload
3. **Task Chains**: Complex workflows with sequential processing
4. **Event System**: React to task lifecycle events
5. **Error Handling**: Automatic retries and failure management
6. **Monitoring**: Real-time dashboard and statistics
7. **Scalability**: Concurrent processing with configurable workers

### Real-World Patterns:
- Asynchronous email processing
- Background image processing
- Data export workflows
- Report generation
- Batch operations
- Complex multi-step workflows

## 🚀 Next Steps

1. **Customize Processors**: Add your own business logic
2. **Add Authentication**: Implement API authentication
3. **Scale with Docker**: Deploy with container orchestration
4. **Monitor in Production**: Add logging and metrics
5. **Extend Functionality**: Add more queue types and processors

## 📝 Notes

- All email operations use test accounts if no SMTP is configured
- Image processing creates resized versions and thumbnails
- Failed tasks can be retried through the dashboard
- All operations are fully asynchronous and non-blocking
- The API includes comprehensive error handling and validation

This example demonstrates production-ready patterns for using CloudTaskMQ in real applications! 🎉
