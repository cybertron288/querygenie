/**
 * Email utilities
 * 
 * Handles email sending with multiple providers
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  data?: Record<string, any>;
  from?: string;
  replyTo?: string;
}

interface EmailProvider {
  send(options: EmailOptions): Promise<void>;
}

/**
 * Console email provider for development
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<void> {
    console.log("📧 Email would be sent:");
    console.log("To:", Array.isArray(options.to) ? options.to.join(", ") : options.to);
    console.log("Subject:", options.subject);
    console.log("Template:", options.template);
    console.log("Data:", JSON.stringify(options.data, null, 2));
    console.log("---");
  }
}

/**
 * Resend email provider
 * Using Resend.com for production emails
 */
class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || "";
    this.fromEmail = process.env.EMAIL_FROM || "noreply@querygenie.ai";
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.apiKey) {
      console.warn("Resend API key not configured, falling back to console");
      return new ConsoleEmailProvider().send(options);
    }

    const html = this.renderTemplate(options.template, options.data || {});
    
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from || this.fromEmail,
          to: options.to,
          subject: options.subject,
          html,
          reply_to: options.replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send email: ${error}`);
      }
    } catch (error) {
      console.error("Email sending failed:", error);
      throw error;
    }
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    // Get the template HTML
    const templateHtml = emailTemplates[template];
    
    if (!templateHtml) {
      throw new Error(`Email template "${template}" not found`);
    }

    // Replace variables in template
    return templateHtml.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }
}

/**
 * Email templates
 */
const emailTemplates: Record<string, string> = {
  "workspace-invitation": `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Workspace Invitation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e1e1e1; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Invited to QueryGenie!</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p><strong>{{inviterName}}</strong> has invited you to join the <strong>{{workspaceName}}</strong> workspace as a <strong>{{role}}</strong>.</p>
          {{#if message}}
          <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
            {{message}}
          </blockquote>
          {{/if}}
          <p>Click the button below to accept the invitation:</p>
          <a href="{{invitationLink}}" class="button">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">{{invitationLink}}</p>
          <div class="footer">
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  
  "password-reset": `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e1e1e1; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi {{name}},</p>
          <p>We received a request to reset your password for your QueryGenie account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="{{resetLink}}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">{{resetLink}}</p>
          <div class="footer">
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  
  "welcome": `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to QueryGenie</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border: 1px solid #e1e1e1; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .feature { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to QueryGenie! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi {{name}},</p>
          <p>Welcome to QueryGenie! We're excited to have you on board.</p>
          <p>QueryGenie is your AI-powered database assistant that helps you:</p>
          <div class="feature">
            <strong>🤖 Generate SQL Queries</strong><br>
            Use natural language to create complex SQL queries instantly
          </div>
          <div class="feature">
            <strong>📊 Analyze Your Data</strong><br>
            Get insights and visualizations from your database
          </div>
          <div class="feature">
            <strong>📝 Document Your Schema</strong><br>
            Automatically generate comprehensive documentation
          </div>
          <div class="feature">
            <strong>👥 Collaborate with Your Team</strong><br>
            Share queries, insights, and documentation with team members
          </div>
          <p>Ready to get started?</p>
          <a href="{{dashboardLink}}" class="button">Go to Dashboard</a>
          <div class="footer">
            <p>Need help? Check out our <a href="{{docsLink}}">documentation</a> or reply to this email.</p>
            <p>Happy querying!</p>
            <p>The QueryGenie Team</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
};

/**
 * Get email provider based on environment
 */
function getEmailProvider(): EmailProvider {
  if (process.env.NODE_ENV === "production" && process.env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new ConsoleEmailProvider();
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const provider = getEmailProvider();
  
  try {
    await provider.send(options);
    console.log(`Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    // In production, you might want to queue failed emails for retry
    throw error;
  }
}

/**
 * Send bulk emails
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  template: string,
  data?: Record<string, any>
): Promise<void> {
  // Send emails in batches to avoid rate limits
  const batchSize = 10;
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map((to) =>
        sendEmail({
          to,
          subject,
          template,
          data,
        }).catch((error) => {
          console.error(`Failed to send email to ${to}:`, error);
        })
      )
    );
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}