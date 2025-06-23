import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

export interface EmailTask {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    // Initialize transporter asynchronously
    this.initializeTransporter().catch(console.error);
  }

  private async initializeTransporter(): Promise<void> {
    if (config.email.smtp.host && config.email.smtp.user && config.email.smtp.pass) {
      // Use configured SMTP
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass,
        },
      });
    } else {
      // Use Ethereal test account
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  }

  async sendEmail(emailData: EmailTask): Promise<string> {
    try {
      // Ensure transporter is initialized
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const info = await this.transporter!.sendMail({
        from: config.email.from,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      });

      console.log('📧 Email sent:', info.messageId);
      
      // If using Ethereal, log preview URL
      if (!config.email.smtp.host) {
        console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return info.messageId;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<string> {
    const welcomeEmail: EmailTask = {
      to: email,
      subject: `Welcome to CloudTaskMQ, ${userName}!`,
      text: `Hello ${userName},\n\nWelcome to CloudTaskMQ! We're excited to have you on board.\n\nBest regards,\nThe CloudTaskMQ Team`,
      html: `
        <h1>Welcome to CloudTaskMQ!</h1>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Welcome to CloudTaskMQ! We're excited to have you on board.</p>
        <p>CloudTaskMQ is a powerful task queue management system that helps you:</p>
        <ul>
          <li>Process tasks asynchronously</li>
          <li>Scale your applications efficiently</li>
          <li>Handle complex workflows</li>
          <li>Monitor task execution</li>
        </ul>
        <p>Best regards,<br>The CloudTaskMQ Team</p>
      `,
    };

    return await this.sendEmail(welcomeEmail);
  }

  async sendNotificationEmail(email: string, subject: string, message: string): Promise<string> {
    const notificationEmail: EmailTask = {
      to: email,
      subject: `[CloudTaskMQ] ${subject}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">CloudTaskMQ Notification</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
            <h3 style="margin-top: 0;">${subject}</h3>
            <p>${message}</p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated message from CloudTaskMQ.
          </p>
        </div>
      `,
    };

    return await this.sendEmail(notificationEmail);
  }
}
