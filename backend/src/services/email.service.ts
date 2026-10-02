import nodemailer from 'nodemailer';

interface SendPasswordResetEmailParams {
  toEmail: string;
  resetLink: string;
  resetToken: string;
}

let testAccountTransporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Use configured SMTP (e.g. Gmail App Password or Resend)
  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  // Fallback to free Ethereal Email test account for development/demo
  if (!testAccountTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    testAccountTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return testAccountTransporter;
}

export async function sendPasswordResetEmail({ toEmail, resetLink, resetToken }: SendPasswordResetEmailParams) {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: '"EdgeDeploy Platform" <noreply@edgedeploy.local>',
      to: toEmail,
      subject: '🔒 Password Reset Request - EdgeDeploy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
            .card { max-width: 500px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .brand { display: flex; items-center; font-weight: bold; font-size: 20px; color: #38bdf8; margin-bottom: 20px; }
            .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; margin: 20px 0; }
            .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
            .code { font-family: monospace; background-color: #090d16; padding: 8px 12px; border-radius: 6px; color: #38bdf8; word-break: break-all; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">⚡ EdgeDeploy Cloud Platform</div>
            <h2 style="color: #ffffff; margin-top: 0;">Reset Your Password</h2>
            <p style="color: #cbd5e1; font-size: 14px;">We received a request to reset the password for your account (<strong>${toEmail}</strong>).</p>
            <p style="color: #cbd5e1; font-size: 14px;">Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
            
            <a href="${resetLink}" class="btn">Reset Password</a>

            <p style="color: #94a3b8; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <div class="code">${resetLink}</div>

            <div class="footer">
              If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Password reset email sent to ${toEmail} (Message ID: ${info.messageId})`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`🔗 Preview Sent Email Online (Free Ethereal Test Link): ${previewUrl}`);
      return previewUrl;
    }
    return null;
  } catch (err: any) {
    console.error('Failed to send password reset email:', err.message);
    return null;
  }
}
