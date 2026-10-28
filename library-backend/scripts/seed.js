#!/usr/bin/env node

/**
 * Script seed dữ liệu mẫu cho môi trường phát triển/kiểm thử
 * Cách dùng: npm run seed
 *
 * - Từ chối chạy khi NODE_ENV=production
 * - Đánh dấu dữ liệu seed bằng email domain "@seed.library.local" → xóa sạch khi chạy lại
 * - Hiện tại seed: 1 admin, 2 nhân viên, 20 độc giả
 * - Khung mở rộng cho: publishers, authors, categories, books, loans…
 */

const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker/locale/vi');
const MongoDB = require('../app/utils/mongodb.util');
const { User } = require('../app/models');
const { nextCode } = require('../app/utils/code.util');
const config = require('../app/config');

// ── Hằng số đánh dấu dữ liệu seed ─────────────────────────────
const SEED_EMAIL_DOMAIN = '@seed.library.local';
const SEED_PASSWORD = 'Seed@123'; // Mật khẩu chung cho mọi user seed

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Tạo email seed duy nhất cho một vai trò
 * @param {string} role  'admin' | 'staff' | 'reader'
 * @param {number} index Số thứ tự (bắt đầu từ 1)
 * @returns {string}
 */
const seedEmail = (role, index) => `${role}${index}${SEED_EMAIL_DOMAIN}`;

/**
 * Băm mật khẩu seed (cache salt để nhanh hơn khi seed nhiều user)
 * @param {string} password
 * @returns {Promise<string>}
 */
let _cachedSalt = null;
const hashPassword = async (password) => {
  if (!_cachedSalt) {
    _cachedSalt = await bcrypt.genSalt(10);
  }
  return bcrypt.hash(password, _cachedSalt);
};

// ── Xóa dữ liệu seed cũ ───────────────────────────────────────

/**
 * Xóa tất cả dữ liệu seed cũ (nhận diện qua email domain)
 * Mở rộng thêm model khi seed thêm entity
 */
async function cleanSeedData() {
  const userResult = await User.deleteMany({
    email: { $regex: SEED_EMAIL_DOMAIN.replace('.', '\\.') + '$' },
  });
  console.log(`  → Đã xóa ${userResult.deletedCount} user seed cũ`);

  // TODO: xóa seed data của các collection khác khi mở rộng
  // await Publisher.deleteMany({ code: { $regex: '^SEED-' } });
  // await Author.deleteMany({ name: { $regex: /^\[SEED\]/ } });
  // …
}

// ── Seed Users ──────────────────────────────────────────────────

/**
 * Tạo 1 admin + 2 nhân viên + 20 độc giả
 */
async function seedUsers() {
  console.log('\n📌 Seed users...');
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const users = [];

  // 1 Admin
  users.push(
    await buildUser({
      email: seedEmail('admin', 1),
      passwordHash,
      role: 'admin',
      firstName: 'Quản trị',
      lastName: 'Viên',
      gender: 'male',
      position: 'Quản trị hệ thống',
    })
  );

  // 2 Nhân viên
  for (let i = 1; i <= 2; i++) {
    users.push(
      await buildUser({
        email: seedEmail('staff', i),
        passwordHash,
        role: 'staff',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        gender: faker.helpers.arrayElement(['male', 'female']),
        position: faker.helpers.arrayElement([
          'Thủ thư',
          'Nhân viên quản lý',
        ]),
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
      })
    );
  }

  // 20 Độc giả
  for (let i = 1; i <= 20; i++) {
    users.push(
      await buildUser({
        email: seedEmail('reader', i),
        passwordHash,
        role: 'reader',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        gender: faker.helpers.arrayElement(['male', 'female', 'other']),
        birthDate: faker.date.birthdate({ min: 16, max: 60, mode: 'age' }),
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
      })
    );
  }

  // Bulk insert
  const inserted = await User.insertMany(users);
  console.log(`  → Đã tạo ${inserted.length} users`);
  console.log(`    • 1 admin:   ${seedEmail('admin', 1)}`);
  console.log(`    • 2 staff:   ${seedEmail('staff', 1)}, ${seedEmail('staff', 2)}`);
  console.log(`    • 20 reader: ${seedEmail('reader', 1)} … ${seedEmail('reader', 20)}`);
  console.log(`    • Mật khẩu chung: ${SEED_PASSWORD}`);
}

/**
 * Xây dựng đối tượng user với code tự tăng
 * @param {object} data
 * @returns {Promise<object>}
 */
async function buildUser(data) {
  const code = await nextCode('user');
  return {
    code,
    status: 'active',
    ...data,
  };
}

// ── Khung mở rộng (chưa triển khai) ────────────────────────────

// async function seedPublishers() {
//   console.log('\n📌 Seed publishers...');
//   // 5 NXB — dùng nextCode('publisher') cho mỗi NXB
// }

// async function seedAuthors() {
//   console.log('\n📌 Seed authors...');
//   // 15 tác giả
// }

// async function seedCategories() {
//   console.log('\n📌 Seed categories...');
//   // 8–10 thể loại
// }

// async function seedBooks() {
//   console.log('\n📌 Seed books...');
//   // 50–100 sách, gán ngẫu nhiên authors/categories/publisher, cover placeholder
// }

// async function seedLoansAndFines() {
//   console.log('\n📌 Seed loans & fines...');
//   // Vài phiếu mượn ở đủ trạng thái, vài phạt
// }

// async function seedReviews() {
//   console.log('\n📌 Seed reviews...');
// }

// async function seedForum() {
//   console.log('\n📌 Seed forum...');
//   // 4 chuyên mục, vài chủ đề mẫu
// }

// ── Main ────────────────────────────────────────────────────────

async function main() {
  // Từ chối chạy trên production
  if (config.env === 'production') {
    console.error('❌ KHÔNG được chạy seed trên môi trường production!');
    process.exit(1);
  }

  console.log(`🔧 Môi trường: ${config.env}`);
  console.log(`🔗 Database : ${config.mongodbUri}\n`);

  await MongoDB.connect();

  try {
    console.log('🧹 Xóa dữ liệu seed cũ...');
    await cleanSeedData();

    console.log('🌱 Bắt đầu seed dữ liệu...');
    await seedUsers();

    // Mở rộng thêm ở đây khi có task sau:
    // await seedPublishers();
    // await seedAuthors();
    // await seedCategories();
    // await seedBooks();
    // await seedLoansAndFines();
    // await seedReviews();
    // await seedForum();

    console.log('\n✅ Seed hoàn tất!');
  } finally {
    await MongoDB.disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi seed:', err.message);
  process.exit(1);
});
