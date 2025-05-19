import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'lyvinhthai321@gmail.com',
        pass: process.env.SMTP_PASS || 'ucvh ynac eygi etux',
      },
    });
  }

  private getCommonStyles(): string {
    return `
      <style>
        body { font-family: 'Arial', sans-serif; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; line-height: 1.6; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        .button:hover { background: #0056b3; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        h1 { margin: 0; font-size: 24px; }
        p { margin: 10px 0; }
      </style>
    `;
  }

  async sendRegisterEmail(data: any): Promise<void> {
    const options: { email: string, username: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: 'Welcome to Your App! 🎉',
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Welcome, ${options.username}!</h1>
          </div>
          <div class="content">
            <p>Thank you for joining Your App! We're thrilled to have you on board.</p>
            <p>Ready to explore? Dive into our amazing features and start your journey today!</p>
            <a href="https://yourapp.com/dashboard" class="button">Get Started Now</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendResetPasswordEmail(data: any): Promise<void> {
    const options: { email: string, username: string, resetLink: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: 'Reset Your Password 🔒',
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <a href="${options.resetLink}" class="button">Reset Password</a>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendForgetPasswordEmail(data: any): Promise<void> {
    const options: { email: string, resetLink: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: 'Forgot Your Password? 🔑',
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Forgot Password</h1>
          </div>
          <div class="content">
            <p>No worries! Click the button below to set a new password:</p>
            <a href="${options.resetLink}" class="button">Set New Password</a>
            <p>This link will expire in 1 hour for your security.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendThanksEmail(data: any): Promise<void> {
    const options: { email: string,username: string, resetLink: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: 'Thank You for Your Support! 🙌',
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Thank You, ${options.username}!</h1>
          </div>
          <div class="content">
            <p>We truly appreciate your support and trust in Your App.</p>
            <p>Stay tuned for exciting updates and new features!</p>
            <a href="https://yourapp.com/updates" class="button">Check What's New</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendEventsEmail(data: any): Promise<void> {
    const options: { email: string; eventName: string; eventDate: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: `Join Our Event: ${options.eventName} 🎈`,
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>You're Invited to ${options.eventName}!</h1>
          </div>
          <div class="content">
            <p><strong>Date:</strong> ${options.eventDate}</p>
            <p>Join us for an exciting event filled with fun and surprises!</p>
            <a href="https://yourapp.com/events" class="button">RSVP Now</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendNotificationEmail(data: any): Promise<void> {
    const options: { email: string; message: string } = data
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: 'New Notification 🔔',
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Notification</h1>
          </div>
          <div class="content">
            <p>${options.message}</p>
            <a href="https://yourapp.com/notifications" class="button">View Details</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  async sendOrderEmail(data: any): Promise<void> {
    const options: { email: string, orderId: string, orderDetails: object} = data
    console.log(options)
    return await this.transporter.sendMail({
      from: '"Your App" <no-reply@yourapp.com>',
      to: options.email,
      subject: `Order Confirmation: ${options.orderId} 🛒`,
      html: `
        ${this.getCommonStyles()}
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
          </div>
          <div class="content">
            <p><strong>Order ID:</strong> ${options.orderId}</p>
            <p><strong>Details:</strong></p>
            <pre style="background: #f8f8f8; padding: 10px; border-radius: 4px;">${JSON.stringify(options.orderDetails, null, 2)}</pre>
            <p>Thank you for your purchase! We'll notify you when your order ships.</p>
            <a href="https://yourapp.com/orders/${options.orderId}" class="button">Track Order</a>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Your App. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }
}