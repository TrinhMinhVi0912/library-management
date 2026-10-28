#!/usr/bin/env node

/**
 * Script tạo tài khoản admin đầu tiên
 * Cách dùng:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 npm run create-admin
 *   -- hoặc --
 *   npm run create-admin -- --email admin@example.com --password secret123
 *
 * Nếu admin với email đã tồn tại → bỏ qua, không ghi đè.
 * Không bao giờ in mật khẩu ra console.
 */

const bcrypt = require('bcryptjs');
const MongoDB = require('../app/utils/mongodb.util');
const { User } = require('../app/models');
const { nextCode } = require('../app/utils/code.util');

/**
 * Phân tích email và password từ biến môi trường hoặc đối số dòng lệnh
 * Ưu tiên: biến môi trường > đối số
 * @returns {{ email: string, password: string }}
 */
function parseArgs() {
  let email = process.env.ADMIN_EMAIL || '';
  let password = process.env.ADMIN_PASSWORD || '';

  // Phân tích đối số dòng lệnh: --email <value> --password <value>
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = email || args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      password = password || args[++i];
    }
  }

  if (!email || !password) {
    console.error(
      'Thiếu email hoặc mật khẩu.\n' +
        'Cách dùng:\n' +
        '  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 npm run create-admin\n' +
        '  npm run create-admin -- --email admin@example.com --password secret123'
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Mật khẩu phải có ít nhất 6 ký tự.');
    process.exit(1);
  }

  return { email: email.toLowerCase().trim(), password };
}

async function main() {
  const { email, password } = parseArgs();

  await MongoDB.connect();

  try {
    // Kiểm tra admin đã tồn tại chưa
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'admin') {
        console.log(`✔ Admin với email "${email}" đã tồn tại (code: ${existing.code}). Bỏ qua.`);
      } else {
        console.log(
          `⚠ Email "${email}" đã tồn tại với vai trò "${existing.role}". Không tạo admin trùng email.`
        );
      }
      return;
    }

    // Tạo admin mới
    const code = await nextCode('user');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = await User.create({
      code,
      email,
      passwordHash,
      role: 'admin',
      firstName: 'Quản trị',
      lastName: 'Viên',
      status: 'active',
    });

    console.log('✔ Đã tạo admin thành công!');
    console.log(`  Code : ${admin.code}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role : ${admin.role}`);
  } finally {
    await MongoDB.disconnect();
  }
}

main().catch((err) => {
  console.error('Lỗi khi tạo admin:', err.message);
  process.exit(1);
});

