const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendResetCode(email, code) {
  const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; font-size: 24px; margin: 0;">حل المنهج</h1>
      </div>
      <div style="background: white; border-radius: 8px; padding: 32px; text-align: center;">
        <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px;">استعادة كلمة المرور</h2>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">استخدم الرمز التالي لإعادة تعيين كلمة المرور:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">صلاحية الرمز 15 دقيقة فقط</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"حل المنهج" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'رمز استعادة كلمة المرور - حل المنهج',
    html,
  });
}

module.exports = { sendResetCode };
