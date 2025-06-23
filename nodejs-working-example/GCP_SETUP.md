# Google Cloud Platform (GCP) Cloud Tasks Setup Guide

This guide explains how to set up real GCP Cloud Tasks integration with CloudTaskMQ.

## Current Status

**✅ CloudTaskMQ Configuration Complete**
- Queue configurations with processor URLs ✅
- Dynamic project ID and location support ✅  
- Authentication configuration ready ✅
- Processor endpoints implemented ✅

**❌ Missing: GCP Authentication & Project Setup**

Currently, tasks are being saved locally because GCP credentials are not configured:
```
Failed to create Cloud Task, but task saved locally: Could not load the default credentials.
```

## 🔧 Setup Steps for Real GCP Integration

### 1. Create GCP Project & Enable APIs

```bash
# Create a new GCP project (optional)
gcloud projects create your-project-id --name="CloudTaskMQ Example"

# Set the project
gcloud config set project your-project-id

# Enable required APIs
gcloud services enable cloudtasks.googleapis.com
gcloud services enable compute.googleapis.com
```

### 2. Create Cloud Task Queues

```bash
# Set your region
export LOCATION=us-central1

# Create the queues that match our configuration
gcloud tasks queues create email-queue --location=$LOCATION
gcloud tasks queues create welcome-email-queue --location=$LOCATION  
gcloud tasks queues create image-processing-queue --location=$LOCATION
gcloud tasks queues create thumbnail-queue --location=$LOCATION
gcloud tasks queues create data-export-queue --location=$LOCATION
gcloud tasks queues create report-queue --location=$LOCATION
gcloud tasks queues create batch-queue --location=$LOCATION
gcloud tasks queues create chain-queue --location=$LOCATION

# Verify queues were created
gcloud tasks queues list --location=$LOCATION
```

### 3. Create Service Account & Download Key

```bash
# Create service account
gcloud iam service-accounts create cloudtaskmq-service \
    --display-name="CloudTaskMQ Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:cloudtaskmq-service@your-project-id.iam.gserviceaccount.com" \
    --role="roles/cloudtasks.enqueuer"

gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:cloudtaskmq-service@your-project-id.iam.gserviceaccount.com" \
    --role="roles/cloudtasks.taskRunner"

# Create and download key file
gcloud iam service-accounts keys create ./gcp-service-account-key.json \
    --iam-account=cloudtaskmq-service@your-project-id.iam.gserviceaccount.com
```

### 4. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Copy the example file
cp .env.example .env

# Edit the file with your GCP configuration
nano .env
```

Update these critical variables in `.env`:

```bash
# Your actual GCP project ID
GOOGLE_CLOUD_PROJECT=your-actual-project-id

# Path to your service account key file
GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account-key.json

# Your GCP region
GOOGLE_CLOUD_LOCATION=us-central1

# Public URL where GCP can reach your server (see step 5)
EXTERNAL_URL=https://your-domain.com
```

### 5. Expose Your Local Server (for Development)

For GCP Cloud Tasks to call your processor endpoints, your server must be publicly accessible.

**Option A: Using ngrok (Recommended for testing)**

```bash
# Install ngrok: https://ngrok.com/
npm install -g ngrok

# In a separate terminal, expose your local server
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io) and update .env:
# EXTERNAL_URL=https://abc123.ngrok.io
```

**Option B: Deploy to Cloud Run, App Engine, or other cloud service**

### 6. Update Processor URLs

The configuration will automatically use your EXTERNAL_URL:

```typescript
// This will be updated automatically based on EXTERNAL_URL
processorUrl: `${process.env.EXTERNAL_URL || 'http://localhost:3000'}/api/process/email`
```

### 7. Test Real GCP Integration

```bash
# Restart your server with the new configuration
npm run dev

# Create a task - it should now be sent to GCP Cloud Tasks!
curl -X POST http://localhost:3000/api/tasks/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Real GCP Test",
    "text": "This task was sent to GCP Cloud Tasks!"
  }'
```

**Success indicators:**
- No more "Failed to create Cloud Task" errors
- Tasks show up in GCP Cloud Tasks console
- GCP automatically calls your processor endpoints
- Tasks get processed and completed

### 8. Monitor in GCP Console

Visit the [Cloud Tasks Console](https://console.cloud.google.com/cloudtasks) to see:
- ✅ Tasks being created in real-time
- ✅ Queue statistics and metrics  
- ✅ Task execution logs
- ✅ Failed tasks and retry attempts

## 🎯 Architecture Flow

When properly configured:

1. **Task Creation**: `POST /api/tasks/email` → CloudTaskMQ → **GCP Cloud Tasks**
2. **Task Storage**: Task stored in GCP Cloud Tasks queue
3. **Task Execution**: GCP Cloud Tasks → `POST /api/process/email` (your server)
4. **Task Completion**: Your processor responds → GCP marks task complete

## 📊 Verification Checklist

- [ ] GCP project created and APIs enabled
- [ ] Cloud Task queues created in GCP
- [ ] Service account with proper permissions
- [ ] Environment variables configured
- [ ] Server publicly accessible (ngrok or deployed)
- [ ] No authentication errors in logs
- [ ] Tasks visible in GCP Cloud Tasks console
- [ ] Processor endpoints being called by GCP

## 🚨 Common Issues

**1. "Could not load the default credentials"**
- Missing or incorrect `GOOGLE_APPLICATION_CREDENTIALS` path
- Service account key file not found

**2. "Permission denied"**
- Service account lacks `cloudtasks.enqueuer` role
- Wrong project ID in configuration

**3. "Failed to create queue"**
- Queues don't exist in GCP project
- Wrong location/region specified

**4. "Processor URL not reachable"**
- Server not publicly accessible
- Wrong EXTERNAL_URL configuration
- Firewall blocking GCP requests

## 🎉 Success!

Once configured correctly, you'll see:
```
✅ Task sent to GCP Cloud Tasks successfully
📧 Processing email task from GCP Cloud Tasks: {...}
✅ Email task completed successfully
```

Your CloudTaskMQ example is now fully integrated with Google Cloud Platform! 🚀
