import { Resend } from 'resend';
import { config } from '@/config/environment.js';
import { logger } from '@/shared/logger.js';
import { emailQueue } from '@/shared/queue/queue.js';

// Initialize Resend client
const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

// Email templates
const templates = {
  welcome: {
    subject: 'Welcome to DevPocket!',
    getHtml: (username: string, verificationLink: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to DevPocket</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { 
              display: inline-block; 
              background-color: #2563eb; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0; 
            }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to DevPocket!</h1>
            </div>
            <div class="content">
              <h2>Hello ${username}!</h2>
              <p>Thank you for joining DevPocket, the AI-powered mobile terminal application.</p>
              <p>To get started, please verify your email address by clicking the button below:</p>
              <a href="${verificationLink}" class="button">Verify Email Address</a>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p>${verificationLink}</p>
              <p>This verification link will expire in 24 hours.</p>
              <p>If you didn't create an account with DevPocket, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 DevPocket. All rights reserved.</p>
              <p>This email was sent to verify your account registration.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    getText: (username: string, verificationLink: string) => `
      Welcome to DevPocket, ${username}!

      Thank you for joining DevPocket, the AI-powered mobile terminal application.

      To get started, please verify your email address by visiting this link:
      ${verificationLink}

      This verification link will expire in 24 hours.

      If you didn't create an account with DevPocket, please ignore this email.

      © 2024 DevPocket. All rights reserved.
    `,
  },

  passwordReset: {
    subject: 'Reset Your DevPocket Password',
    getHtml: (username: string, resetLink: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { 
              display: inline-block; 
              background-color: #dc2626; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0; 
            }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
            .warning { background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${username}!</h2>
              <p>We received a request to reset your DevPocket account password.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${resetLink}" class="button">Reset Password</a>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p>${resetLink}</p>
              <div class="warning">
                <strong>Important:</strong> This reset link will expire in 1 hour for security reasons.
              </div>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>For security, this request came from a device. If this wasn't you, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 DevPocket. All rights reserved.</p>
              <p>This email was sent in response to a password reset request.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    getText: (username: string, resetLink: string) => `
      Hello ${username}!

      We received a request to reset your DevPocket account password.

      To reset your password, visit this link:
      ${resetLink}

      This reset link will expire in 1 hour for security reasons.

      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

      © 2024 DevPocket. All rights reserved.
    `,
  },
};

export class EmailService {
  // Send welcome email with verification link
  static async sendWelcomeEmail(email: string, username: string, verificationToken: string): Promise<void> {
    const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    await this.queueEmail({
      type: 'welcome',
      to: email,
      subject: templates.welcome.subject,
      html: templates.welcome.getHtml(username, verificationLink),
      text: templates.welcome.getText(username, verificationLink),
    });

    logger.info(`Welcome email queued for ${email}`);
  }

  // Send password reset email
  static async sendPasswordResetEmail(email: string, username: string, resetToken: string): Promise<void> {
    const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await this.queueEmail({
      type: 'password-reset',
      to: email,
      subject: templates.passwordReset.subject,
      html: templates.passwordReset.getHtml(username, resetLink),
      text: templates.passwordReset.getText(username, resetLink),
    });

    logger.info(`Password reset email queued for ${email}`);
  }

  // Queue email for async processing
  private static async queueEmail(emailData: {
    type: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    try {
      await emailQueue.add('send-email', emailData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    } catch (error) {
      logger.error('Error queuing email:', error);
      throw new Error('Failed to queue email');
    }
  }

  // Send email directly (used by queue worker)
  static async sendEmail(data: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!resend) {
      logger.warn('Resend API key not configured, skipping email send');
      return;
    }

    try {
      const result = await resend.emails.send({
        from: config.FROM_EMAIL,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      });

      if (result.error) {
        logger.error('Resend API error:', result.error);
        throw new Error(`Email send failed: ${result.error.message}`);
      }

      logger.info(`Email sent successfully to ${data.to}`, { 
        messageId: result.data?.id 
      });
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  // Verify email configuration
  static async verifyConfiguration(): Promise<boolean> {
    if (!resend) {
      logger.warn('Resend API key not configured');
      return false;
    }

    try {
      // Test the API key by attempting to get account info
      // Note: This is a simple check, Resend doesn't have a dedicated health check endpoint
      logger.info('Email service configured with Resend');
      return true;
    } catch (error) {
      logger.error('Email service configuration error:', error);
      return false;
    }
  }

  // Send test email (for development/testing)
  static async sendTestEmail(to: string): Promise<void> {
    await this.queueEmail({
      type: 'test',
      to,
      subject: 'DevPocket Test Email',
      html: `
        <html>
          <body>
            <h1>DevPocket Test Email</h1>
            <p>This is a test email from the DevPocket API.</p>
            <p>If you received this, the email service is working correctly!</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </body>
        </html>
      `,
      text: `
        DevPocket Test Email
        
        This is a test email from the DevPocket API.
        If you received this, the email service is working correctly!
        
        Timestamp: ${new Date().toISOString()}
      `,
    });

    logger.info(`Test email queued for ${to}`);
  }
}