import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';

@Injectable()
@Processor('notification-queue')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process()
  async handleNotification(data: { 
    type: 'push' | 'sms' | 'webhook' | 'slack';
    recipient: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    this.logger.log(`🔔 Processing notification: ${JSON.stringify(data)}`);

    try {
      const { type, recipient, title, message, metadata } = data;
      
      switch (type) {
        case 'push':
          return await this.sendPushNotification(recipient, title, message, metadata);
        case 'sms':
          return await this.sendSMSNotification(recipient, message, metadata);
        case 'webhook':
          return await this.sendWebhookNotification(recipient, title, message, metadata);
        case 'slack':
          return await this.sendSlackNotification(recipient, title, message, metadata);
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  private async sendPushNotification(deviceToken: string, title: string, message: string, metadata?: any) {
    // Simulate push notification sending
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.logger.log(`📱 Push notification sent to device: ${deviceToken.substring(0, 8)}...`);
    
    return {
      success: true,
      type: 'push',
      recipient: deviceToken,
      title,
      message,
      deliveredAt: new Date().toISOString(),
      metadata,
    };
  }

  private async sendSMSNotification(phoneNumber: string, message: string, metadata?: any) {
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 800));
    
    this.logger.log(`📱 SMS sent to: ${phoneNumber}`);
    
    return {
      success: true,
      type: 'sms',
      recipient: phoneNumber,
      message,
      deliveredAt: new Date().toISOString(),
      metadata,
    };
  }

  private async sendWebhookNotification(webhookUrl: string, title: string, message: string, metadata?: any) {
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const payload = {
      title,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    
    this.logger.log(`🔗 Webhook notification sent to: ${webhookUrl}`);
    this.logger.log(`📄 Payload: ${JSON.stringify(payload)}`);
    
    // In a real implementation, you would make an HTTP request here
    // const response = await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });
    
    return {
      success: true,
      type: 'webhook',
      recipient: webhookUrl,
      payload,
      statusCode: 200, // Simulated success
      deliveredAt: new Date().toISOString(),
    };
  }

  private async sendSlackNotification(channelOrWebhook: string, title: string, message: string, metadata?: any) {
    // Simulate Slack notification
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const slackPayload = {
      text: title,
      attachments: [
        {
          color: 'good',
          text: message,
          ts: Math.floor(Date.now() / 1000),
          footer: 'CloudTaskMQ Notification',
          ...(metadata && { fields: Object.entries(metadata).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true,
          })) }),
        }
      ]
    };
    
    this.logger.log(`💬 Slack notification sent to: ${channelOrWebhook}`);
    this.logger.log(`📄 Slack payload: ${JSON.stringify(slackPayload)}`);
    
    return {
      success: true,
      type: 'slack',
      recipient: channelOrWebhook,
      payload: slackPayload,
      deliveredAt: new Date().toISOString(),
    };
  }
}
