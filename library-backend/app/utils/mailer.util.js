const nodemailer = require('nodemailer');
const config = require('../config');

/**
 * Kiểm tra xem cấu hình SMTP thực tế có hợp lệ hay không (không phải placeholder rỗng/mẫu)
 */
const isSmtpConfigured = () => {
  const { user, pass } = config.smtp;
  if (!user || !pass) {
    return false;
  }
  if (user.includes('your_email') || pass.includes('your_email')) {
    return false;
  }
  return true;
};

/**
 * Tạo transport gửi email nếu có cấu hình SMTP
 */
const createTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
};

/**
 * Gửi email chung hoặc log ra console nếu ở môi trường dev / chưa có SMTP
 * @param {object} mailOptions
 * @param {string} mailOptions.to Địa chỉ nhận
 * @param {string} mailOptions.subject Tiêu đề
 * @param {string} [mailOptions.text] Nội dung văn bản thuần
 * @param {string} [mailOptions.html] Nội dung HTML
 */
const sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();

  // Nếu không có thông tin SMTP, giả lập gửi email và in link ra console (đặc biệt khi dev)
  if (!transporter) {
    console.log('\n================== [DEV MAILER SIMULATION] ==================');
    console.log(`Đến: ${to}`);
    console.log(`Tiêu đề: ${subject}`);
    console.log(`Nội dung văn bản:\n${text || '(không có text)'}`);
    if (html) {
      console.log(`Nội dung HTML:\n${html}`);
    }
    console.log('============================================================\n');

    return {
      messageId: `simulated-${Date.now()}`,
      simulated: true,
    };
  }

  return await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
};

/**
 * Gửi email đặt lại mật khẩu kèm liên kết chứa token
 * @param {string} email
 * @param {string} resetToken Token thô chưa băm
 * @param {string} [firstName]
 */
const sendPasswordResetEmail = async (email, resetToken, firstName = 'Bạn') => {
  const clientBaseUrl = config.clientUrls[0] || 'http://localhost:5173';
  const resetLink = `${clientBaseUrl}/reset-password/${resetToken}`;

  const subject = '[Thư viện] Yêu cầu đặt lại mật khẩu';
  const text = `Xin chào ${firstName},\n\nBạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản thư viện của bạn.\n\nVui lòng truy cập liên kết sau để đặt mật khẩu mới:\n${resetLink}\n\nLiên kết này có hiệu lực trong vòng 30 phút và chỉ sử dụng được một lần.\nNếu bạn không yêu cầu điều này, xin vui lòng bỏ qua email.`;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
      <h2 style="color: #2563eb; margin-top: 0;">Yêu cầu đặt lại mật khẩu</h2>
      <p>Xin chào <strong>${firstName}</strong>,</p>
      <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản thư viện liên kết với email <strong>${email}</strong>.</p>
      <p>Vui lòng bấm vào nút bên dưới để tiến hành đặt lại mật khẩu:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Hoặc sao chép liên kết sau dán vào trình duyệt:<br/><a href="${resetLink}" style="color: #2563eb;">${resetLink}</a></p>
      <p style="color: #dc2626; font-size: 13px;"><em>Lưu ý: Liên kết có hiệu lực trong 30 phút và chỉ sử dụng được 1 lần.</em></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">Nếu bạn không gửi yêu cầu này, hãy yên tâm bỏ qua email. Mật khẩu của bạn vẫn an toàn.</p>
    </div>
  `;

  return await sendMail({
    to: email,
    subject,
    text,
    html,
  });
};

module.exports = {
  createTransporter,
  sendMail,
  sendPasswordResetEmail,
};
