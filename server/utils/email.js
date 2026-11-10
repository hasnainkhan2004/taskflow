const nodemailer = require('nodemailer');

const sendPasswordResetEmail = async (email, resetUrl) => {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !port || !process.env.EMAIL_FROM) {
    throw new Error('SMTP_HOST, SMTP_PORT, and EMAIL_FROM must be configured');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Reset your TaskFlow password',
    text: `Use this link within 15 minutes to reset your password: ${resetUrl}`,
  });
};

const sendInvitationEmail = async (email, inviteUrl, workspaceName) => {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`Workspace invitation for ${email}: ${inviteUrl}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !port || !process.env.EMAIL_FROM) {
    throw new Error('SMTP_HOST, SMTP_PORT, and EMAIL_FROM must be configured');
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Invitation to join ${workspaceName} on TaskFlow`,
    text: `You have been invited to join ${workspaceName}. Accept the invitation: ${inviteUrl}`,
  });
};

module.exports = { sendPasswordResetEmail, sendInvitationEmail };
