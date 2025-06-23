import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as nodemailer from 'nodemailer';

@Injectable()
@Processor('email-queue')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
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
  async handleEmailTask(data: { to: string; subject: string; text: string; html?: string }) {
    this.logger.log(`📧 Processing email task: ${JSON.stringify(data)}`);

    try {
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Send real email if SMTP is configured
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: data.to,
          subject: data.subject,
          text: data.text,
          html: data.html,
        };

        const result = await this.transporter.sendMail(mailOptions);
        this.logger.log(`✅ Email sent successfully: ${result.messageId}`);
      } else {
        // Simulate email sending in development
        this.logger.log(`📧 Simulated email to ${data.to}: ${data.subject}`);
      }

      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      this.logger.error(`❌ Failed to send email: ${error.message}`);
      throw error;
    }
  }
}
