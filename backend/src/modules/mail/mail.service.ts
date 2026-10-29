import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromAddress: string = 'AOA 77 Security <no-reply@aoa77.com>';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const smtpPort = Number(this.configService.get<number | string>('SMTP_PORT', 465));
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpSecure =
      this.configService.get<string | boolean>('SMTP_SECURE') !== undefined
        ? String(this.configService.get('SMTP_SECURE')).toLowerCase() === 'true'
        : smtpPort === 465;

    this.fromAddress = this.configService.get<string>(
      'SMTP_FROM',
      'AOA 77 Security <no-reply@aoa77.com>',
    );

    if (smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        this.logger.log(`SMTP transporter initialized with ${smtpHost}:${smtpPort} (User: ${smtpUser})`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize SMTP transporter: ${err.message}`);
        this.transporter = null;
      }
    } else {
      this.logger.warn(
        'SMTP credentials not configured (SMTP_USER / SMTP_PASS missing). Operating in terminal fallback simulation mode.',
      );
      this.transporter = null;
    }
  }

  /**
   * Terminal fallback logger for development, local testing, and offline modes.
   */
  private logSimulatedEmail(to: string, resetUrl: string, userName?: string) {
    this.logger.log(
      `\n======================================================\n` +
      `[PASSWORD RESET EMAIL DISPATCH (TERMINAL FALLBACK)]\n` +
      `To: ${to}${userName ? ` (${userName})` : ''}\n` +
      `From: ${this.fromAddress}\n` +
      `Reset URL: ${resetUrl}\n` +
      `Expires In: 20 minutes\n` +
      `======================================================\n`,
    );
  }

  /**
   * Dispatches an executive HTML password reset email to the recipient.
   * If SMTP is unconfigured or encounters a delivery error, falls back gracefully to terminal output.
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    userName?: string,
  ): Promise<{ delivered: boolean; simulated: boolean; messageId?: string; error?: string; resetUrl?: string }> {
    const displayName = userName?.trim() || 'Corporate User';

    const plainText =
      `Hello ${displayName},\n\n` +
      `A password reset request was received for your corporate account associated with ${to}.\n\n` +
      `To reset your password, please open the link below in your browser:\n` +
      `${resetUrl}\n\n` +
      `SECURITY NOTICE:\n` +
      `This link is strictly valid for 20 minutes. If you did not initiate this request, you may safely ignore this message; your account password remains unchanged.\n\n` +
      `---\n` +
      `AOA 77 COMPANY LTD\n` +
      `Security & Access Control Team`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your AOA 77 Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0E14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0B0E14; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); border: 1px solid #1E232F;">
          <!-- Obsidian Brand Header -->
          <tr>
            <td style="background-color: #16181F; padding: 32px 36px; text-align: left; border-bottom: 2px solid #5847F6;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(88, 71, 246, 0.15); border: 1px solid #5847F6; color: #8F84FF; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                      ⚡ AOA 77 &bull; SECURITY & ACCESS CONTROL
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">
                      Password Reset Request
                    </h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                      Enterprise Business Document System
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
                Hello ${displayName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #475569;">
                A request was received to reset the authentication credentials for your corporate account associated with <strong style="color: #0f172a;">${to}</strong>.
              </p>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 22px; color: #475569;">
                Click the button below to establish a new password. This link is valid for <strong style="color: #0f172a;">20 minutes</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #5847F6; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 34px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(88, 71, 246, 0.4); text-align: center; mso-padding-alt: 0;">
                      <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%;" hidden>&nbsp;</i><![endif]-->
                      <span style="mso-text-raise: 10pt;">Reset My Password &rarr;</span>
                      <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%;" hidden>&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                      Alternative Direct Link:
                    </p>
                    <p style="margin: 0; font-size: 12px; line-height: 18px; word-break: break-all;">
                      <a href="${resetUrl}" style="color: #5847F6; text-decoration: underline;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Advisory Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left: 3px solid #f59e0b; background-color: #fffbeb; border-radius: 0 8px 8px 0; margin-bottom: 8px;">
                <tr>
                  <td style="padding: 12px 14px;">
                    <p style="margin: 0; font-size: 12px; line-height: 18px; color: #92400e;">
                      <strong>Security Notice:</strong> If you did not request a password reset, you can safely disregard this email. Your password will not change and your account remains secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FC; padding: 24px 36px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #0f172a;">
                AOA 77 COMPANY LTD
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 16px;">
                1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria<br>
                Automated System Message &bull; Please do not reply directly to this email
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.fromAddress,
          to,
          subject: 'AOA 77 — Password Reset Request',
          text: plainText,
          html: htmlContent,
        });

        this.logger.log(`Password reset email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
        return {
          delivered: true,
          simulated: false,
          messageId: info.messageId,
        };
      } catch (err: any) {
        this.logger.error(
          `SMTP dispatch failed for ${to}: ${err.message}. Gracefully falling back to terminal output.`,
        );
        this.logSimulatedEmail(to, resetUrl, userName);
        return {
          delivered: false,
          simulated: true,
          error: err.message,
          resetUrl,
        };
      }
    } else {
      this.logSimulatedEmail(to, resetUrl, userName);
      return {
        delivered: false,
        simulated: true,
        resetUrl,
      };
    }
  }
}
