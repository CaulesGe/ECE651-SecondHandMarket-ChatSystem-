import nodemailer from "nodemailer";

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Email is not configured: missing SMTP_HOST/SMTP_USER/SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 -> STARTTLS, secure false
    auth: { user, pass }
  });
}

export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM || "Secondhand Hub <no-reply@secondhand.com>";

  const subject = "Verify your email for Secondhand Hub";

  const text =
`Hi ${name || "there"},
Please verify your email by clicking this link:
${verifyUrl}

If you didn't create this account, you can ignore this email.`;

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Verify your email</h2>
    <p>Hi ${name || "there"},</p>
    <p>Please verify your email by clicking the button below:</p>
    <p>
      <a href="${verifyUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
        Verify Email
      </a>
    </p>
    <p style="color:#666;font-size:12px;">
      If you didn't create this account, you can ignore this email.
    </p>
  </div>`;

  await transporter.sendMail({ from, to, subject, text, html });
}
