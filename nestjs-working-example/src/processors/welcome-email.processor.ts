import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as nodemailer from 'nodemailer';

@Injectable()
@Processor('welcome-email-queue')
export class WelcomeEmailProcessor {
  private readonly logger = new Logger(WelcomeEmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  @Process()
  async handleWelcomeEmail(data: { email: string; userName: string; welcomeType?: string }) {
    this.logger.log(`👋 Processing welcome email task: ${JSON.stringify(data)}`);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const welcomeMessage = this.generateWelcomeMessage(data.userName, data.welcomeType);
      
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: data.email,
          subject: `Welcome to our platform, ${data.userName}!`,
          html: welcomeMessage,
        };

        const result = await this.transporter.sendMail(mailOptions);
        this.logger.log(`✅ Welcome email sent successfully: ${result.messageId}`);
      } else {
        this.logger.log(`👋 Simulated welcome email to ${data.email} for ${data.userName}`);
      }

      return { success: true, message: 'Welcome email sent successfully' };
    } catch (error) {
      this.logger.error(`❌ Failed to send welcome email: ${error.message}`);
      throw error;
    }
  }

  private generateWelcomeMessage(userName: string, welcomeType = 'standard'): string {
    const messages = {
      standard: `
        <h2>Welcome to CloudTaskMQ, ${userName}! 🎉</h2>
        <p>We're excited to have you on board. Get started by exploring our powerful task queue features.</p>
        <ul>
          <li>📧 Email processing</li>
          <li>🖼️ Image processing</li>
          <li>📊 Data exports</li>
          <li>🔄 Batch operations</li>
        </ul>
        <p>Happy queuing!</p>
      `,
      premium: `
        <h2>Welcome to CloudTaskMQ Premium, ${userName}! 🌟</h2>
        <p>Thank you for choosing our premium service. You now have access to:</p>
        <ul>
          <li>⚡ Priority task processing</li>
          <li>📈 Advanced analytics</li>
          <li>🔧 Custom integrations</li>
          <li>24/7 Premium support</li>
        </ul>
        <p>Let's build something amazing together!</p>
      `
    };

    return messages[welcomeType] || messages.standard;
  }
}
