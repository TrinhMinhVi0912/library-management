#!/usr/bin/env node

/**
 * Script seed dữ liệu mẫu toàn diện cho hệ thống Quản lý Mượn Sách
 * Dựa trên tài liệu API frontend: docs/09-tai-lieu-api-frontend.md
 * 
 * Cách dùng: npm run seed
 *
 * Dữ liệu seed bao gồm:
 * 1. Cấu hình hệ thống (Settings): thời hạn mượn, mức phạt, giới hạn số sách,...
 * 2. Tài khoản người dùng (Users): 1 admin, 2 nhân viên (staff), 20 độc giả (reader) (trong đó có 1 độc giả bị khóa để test)
 * 3. Danh mục & Sách (Catalog & Books): 10 thể loại, 15 tác giả, 5 NXB, 60 đầu sách chất lượng cao
 *    - Có sách còn bản sao
 *    - Có sách hết bản sao (availableCopies = 0) để test chức năng Đặt trước (Reservation)
 *    - Có sách bị ẩn (status: 'hidden') để test quyền xem của nhân viên/quản trị
 * 4. Kệ sách & Giỏ sách (Shelves & Carts):
 *    - Mỗi độc giả có 3 kệ mặc định ('Muốn đọc', 'Đang đọc', 'Đã đọc') chứa sách mẫu
 *    - Kệ tùy chọn (custom) để test CRUD kệ sách
 *    - Giỏ sách (Cart) cho độc giả có sẵn sách trong giỏ
 * 5. Mượn sách (Loans) với đầy đủ các trạng thái nghiệp vụ:
 *    - pending (chờ duyệt), approved (chờ lấy), borrowing (đang mượn), overdue (quá hạn),
 *      returned (đã trả), rejected (bị từ chối), cancelled (đã hủy)
 * 6. Gia hạn mượn sách (RenewalRequests):
 *    - pending, approved, rejected
 * 7. Tiền phạt (Fines):
 *    - unpaid (chưa thu: trễ hạn, hư hỏng, mất sách), paid (đã thu), waived (đã miễn phạt)
 *    - Đồng bộ tổng tiền phạt chưa trả (unpaidFineTotal) trên User
 * 8. Đặt trước sách (Reservations):
 *    - waiting, available (đang giữ sách), fulfilled, expired, cancelled
 * 9. Đánh giá sách (Reviews):
 *    - Đánh giá từ độc giả đã từng mượn sách (hợp lệ điều kiện canReview)
 *    - Có đánh giá bị ẩn (hidden: true) để test kiểm duyệt
 *    - Tự động tính toán lại ratingAvg và ratingCount cho Book
 * 10. Diễn đàn (Forum):
 *    - Chuyên mục (ForumCategory)
 *    - Chủ đề (ForumThread: ghim, khóa, liên kết sách, ẩn)
 *    - Bài trả lời (ForumPost: phân cấp cha - con, lượt thích)
 *    - Báo cáo vi phạm (ForumReport: open, resolved, dismissed)
 * 11. Thông báo (Notifications & NotificationRead):
 *    - Thông báo hệ thống (all), thông báo độc giả (readers), nhân viên (staff) và cá nhân (user)
 *    - Trạng thái đã đọc / chưa đọc để kiểm thử số đếm unread count
 * 12. Nhật ký kiểm toán (AuditLogs):
 *    - Các hoạt động đăng nhập, duyệt mượn, trả sách, thu phạt, sửa cấu hình
 */

const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const { faker } = require('@faker-js/faker/locale/vi');
const MongoDB = require('../app/utils/mongodb.util');
const {
  User,
  Publisher,
  Author,
  Category,
  Book,
  Cart,
  Loan,
  RenewalRequest,
  Fine,
  Reservation,
  Review,
  Shelf,
  Notification,
  NotificationRead,
  ForumCategory,
  ForumThread,
  ForumPost,
  ForumReport,
  Setting,
  AuditLog,
  RefreshToken,
  Counter,
} = require('../app/models');
const { nextCode } = require('../app/utils/code.util');
const config = require('../app/config');

// ── Hằng số đánh dấu dữ liệu seed ─────────────────────────────
const SEED_EMAIL_DOMAIN = '@seed.library.local';
const SEED_PASSWORD = 'Seed@123'; // Mật khẩu chung cho mọi tài khoản seed

// ── Danh sách URL ảnh mẫu ──────────────────────────────────────
const SAMPLE_BOOK_COVERS = [
  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507842229451-79b1be886a27?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80',
];

const SAMPLE_AUTHOR_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
];

const SAMPLE_USER_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
];

// ── Helpers ─────────────────────────────────────────────────────

const makeSlug = (text) =>
  slugify(text, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true,
  });

const seedEmail = (role, index) => `${role}${index}${SEED_EMAIL_DOMAIN}`;

let _cachedSalt = null;
const hashPassword = async (password) => {
  if (!_cachedSalt) {
    _cachedSalt = await bcrypt.genSalt(10);
  }
  return bcrypt.hash(password, _cachedSalt);
};

// ── 1. Xóa dữ liệu seed cũ ───────────────────────────────────────

async function cleanSeedData() {
  console.log('🧹 Xóa dữ liệu seed cũ...');
  const [
    userRes,
    bookRes,
    catRes,
    authorRes,
    pubRes,
    cartRes,
    loanRes,
    renewalRes,
    fineRes,
    resRes,
    revRes,
    shelfRes,
    notifRes,
    notifReadRes,
    fCatRes,
    fThreadRes,
    fPostRes,
    fReportRes,
    settRes,
    auditRes,
  ] = await Promise.all([
    User.deleteMany({ email: { $regex: SEED_EMAIL_DOMAIN.replace('.', '\\.') + '$' } }),
    Book.deleteMany({}),
    Category.deleteMany({}),
    Author.deleteMany({}),
    Publisher.deleteMany({}),
    Cart.deleteMany({}),
    Loan.deleteMany({}),
    RenewalRequest.deleteMany({}),
    Fine.deleteMany({}),
    Reservation.deleteMany({}),
    Review.deleteMany({}),
    Shelf.deleteMany({}),
    Notification.deleteMany({}),
    NotificationRead.deleteMany({}),
    ForumCategory.deleteMany({}),
    ForumThread.deleteMany({}),
    ForumPost.deleteMany({}),
    ForumReport.deleteMany({}),
    Setting.deleteMany({}),
    AuditLog.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  // Thiết lập lại các bộ đếm tự tăng (user, publisher, book, loan)
  await Counter.deleteMany({ _id: { $in: ['user', 'publisher', 'book', 'loan'] } });

  console.log(
    `  → Đã dọn dẹp: ${userRes.deletedCount} users, ${bookRes.deletedCount} sách, ` +
    `${loanRes.deletedCount} phiếu mượn, ${fineRes.deletedCount} tiền phạt, ` +
    `${revRes.deletedCount} đánh giá, ${fThreadRes.deletedCount} bài diễn đàn.`
  );
}

// ── 2. Seed Cấu hình Hệ thống (Setting) ─────────────────────────

async function seedSettings() {
  console.log('\n📌 1. Seed Cấu hình hệ thống (Settings)...');
  const setting = await Setting.create({
    maxBooksPerLoan: 5,
    loanDays: 14,
    maxRenewals: 2,
    renewDays: 7,
    pickupHoldDays: 3,
    reservationHoldDays: 3,
    lateFeePerDay: 2000,
    lostBookFeeRate: 1.0,
    lostBookProcessingFee: 20000,
  });
  console.log('  → Đã khởi tạo cấu hình hệ thống mặc định:');
  console.log('    • Tối đa 5 sách/phiếu, mượn 14 ngày, gia hạn tối đa 2 lần (7 ngày/lần)');
  console.log('    • Giữ sách đặt trước 3 ngày, phạt trễ 2.000đ/ngày');
  return setting;
}

// ── 3. Seed Người dùng (Users) ───────────────────────────────────

async function buildUser(data) {
  const code = await nextCode('user');
  return {
    code,
    status: 'active',
    ...data,
  };
}

async function seedUsers() {
  console.log('\n📌 2. Seed Người dùng (Users)...');
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const users = [];

  // 1 Admin
  users.push(
    await buildUser({
      email: seedEmail('admin', 1),
      passwordHash,
      role: 'admin',
      firstName: 'Nguyễn',
      lastName: 'Quản Trị',
      gender: 'male',
      position: 'Quản trị viên trưởng',
      phone: '0901234567',
      address: 'Phòng Quản trị hệ thống, Tầng 3 Thư viện',
      avatar: {
        url: SAMPLE_USER_AVATARS[0],
        publicId: 'seed/avatar-admin',
      },
    })
  );

  // 2 Nhân viên (Staff)
  const staffNames = [
    { first: 'Trần', last: 'Văn Thư', gender: 'male', pos: 'Thủ thư Trưởng' },
    { first: 'Lê', last: 'Thị Lưu', gender: 'female', pos: 'Nhân viên Quản lý Kho' },
  ];
  for (let i = 0; i < staffNames.length; i++) {
    users.push(
      await buildUser({
        email: seedEmail('staff', i + 1),
        passwordHash,
        role: 'staff',
        firstName: staffNames[i].first,
        lastName: staffNames[i].last,
        gender: staffNames[i].gender,
        position: staffNames[i].pos,
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        avatar: {
          url: SAMPLE_USER_AVATARS[(i + 1) % SAMPLE_USER_AVATARS.length],
          publicId: `seed/avatar-staff-${i + 1}`,
        },
      })
    );
  }

  // 20 Độc giả (Reader)
  // Trong đó: reader20 bị khóa (locked) để kiểm thử trường hợp tài khoản bị khóa
  for (let i = 1; i <= 20; i++) {
    const isLocked = i === 20;
    const gender = i % 2 === 0 ? 'female' : 'male';
    users.push(
      await buildUser({
        email: seedEmail('reader', i),
        passwordHash,
        role: 'reader',
        firstName: faker.person.firstName(gender),
        lastName: faker.person.lastName(),
        gender,
        birthDate: faker.date.birthdate({ min: 18, max: 45, mode: 'age' }),
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        avatar: {
          url: SAMPLE_USER_AVATARS[(i + 2) % SAMPLE_USER_AVATARS.length],
          publicId: `seed/avatar-reader-${i}`,
        },
        status: isLocked ? 'locked' : 'active',
        lockReason: isLocked ? 'Tài khoản tạm khóa do quá hạn trả sách và chưa thanh toán tiền phạt nhiều lần' : undefined,
      })
    );
  }

  const inserted = await User.insertMany(users);
  console.log(`  → Đã tạo ${inserted.length} người dùng:`);
  console.log(`    • 1 Admin:   ${seedEmail('admin', 1)}`);
  console.log(`    • 2 Staff:   ${seedEmail('staff', 1)}, ${seedEmail('staff', 2)}`);
  console.log(`    • 20 Reader: ${seedEmail('reader', 1)} … ${seedEmail('reader', 20)}`);
  console.log(`      (Trong đó reader20@seed.library.local có trạng thái 'locked' để kiểm thử)`);
  console.log(`    • Mật khẩu đăng nhập chung: ${SEED_PASSWORD}`);

  return {
    admin: inserted.find((u) => u.role === 'admin'),
    staff: inserted.filter((u) => u.role === 'staff'),
    readers: inserted.filter((u) => u.role === 'reader'),
  };
}

// ── 4. Seed Thể loại (Categories) ───────────────────────────────

const RAW_CATEGORIES = [
  {
    name: 'Công nghệ thông tin',
    description: 'Sách về lập trình, kiến trúc phần mềm, hệ cơ sở dữ liệu, mạng máy tính và trí tuệ nhân tạo.',
  },
  {
    name: 'Văn học Việt Nam',
    description: 'Các tác phẩm tiểu thuyết, truyện ngắn, thơ ca đặc sắc và kinh điển của nền văn học Việt Nam.',
  },
  {
    name: 'Văn học Nước ngoài',
    description: 'Tiểu thuyết kinh điển, tác phẩm đoạt giải Nobel và văn học hiện đại của các tác giả thế giới.',
  },
  {
    name: 'Kinh tế & Kinh doanh',
    description: 'Sách kiến thức kinh tế, quản trị doanh nghiệp, tài chính cá nhân và kinh nghiệm khởi nghiệp.',
  },
  {
    name: 'Tâm lý & Kỹ năng sống',
    description: 'Tâm lý học ứng dụng, phát triển bản thân, kỹ năng giao tiếp và tư duy tích cực.',
  },
  {
    name: 'Lịch sử & Triết học',
    description: 'Tài liệu nghiên cứu lịch sử Việt Nam, lịch sử văn minh nhân loại và tư tưởng triết học.',
  },
  {
    name: 'Khoa học & Tự nhiên',
    description: 'Khám phá vũ trụ, khoa học sự sống, vật lý, hóa học và tự nhiên kỳ thú.',
  },
  {
    name: 'Thiếu nhi & Tuổi mới lớn',
    description: 'Truyện cổ tích, truyện đồng thoại, tác phẩm giáo dục bồi đắp tâm hồn thiếu nhi.',
  },
  {
    name: 'Nghệ thuật & Thiết kế',
    description: 'Mỹ thuật, kiến trúc, nhiếp ảnh, thiết kế đồ họa và tư duy sáng tạo nghệ thuật.',
  },
  {
    name: 'Giáo trình & Ngoại ngữ',
    description: 'Giáo trình đào tạo, tài liệu học ngoại ngữ, ngữ pháp và cẩm nang luyện thi quốc tế.',
  },
];

async function seedCategories() {
  console.log('\n📌 3. Seed Thể loại (Categories)...');
  const categoriesData = RAW_CATEGORIES.map((c) => ({
    name: c.name,
    slug: makeSlug(c.name),
    description: c.description,
  }));

  const inserted = await Category.insertMany(categoriesData);
  console.log(`  → Đã tạo ${inserted.length} thể loại.`);
  return inserted;
}

// ── 5. Seed Tác giả (Authors) ───────────────────────────────────

const RAW_AUTHORS = [
  {
    name: 'Nguyễn Nhật Ánh',
    bio: 'Nhà văn Việt Nam nổi tiếng với các tác phẩm viết về tuổi học trò thơ mộng, dung dị và giàu cảm xúc.',
  },
  {
    name: 'Nam Cao',
    bio: 'Nhà văn hiện thực phê phán xuất sắc với ngòi bút sắc sảo miêu tả người nông dân và trí thức nghèo trước 1945.',
  },
  {
    name: 'Vũ Trọng Phụng',
    bio: 'Nhà văn, nhà báo trào phúng bậc thầy của văn học Việt Nam với phong cách hiện thực châm biếm sâu cay.',
  },
  {
    name: 'Tô Hoài',
    bio: 'Cây đại thụ của nền văn học Việt Nam hiện đại, tác giả của tác phẩm thiếu nhi bất hủ Dế Mèn phiêu lưu ký.',
  },
  {
    name: 'Nguyễn Du',
    bio: 'Đại thi hào dân tộc Việt Nam, danh nhân văn hóa thế giới, tác giả kiệt tác Truyện Kiều.',
  },
  {
    name: 'Robert C. Martin',
    bio: 'Chuyên gia công nghệ phần mềm quốc tế (Uncle Bob), đồng sáng lập Tuyên ngôn Agile và tác giả Clean Code.',
  },
  {
    name: 'Martin Fowler',
    bio: 'Kỹ sư phần mềm người Anh, chuyên gia hàng đầu về kiến trúc hướng đối tượng, vi dịch vụ và tái cấu trúc mã.',
  },
  {
    name: 'Yuval Noah Harari',
    bio: 'Giáo sư lịch sử Đại học Hebrew Jerusalem, tác giả bộ ba tác phẩm tri thức toàn cầu Sapiens, Homo Deus.',
  },
  {
    name: 'Dale Carnegie',
    bio: 'Nhà văn, nhà thuyết trình người Mỹ, người sáng lập chuỗi khóa học phát triển bản thân và nghệ thuật giao tiếp.',
  },
  {
    name: 'James Clear',
    bio: 'Tác giả, diễn giả nổi tiếng chuyên nghiên cứu về thói quen, cách thức ra quyết định và tự hoàn thiện bản thân.',
  },
  {
    name: 'Daniel Kahneman',
    bio: 'Nhà tâm lý học người Mỹ gốc Israel đoạt giải Nobel Kinh tế năm 2002 nhờ các nghiên cứu đột phá về hành vi.',
  },
  {
    name: 'Haruki Murakami',
    bio: 'Tiểu thuyết gia người Nhật Bản với phong cách hiện thực huyền ảo, tác phẩm dịch ra hơn 50 thứ tiếng trên thế giới.',
  },
  {
    name: 'Paulo Coelho',
    bio: 'Nhà văn nổi tiếng thế giới người Brazil, tác giả tiểu thuyết Nhà Giả Kim bán chạy bậc nhất lịch sử.',
  },
  {
    name: 'George Orwell',
    bio: 'Nhà văn, nhà báo chính luận người Anh với các kiệt tác phản địa đàng mang tính tiên tri sâu sắc.',
  },
  {
    name: 'Arthur Conan Doyle',
    bio: 'Nhà văn người Scotland nổi tiếng với việc sáng tạo nên vị thám tử đại tài huyền thoại Sherlock Holmes.',
  },
];

async function seedAuthors() {
  console.log('\n📌 4. Seed Tác giả (Authors)...');
  const authorsData = RAW_AUTHORS.map((a, idx) => ({
    name: a.name,
    bio: a.bio,
    photo: {
      url: SAMPLE_AUTHOR_PHOTOS[idx % SAMPLE_AUTHOR_PHOTOS.length],
      publicId: `seed/author-${idx + 1}`,
    },
  }));

  const inserted = await Author.insertMany(authorsData);
  console.log(`  → Đã tạo ${inserted.length} tác giả.`);
  return inserted;
}

// ── 6. Seed Nhà xuất bản (Publishers) ───────────────────────────

const RAW_PUBLISHERS = [
  {
    name: 'NXB Trẻ',
    address: '161B Lý Chính Thắng, Phường 7, Quận 3, TP. Hồ Chí Minh',
  },
  {
    name: 'NXB Kim Đồng',
    address: '55 Quang Trung, Phường Nguyễn Du, Quận Hai Bà Trưng, Hà Nội',
  },
  {
    name: 'NXB Tổng Hợp TP.HCM',
    address: '62 Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
  },
  {
    name: 'NXB Hội Nhà Văn',
    address: '65 Nguyễn Du, Phường Nguyễn Du, Quận Hai Bà Trưng, Hà Nội',
  },
  {
    name: 'NXB Lao Động',
    address: '175 Giảng Võ, Phường Cát Linh, Quận Đống Đa, Hà Nội',
  },
];

async function seedPublishers() {
  console.log('\n📌 5. Seed Nhà xuất bản (Publishers)...');
  const publishers = [];
  for (const pub of RAW_PUBLISHERS) {
    const code = await nextCode('publisher');
    publishers.push({
      code,
      name: pub.name,
      address: pub.address,
    });
  }

  const inserted = await Publisher.insertMany(publishers);
  console.log(`  → Đã tạo ${inserted.length} nhà xuất bản.`);
  return inserted;
}

// ── 7. Seed Đầu Sách (Books) ────────────────────────────────────

const RAW_BOOKS_DEFINITIONS = [
  // 1-6: CNTT (Robert C. Martin, Martin Fowler)
  {
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2008,
    price: 185000,
    pages: 464,
    description: 'Cẩm nang kinh điển hướng dẫn lập trình viên viết mã nguồn sạch, dễ đọc, dễ kiểm thử và dễ bảo trì.',
  },
  {
    title: 'The Clean Coder: A Code of Conduct for Professional Programmers',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2011,
    price: 165000,
    pages: 256,
    description: 'Quy tắc ứng xử và đạo đức nghề nghiệp dành cho kỹ sư phần mềm chuyên nghiệp trong môi trường phát triển hiện đại.',
  },
  {
    title: 'Clean Architecture: A Craftsman Guide to Software Structure',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2017,
    price: 195000,
    pages: 432,
    description: 'Nguyên tắc thiết kế kiến trúc phần mềm bất biến qua thời gian, phân tách ranh giới và kiểm soát phụ thuộc.',
  },
  {
    title: 'Refactoring: Improving the Design of Existing Code',
    authorNames: ['Martin Fowler'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2018,
    price: 210000,
    pages: 448,
    description: 'Kỹ thuật cải tiến cấu trúc mã nguồn kế thừa mà không làm thay đổi hành vi bên ngoài của phần mềm.',
  },
  {
    title: 'Patterns of Enterprise Application Architecture',
    authorNames: ['Martin Fowler'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2002,
    price: 230000,
    pages: 560,
    description: 'Tập hợp các mẫu kiến trúc kinh điển ứng dụng trong phát triển hệ thống phần mềm doanh nghiệp quy mô lớn.',
  },
  {
    title: 'Clean Agile: Back to Basics',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2019,
    price: 150000,
    pages: 240,
    description: 'Khám phá lại tinh thần cốt lõi của phương pháp luận Agile từ góc nhìn của một trong những người sáng lập.',
  },

  // 7-14: Nguyễn Nhật Ánh
  {
    title: 'Mắt Biếc',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1990,
    price: 110000,
    pages: 300,
    description: 'Mối tình đơn phương da diết của Ngạn dành cho Hà Lan qua năm tháng đầy hoài niệm ở làng Đo Đo.',
  },
  {
    title: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2008,
    price: 95000,
    pages: 216,
    description: 'Chuyến tàu chở người đọc trở về thế giới tuổi thơ hồn nhiên, nghịch ngợm nhưng chứa chan bài học sâu lắng.',
  },
  {
    title: 'Cô Gái Đến Từ Hôm Qua',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1989,
    price: 85000,
    pages: 204,
    description: 'Câu chuyện tình học trò đáng yêu đan xen giữa quá khứ ngây thơ và hiện tại bối rối của cậu học trò Anh Thư.',
  },
  {
    title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2010,
    price: 125000,
    pages: 378,
    description: 'Bức tranh làng quê Việt Nam thanh bình qua ánh mắt trẻ thơ cùng những bài học đầu đời về tình anh em và lòng vị tha.',
  },
  {
    title: 'Ngồi Khóc Trên Cây',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2013,
    price: 105000,
    pages: 348,
    description: 'Câu chuyện tình trong trẻo nhưng đầy trắc trở giữa chàng sinh viên Đông và cô bé Rùa nơi miền sơn cước.',
  },
  {
    title: 'Lá Nằm Trong Sương',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2002,
    price: 78000,
    pages: 180,
    description: 'Những mảnh ghép kỷ niệm trong veo của tuổi học trò dưới mái trường xưa.',
  },
  {
    title: 'Cây Chuối Non Đi Giày Xanh',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2017,
    price: 110000,
    pages: 304,
    description: 'Những câu chuyện cảm động về tình bạn, tình làng nghĩa xóm nơi thị trấn Hà Lam thân thương.',
  },

  // 15-18: Nam Cao, Tô Hoài, Vũ Trọng Phụng
  {
    title: 'Chí Phèo',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1941,
    price: 65000,
    pages: 160,
    description: 'Kiệt tác hiện thực phê phán phản ánh bi kịch bị cự tuyệt quyền làm người của người nông dân trước cách mạng.',
  },
  {
    title: 'Dế Mèn Phiêu Lưu Ký',
    authorNames: ['Tô Hoài'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1941,
    price: 75000,
    pages: 190,
    description: 'Chuyến phiêu lưu kỳ thú của chú Dế Mèn cùng thông điệp hòa bình, tình hữu ái muôn loài.',
  },
  {
    title: 'Số Đỏ',
    authorNames: ['Vũ Trọng Phụng'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1936,
    price: 88000,
    pages: 250,
    description: 'Tiểu thuyết trào phúng đỉnh cao vạch trần bộ mặt giả dối, lố lăng của xã hội tư sản thực dân nửa phong kiến.',
  },
  {
    title: 'Truyện Kiều',
    authorNames: ['Nguyễn Du'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1820,
    price: 95000,
    pages: 320,
    description: 'Kiệt tác thơ Nôm kinh điển của văn học Việt Nam, khắc họa cuộc đời tài hoa bạc mệnh của nàng Thúy Kiều.',
  },

  // 19-25: Văn học Nước ngoài (Murakami, Paulo Coelho, George Orwell, Conan Doyle)
  {
    title: 'Rừng Na Uy (Norwegian Wood)',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1987,
    price: 135000,
    pages: 512,
    description: 'Tiểu thuyết ám ảnh về tình yêu, sự mất mát và những băn khoăn hiện sinh của tuổi trẻ Nhật Bản thập niên 60.',
  },
  {
    title: 'Kafka Bên Bờ Biển',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2002,
    price: 155000,
    pages: 648,
    description: 'Hành trình trốn chạy định mệnh kỳ bí đan xen giữa hai tuyến nhân vật song song đậm chất hiện thực huyền ảo.',
  },
  {
    title: '1Q84 (Tập 1 & 2)',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2009,
    price: 195000,
    pages: 720,
    description: 'Thế giới song song với hai mặt trăng nơi hai con người tìm kiếm nhau giữa những biến động siêu nhiên kỳ bí.',
  },
  {
    title: 'Nhà Giả Kim (The Alchemist)',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Văn học Nước ngoài', 'Tâm lý & Kỹ năng sống'],
    publishYear: 1988,
    price: 79000,
    pages: 228,
    description: 'Câu chuyện ngụ ngôn giàu triết lý về hành trình theo đuổi vận mệnh cá nhân của chàng chăn cừu Santiago.',
  },
  {
    title: '1984',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1949,
    price: 115000,
    pages: 368,
    description: 'Kiệt tác phản địa đàng cảnh báo về sự giám sát toàn trị và sự biến mất của tự do tư tưởng cá nhân.',
  },
  {
    title: 'Chuyện Ở Nông Trại (Animal Farm)',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1945,
    price: 72000,
    pages: 160,
    description: 'Truyện ngụ ngôn chính trị châm biếm sâu sắc về sự biến chất của quyền lực tuyệt đối.',
  },
  {
    title: 'Chiếc Nhẫn Tình Cờ (A Study in Scarlet - Sherlock Holmes)',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1887,
    price: 85000,
    pages: 210,
    description: 'Vụ án đầu tiên đánh dấu cuộc gặp gỡ định mệnh giữa thám tử đại tài Sherlock Holmes và bác sĩ Watson.',
  },

  // 26-32: Kỹ năng & Tâm lý (James Clear, Dale Carnegie, Daniel Kahneman)
  {
    title: 'Atomic Habits: Thay Đổi Tí Hon, Hiệu Quả Bất Ngờ',
    authorNames: ['James Clear'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 2018,
    price: 189000,
    pages: 388,
    description: 'Chiến lược khoa học từng bước xây dựng thói quen tốt và loại bỏ thói quen xấu một cách tự nhiên và bền vững.',
  },
  {
    title: 'Đắc Nhân Tâm (How to Win Friends and Influence People)',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1936,
    price: 86000,
    pages: 320,
    description: 'Cuốn sách nghệ thuật ứng xử kinh điển được độc giả toàn thế giới đón nhận suốt gần một thế kỷ qua.',
  },
  {
    title: 'Quẳng Gánh Lo Đi Và Vui Sống',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1948,
    price: 92000,
    pages: 340,
    description: 'Phương pháp kiểm soát căng thẳng, lo âu để tận hưởng trọn vẹn từng khoảnh khắc bình an trong đời.',
  },
  {
    title: 'Tư Duy Nhanh Và Chậm (Thinking, Fast and Slow)',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2011,
    price: 245000,
    pages: 610,
    description: 'Khám phá hai hệ thống chi phối tư duy con người: trực giác cảm tính và suy luận logic phân tích.',
  },
  {
    title: 'Nhiễu: Điểm Mù Trong Phán Đoán Của Con Người',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2021,
    price: 215000,
    pages: 520,
    description: 'Phân tích hiện tượng nhiễu ngẫu nhiên trong hệ thống tư pháp, y tế và quản lý cùng giải pháp giảm thiểu sai số.',
  },

  // 33-35: Yuval Noah Harari
  {
    title: 'Sapiens: Lược Sử Loài Người',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học', 'Khoa học & Tự nhiên'],
    publishYear: 2011,
    price: 185000,
    pages: 560,
    description: 'Bức tranh toàn cảnh về hành trình tiến hóa của loài người từ vượn cổ đến khi thống trị hành tinh xanh.',
  },
  {
    title: 'Homo Deus: Lược Sử Tương Lai',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học', 'Khoa học & Tự nhiên'],
    publishYear: 2015,
    price: 195000,
    pages: 520,
    description: 'Dự phóng táo bạo về tương lai của nhân loại khi con người nắm giữ công nghệ sinh học và trí tuệ nhân tạo.',
  },
  {
    title: '21 Bài Học Cho Thế Kỷ 21',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học'],
    publishYear: 2018,
    price: 175000,
    pages: 440,
    description: 'Khảo sát những thách thức cấp bách của thời đại hôm nay: từ biến đổi khí hậu, tin giả cho đến tự động hóa.',
  },

  // 36-39: Kinh tế & Kinh doanh
  {
    title: 'Khởi Nghiệp Tinh Gọn (The Lean Startup)',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2011,
    price: 135000,
    pages: 340,
    description: 'Mô hình phát triển sản phẩm linh hoạt dựa trên vòng lặp Xây dựng - Đo lường - Học hỏi giúp giảm thiểu rủi ro.',
  },
  {
    title: 'Chiến Lược Đại Dương Xanh',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2005,
    price: 145000,
    pages: 360,
    description: 'Phương pháp tạo ra không gian thị trường hoàn toàn mới và vô hiệu hóa đối thủ cạnh tranh.',
  },
  {
    title: 'Từ Tốt Đến Vĩ Đại (Good to Great)',
    authorNames: ['James Clear'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2001,
    price: 155000,
    pages: 410,
    description: 'Nghiên cứu nguyên nhân cốt lõi giúp các doanh nghiệp bình thường bứt phá trở thành những gã khổng lồ vĩ đại.',
  },
  {
    title: 'Tâm Lý Học Về Tiền (The Psychology of Money)',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Kinh tế & Kinh doanh', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2020,
    price: 139000,
    pages: 312,
    description: 'Những câu chuyện thú vị giải thích cách cảm xúc, cái tôi và góc nhìn quá khứ ảnh hưởng đến tài chính cá nhân.',
  },

  // 40-42: Khoa học & Đời sống
  {
    title: 'Lược Sử Thời Gian (A Brief History of Time)',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 1988,
    price: 125000,
    pages: 280,
    description: 'Cuốn sách khoa học đại chúng kinh điển giải thích về lỗ đen, thuyết tương đối và nguồn gốc vũ trụ.',
  },
  {
    title: 'Vũ Trụ Trong Vỏ Hạt Dẻ',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 2001,
    price: 140000,
    pages: 290,
    description: 'Khám phá các biên giới mới nhất của vật lý lý thuyết: thuyết dây, không-thời gian nhiều chiều và thuyết lượng tử.',
  },
  {
    title: 'Tại Sao Chúng Ta Lại Ngủ',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Khoa học & Tự nhiên', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2017,
    price: 165000,
    pages: 420,
    description: 'Công trình khoa học đột phá hé mở sức mạnh kỳ diệu của giấc ngủ đối với trí nhớ, sức khỏe và tuổi thọ.',
  },

  // 43-45: Thiếu nhi & Nghệ thuật
  {
    title: 'Hoàng Tử Bé (Le Petit Prince)',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn', 'Văn học Nước ngoài'],
    publishYear: 1943,
    price: 75000,
    pages: 120,
    description: 'Câu chuyện cổ tích triết lý sâu sắc nhắc nhở người lớn về những điều chỉ có thể nhìn thấu bằng trái tim.',
  },
  {
    title: 'Những Tấm Lòng Cao Cả',
    authorNames: ['Tô Hoài'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1886,
    price: 95000,
    pages: 290,
    description: 'Cuốn nhật ký học trò chân thực chứa chan tình yêu thương thầy cô, gia đình và bạn bè trang lứa.',
  },
  {
    title: 'Nghệ Thuật Tư Duy Rành Mạch',
    authorNames: ['James Clear'],
    categoryNames: ['Nghệ thuật & Thiết kế', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2011,
    price: 118000,
    pages: 330,
    description: 'Chỉ ra 52 lỗi tư duy phổ biến khiến chúng ta đưa ra những quyết định thiếu sáng suốt trong cuộc sống.',
  },

  // 46-48: Giáo trình & Ngoại ngữ
  {
    title: 'Ngữ Pháp Tiếng Anh Thực Hành Hiện Đại',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Giáo trình & Ngoại ngữ'],
    publishYear: 2020,
    price: 130000,
    pages: 450,
    description: 'Cẩm nang hệ thống hóa toàn bộ kiến thức ngữ pháp tiếng Anh từ cơ bản đến nâng cao kèm bài tập áp dụng.',
  },
  {
    title: 'Cẩm Nang Luyện Thi IELTS 8.0 Toàn Diện',
    authorNames: ['Martin Fowler'],
    categoryNames: ['Giáo trình & Ngoại ngữ'],
    publishYear: 2022,
    price: 175000,
    pages: 360,
    description: 'Chiến thuật làm bài và bộ từ vựng học thuật đỉnh cao chinh phục cả 4 kỹ năng Nghe - Nói - Đọc - Viết.',
  },
  {
    title: 'Lập Trình Web Hiện Đại Với Node.js & MERN Stack',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin', 'Giáo trình & Ngoại ngữ'],
    publishYear: 2023,
    price: 240000,
    pages: 580,
    description: 'Giáo trình thực hành xây dựng ứng dụng web quy mô lớn sử dụng hệ sinh thái JavaScript hiện đại từ A đến Z.',
  },
];

async function seedBooks(categories, authors, publishers) {
  console.log('\n📌 6. Seed Đầu Sách (Books)...');
  const catMap = new Map(categories.map((c) => [c.name, c._id]));
  const authorMap = new Map(authors.map((a) => [a.name, a]));
  const pubList = publishers;

  const booksToInsert = [];

  // Danh sách các chỉ số sách sẽ gán availableCopies = 0 để kiểm thử chức năng ĐẶT TRƯỚC (Reservation)
  const zeroCopiesIndices = new Set([0, 6, 14, 20, 30]); // Clean Code, Mắt Biếc, Dế Mèn, Nhà Giả Kim, Sapiens

  for (let i = 0; i < RAW_BOOKS_DEFINITIONS.length; i++) {
    const def = RAW_BOOKS_DEFINITIONS[i];
    const code = await nextCode('book');
    const slug = makeSlug(def.title);

    const matchedAuthors = def.authorNames
      .map((name) => authorMap.get(name))
      .filter(Boolean);
    const authorIds = matchedAuthors.map((a) => a._id);
    const authorText = matchedAuthors.map((a) => a.name).join(', ');

    const categoryIds = def.categoryNames
      .map((name) => catMap.get(name))
      .filter(Boolean);

    const publisher = pubList[i % pubList.length];

    // Số lượng sách:
    let totalCopies = faker.number.int({ min: 6, max: 20 });
    let availableCopies;

    if (zeroCopiesIndices.has(i)) {
      // Sách hết sạch bản sao để test ĐẶT TRƯỚC
      totalCopies = 5;
      availableCopies = 0;
    } else {
      availableCopies = faker.number.int({ min: 2, max: totalCopies });
    }

    const ratingAvg = Number(faker.number.float({ min: 4.2, max: 5.0, fractionDigits: 1 }));
    const ratingCount = faker.number.int({ min: 10, max: 80 });
    const borrowCount = faker.number.int({ min: 15, max: 200 });

    const coverUrl = SAMPLE_BOOK_COVERS[i % SAMPLE_BOOK_COVERS.length];
    const isbn = `978-604-${faker.number.int({ min: 10, max: 99 })}-${faker.number.int({ min: 10000, max: 99999 })}-${faker.number.int({ min: 0, max: 9 })}`;
    const location = `Kệ ${String.fromCharCode(65 + (i % 6))}${((i % 4) + 1)}-0${(i % 9) + 1}`;

    // 2 cuốn cuối cùng để trạng thái 'hidden' kiểm thử phân quyền quản trị
    const status = i >= RAW_BOOKS_DEFINITIONS.length - 2 ? 'hidden' : 'active';

    booksToInsert.push({
      code,
      title: def.title,
      slug,
      isbn,
      authors: authorIds,
      authorText,
      publisher: publisher._id,
      publishYear: def.publishYear,
      price: def.price,
      totalCopies,
      availableCopies,
      categories: categoryIds,
      language: 'Tiếng Việt',
      pages: def.pages,
      description: def.description,
      cover: {
        url: coverUrl,
        publicId: `seed/book-${code.toLowerCase()}`,
      },
      location,
      ratingAvg,
      ratingCount,
      borrowCount,
      status,
    });
  }

  const inserted = await Book.insertMany(booksToInsert);
  console.log(`  → Đã tạo ${inserted.length} cuốn sách mẫu:`);
  console.log(`    • Hoạt động (active): ${inserted.filter((b) => b.status === 'active').length}`);
  console.log(`    • Ẩn (hidden):         ${inserted.filter((b) => b.status === 'hidden').length}`);
  console.log(`    • Hết bản sao (available = 0, để test Đặt trước): ${inserted.filter((b) => b.availableCopies === 0).length}`);

  return inserted;
}

// ── 8. Seed Kệ Sách (Shelves) & Giỏ Sách (Carts) ─────────────────

async function seedShelvesAndCarts(readers, books) {
  console.log('\n📌 7. Seed Kệ sách (Shelves) & Giỏ sách (Carts)...');
  const shelvesToInsert = [];
  const cartsToInsert = [];

  const activeBooks = books.filter((b) => b.status === 'active');

  for (let rIdx = 0; rIdx < readers.length; rIdx++) {
    const reader = readers[rIdx];

    // 3 Kệ mặc định cho MỌI độc giả: 'Muốn đọc' (want), 'Đang đọc' (reading), 'Đã đọc' (read)
    const wantBooks = [activeBooks[(rIdx * 3) % activeBooks.length], activeBooks[(rIdx * 3 + 1) % activeBooks.length]];
    const readingBooks = [activeBooks[(rIdx * 3 + 2) % activeBooks.length]];
    const readBooks = [activeBooks[(rIdx * 3 + 3) % activeBooks.length], activeBooks[(rIdx * 3 + 4) % activeBooks.length]];

    shelvesToInsert.push({
      user: reader._id,
      name: 'Muốn đọc',
      type: 'want',
      items: wantBooks.map((b) => ({ book: b._id, addedAt: new Date(Date.now() - 5 * 86400000) })),
    });

    shelvesToInsert.push({
      user: reader._id,
      name: 'Đang đọc',
      type: 'reading',
      items: readingBooks.map((b) => ({ book: b._id, addedAt: new Date(Date.now() - 3 * 86400000) })),
    });

    shelvesToInsert.push({
      user: reader._id,
      name: 'Đã đọc',
      type: 'read',
      items: readBooks.map((b) => ({ book: b._id, addedAt: new Date(Date.now() - 15 * 86400000) })),
    });

    // Reader 1 và Reader 2 có thêm kệ tự tạo (custom)
    if (rIdx === 0) {
      shelvesToInsert.push({
        user: reader._id,
        name: 'Sách tâm đắc',
        type: 'custom',
        items: [
          { book: activeBooks[0]._id, addedAt: new Date() },
          { book: activeBooks[1]._id, addedAt: new Date() },
        ],
      });
    } else if (rIdx === 1) {
      shelvesToInsert.push({
        user: reader._id,
        name: 'Cần đọc trong tháng',
        type: 'custom',
        items: [{ book: activeBooks[4]._id, addedAt: new Date() }],
      });
    }

    // Giỏ sách cho 3 độc giả đầu tiên để vào trang Cart có dữ liệu ngay
    if (rIdx < 3) {
      const cartBooks = [activeBooks[(rIdx * 2 + 5) % activeBooks.length], activeBooks[(rIdx * 2 + 6) % activeBooks.length]];
      cartsToInsert.push({
        user: reader._id,
        items: cartBooks.map((b) => ({ book: b._id, addedAt: new Date() })),
      });
    }
  }

  await Shelf.insertMany(shelvesToInsert);
  await Cart.insertMany(cartsToInsert);

  console.log(`  → Đã tạo ${shelvesToInsert.length} kệ sách (3 kệ mặc định cho 20 độc giả + kệ custom).`);
  console.log(`  → Đã khởi tạo giỏ hàng (Cart) mẫu cho ${cartsToInsert.length} độc giả đầu tiên.`);
}

// ── 9. Seed Phiếu Mượn (Loans) & Gia Hạn (Renewals) ─────────────

async function seedLoansAndRenewals(readers, books, staff, admin) {
  console.log('\n📌 8. Seed Phiếu mượn (Loans) & Yêu cầu gia hạn (Renewals)...');
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const activeBooks = books.filter((b) => b.status === 'active');
  const loans = [];
  const renewals = [];

  // Định nghĩa các kịch bản phiếu mượn thực tế
  const loanScenarios = [
    // 1-3: Chờ duyệt (pending)
    {
      reader: readers[0],
      status: 'pending',
      createdAgo: 1 * DAY,
      books: [activeBooks[1], activeBooks[2]],
      requestNote: 'Em cần mượn gấp để làm đồ án tốt nghiệp tuần sau ạ.',
    },
    {
      reader: readers[6],
      status: 'pending',
      createdAgo: 2 * DAY,
      books: [activeBooks[3]],
      requestNote: 'Xin nhận vào buổi chiều sau giờ học.',
    },
    {
      reader: readers[7],
      status: 'pending',
      createdAgo: 0.5 * DAY,
      books: [activeBooks[5], activeBooks[7]],
      requestNote: '',
    },

    // 4-5: Đã duyệt, chờ nhận (approved)
    {
      reader: readers[1],
      status: 'approved',
      createdAgo: 2 * DAY,
      approvedAgo: 1 * DAY,
      pickupDeadline: new Date(now + 2 * DAY),
      approvedBy: staff[0]._id,
      books: [activeBooks[8], activeBooks[9]],
    },
    {
      reader: readers[8],
      status: 'approved',
      createdAgo: 3 * DAY,
      approvedAgo: 1.5 * DAY,
      pickupDeadline: new Date(now + 1.5 * DAY),
      approvedBy: staff[1]._id,
      books: [activeBooks[10]],
    },

    // 6-9: Đang mượn (borrowing)
    {
      reader: readers[2],
      status: 'borrowing',
      createdAgo: 7 * DAY,
      approvedAgo: 6 * DAY,
      borrowedAgo: 5 * DAY,
      dueDate: new Date(now + 9 * DAY),
      handedOverBy: staff[0]._id,
      books: [activeBooks[11], activeBooks[12]],
      hasPendingRenewal: true, // Có 1 yêu cầu gia hạn đang chờ duyệt
    },
    {
      reader: readers[9],
      status: 'borrowing',
      createdAgo: 10 * DAY,
      approvedAgo: 9 * DAY,
      borrowedAgo: 8 * DAY,
      dueDate: new Date(now + 13 * DAY), // Đã được gia hạn thêm 7 ngày
      handedOverBy: staff[1]._id,
      books: [activeBooks[13]],
      hasApprovedRenewal: true, // Có 1 yêu cầu gia hạn đã được duyệt
    },
    {
      reader: readers[10],
      status: 'borrowing',
      createdAgo: 6 * DAY,
      approvedAgo: 5 * DAY,
      borrowedAgo: 4 * DAY,
      dueDate: new Date(now + 10 * DAY),
      handedOverBy: staff[0]._id,
      books: [activeBooks[15]],
      hasRejectedRenewal: true, // Có 1 yêu cầu gia hạn bị từ chối
    },
    {
      reader: readers[11],
      status: 'borrowing',
      createdAgo: 4 * DAY,
      approvedAgo: 3 * DAY,
      borrowedAgo: 3 * DAY,
      dueDate: new Date(now + 11 * DAY),
      handedOverBy: staff[1]._id,
      books: [activeBooks[16], activeBooks[17]],
    },

    // 10-12: Quá hạn (overdue) - borrowDate cách đây 25 ngày, dueDate cách đây 11 ngày
    {
      reader: readers[3],
      status: 'overdue',
      createdAgo: 26 * DAY,
      approvedAgo: 25.5 * DAY,
      borrowedAgo: 25 * DAY,
      dueDate: new Date(now - 11 * DAY),
      handedOverBy: staff[0]._id,
      books: [activeBooks[18]],
    },
    {
      reader: readers[12],
      status: 'overdue',
      createdAgo: 28 * DAY,
      approvedAgo: 27 * DAY,
      borrowedAgo: 26 * DAY,
      dueDate: new Date(now - 12 * DAY),
      handedOverBy: staff[1]._id,
      books: [activeBooks[19]],
    },
    {
      reader: readers[13],
      status: 'overdue',
      createdAgo: 30 * DAY,
      approvedAgo: 29 * DAY,
      borrowedAgo: 28 * DAY,
      dueDate: new Date(now - 14 * DAY),
      handedOverBy: staff[0]._id,
      books: [activeBooks[0]], // Clean Code
    },

    // 13-16: Đã trả (returned)
    {
      reader: readers[4],
      status: 'returned',
      createdAgo: 20 * DAY,
      approvedAgo: 19 * DAY,
      borrowedAgo: 18 * DAY,
      returnedAgo: 6 * DAY,
      handedOverBy: staff[0]._id,
      returnedBy: staff[1]._id,
      books: [activeBooks[21], activeBooks[22]],
    },
    {
      reader: readers[14],
      status: 'returned',
      createdAgo: 18 * DAY,
      approvedAgo: 17 * DAY,
      borrowedAgo: 16 * DAY,
      returnedAgo: 4 * DAY,
      handedOverBy: staff[1]._id,
      returnedBy: staff[0]._id,
      books: [activeBooks[23]],
    },
    {
      reader: readers[15],
      status: 'returned',
      createdAgo: 15 * DAY,
      approvedAgo: 14 * DAY,
      borrowedAgo: 13 * DAY,
      returnedAgo: 2 * DAY,
      handedOverBy: staff[0]._id,
      returnedBy: staff[0]._id,
      books: [activeBooks[24]],
    },
    {
      reader: readers[16],
      status: 'returned',
      createdAgo: 22 * DAY,
      approvedAgo: 21 * DAY,
      borrowedAgo: 20 * DAY,
      returnedAgo: 8 * DAY,
      handedOverBy: staff[1]._id,
      returnedBy: staff[1]._id,
      books: [activeBooks[25], activeBooks[26]],
    },

    // 17: Bị từ chối (rejected)
    {
      reader: readers[5],
      status: 'rejected',
      createdAgo: 5 * DAY,
      rejectReason: 'Độc giả còn khoản tiền phạt chưa thanh toán quá 7 ngày.',
      books: [activeBooks[27]],
    },

    // 18: Đã hủy (cancelled)
    {
      reader: readers[0],
      status: 'cancelled',
      createdAgo: 12 * DAY,
      books: [activeBooks[28]],
      requestNote: 'Đổi ý không cần nữa.',
    },
  ];

  for (const s of loanScenarios) {
    const code = await nextCode('loan');
    const createdAt = new Date(now - s.createdAgo);

    const items = s.books.map((b, idx) => {
      let itemStatus = 'pending';
      if (s.status === 'borrowing') itemStatus = 'borrowing';
      else if (s.status === 'overdue') itemStatus = 'borrowing';
      else if (s.status === 'returned') itemStatus = 'returned';

      const borrowDate = s.borrowedAgo ? new Date(now - s.borrowedAgo) : undefined;
      const dueDate = s.dueDate || (borrowDate ? new Date(borrowDate.getTime() + 14 * DAY) : undefined);
      const returnDate = s.returnedAgo ? new Date(now - s.returnedAgo) : undefined;

      const renewCount = s.hasApprovedRenewal && idx === 0 ? 1 : 0;
      const renewalsHistory = [];
      if (renewCount > 0) {
        renewalsHistory.push({
          at: new Date(now - 3 * DAY),
          oldDue: new Date(borrowDate.getTime() + 14 * DAY),
          newDue: s.dueDate,
          approvedBy: staff[0]._id,
        });
      }

      return {
        book: b._id,
        titleSnapshot: b.title,
        priceSnapshot: b.price,
        status: itemStatus,
        borrowDate,
        dueDate,
        returnDate,
        renewCount,
        renewals: renewalsHistory,
        condition: s.status === 'returned' ? 'good' : undefined,
      };
    });

    const loanDoc = {
      code,
      reader: s.reader._id,
      status: s.status,
      items,
      requestNote: s.requestNote,
      expectedPickupDate: s.approvedAgo ? new Date(createdAt.getTime() + 1 * DAY) : undefined,
      pickupDeadline: s.pickupDeadline,
      rejectReason: s.rejectReason,
      approvedBy: s.approvedBy,
      handedOverBy: s.handedOverBy,
      returnedBy: s.returnedBy,
      approvedAt: s.approvedAgo ? new Date(now - s.approvedAgo) : undefined,
      handedOverAt: s.borrowedAgo ? new Date(now - s.borrowedAgo) : undefined,
      closedAt: s.returnedAgo ? new Date(now - s.returnedAgo) : undefined,
      createdAt,
      updatedAt: s.returnedAgo ? new Date(now - s.returnedAgo) : createdAt,
    };

    loans.push(loanDoc);
  }

  const insertedLoans = await Loan.insertMany(loans);

  // Tạo các yêu cầu gia hạn (RenewalRequest) gắn với phiếu mượn tương ứng
  // 1. Pending Renewal Request (reader3)
  const loanWithPendingRenewal = insertedLoans.find((l) => l.code === 'PM000006');
  if (loanWithPendingRenewal) {
    renewals.push({
      loan: loanWithPendingRenewal._id,
      book: loanWithPendingRenewal.items[0].book,
      reader: loanWithPendingRenewal.reader,
      currentDueDate: loanWithPendingRenewal.items[0].dueDate,
      requestedDueDate: new Date(loanWithPendingRenewal.items[0].dueDate.getTime() + 7 * DAY),
      reason: 'Sách rất hay và dày, em xin gia hạn thêm 1 tuần để đọc kỹ hơn ạ.',
      status: 'pending',
    });
  }

  // 2. Approved Renewal Request (reader10)
  const loanWithApprovedRenewal = insertedLoans.find((l) => l.code === 'PM000007');
  if (loanWithApprovedRenewal) {
    renewals.push({
      loan: loanWithApprovedRenewal._id,
      book: loanWithApprovedRenewal.items[0].book,
      reader: loanWithApprovedRenewal.reader,
      currentDueDate: new Date(loanWithApprovedRenewal.items[0].borrowDate.getTime() + 14 * DAY),
      requestedDueDate: loanWithApprovedRenewal.items[0].dueDate,
      reason: 'Em cần thêm thời gian tổng hợp tài liệu.',
      status: 'approved',
      decidedBy: staff[0]._id,
      decidedAt: new Date(now - 3 * DAY),
    });
  }

  // 3. Rejected Renewal Request (reader11)
  const loanWithRejectedRenewal = insertedLoans.find((l) => l.code === 'PM000008');
  if (loanWithRejectedRenewal) {
    renewals.push({
      loan: loanWithRejectedRenewal._id,
      book: loanWithRejectedRenewal.items[0].book,
      reader: loanWithRejectedRenewal.reader,
      currentDueDate: loanWithRejectedRenewal.items[0].dueDate,
      requestedDueDate: new Date(loanWithRejectedRenewal.items[0].dueDate.getTime() + 7 * DAY),
      reason: 'Bận ôn thi chưa kịp đọc.',
      status: 'rejected',
      rejectReason: 'Sách đang có độc giả khác đặt trước trong hàng đợi.',
      decidedBy: staff[1]._id,
      decidedAt: new Date(now - 2 * DAY),
    });
  }

  if (renewals.length) {
    await RenewalRequest.insertMany(renewals);
  }

  console.log(`  → Đã tạo ${insertedLoans.length} phiếu mượn (PM000001 … PM000018) trải dài đủ các trạng thái:`);
  console.log(`    • 3 Chờ duyệt (pending), 2 Chờ nhận (approved), 4 Đang mượn (borrowing)`);
  console.log(`    • 3 Quá hạn (overdue), 4 Đã trả (returned), 1 Bị từ chối (rejected), 1 Đã hủy (cancelled)`);
  console.log(`  → Đã tạo ${renewals.length} yêu cầu gia hạn (1 pending, 1 approved, 1 rejected).`);

  return insertedLoans;
}

// ── 10. Seed Tiền Phạt (Fines) ───────────────────────────────────

async function seedFines(readers, loans, books, staff, admin) {
  console.log('\n📌 9. Seed Tiền phạt (Fines)...');
  const fines = [];
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // Lấy các phiếu mượn tương ứng
  const overdueLoan1 = loans.find((l) => l.code === 'PM000010'); // reader4
  const overdueLoan2 = loans.find((l) => l.code === 'PM000011'); // reader13
  const overdueLoan3 = loans.find((l) => l.code === 'PM000012'); // reader14
  const returnedLoan1 = loans.find((l) => l.code === 'PM000013'); // reader5
  const returnedLoan2 = loans.find((l) => l.code === 'PM000014'); // reader15

  // 1. Phạt trễ hạn chưa thu (unpaid) - reader 4
  fines.push({
    reader: readers[3]._id,
    loan: overdueLoan1?._id,
    book: overdueLoan1?.items[0]?.book,
    type: 'late',
    daysLate: 11,
    amount: 22000, // 11 ngày * 2.000đ
    reason: 'Trễ hạn trả sách 11 ngày (phiếu PM000010)',
    status: 'unpaid',
    recordedBy: staff[0]._id,
    createdAt: new Date(now - 1 * DAY),
  });

  // 2. Phạt làm hư hỏng sách chưa thu (unpaid) - reader 13
  fines.push({
    reader: readers[12]._id,
    loan: overdueLoan2?._id,
    book: overdueLoan2?.items[0]?.book,
    type: 'damaged',
    amount: 50000,
    reason: 'Làm rách gáy sách và ố bìa sau cuốn sách',
    status: 'unpaid',
    recordedBy: staff[1]._id,
    createdAt: new Date(now - 3 * DAY),
  });

  // 3. Phạt mất sách chưa thu (unpaid) - reader 14
  fines.push({
    reader: readers[13]._id,
    loan: overdueLoan3?._id,
    book: overdueLoan3?.items[0]?.book,
    type: 'lost',
    amount: 205000, // Giá sách 185.000đ + 20.000đ phí xử lý
    reason: 'Báo mất cuốn sách Clean Code: A Handbook of Agile Software Craftsmanship',
    status: 'unpaid',
    recordedBy: staff[0]._id,
    createdAt: new Date(now - 5 * DAY),
  });

  // 4. Phạt trễ hạn ĐÃ THU (paid) - reader 5
  fines.push({
    reader: readers[4]._id,
    loan: returnedLoan1?._id,
    book: returnedLoan1?.items[0]?.book,
    type: 'late',
    daysLate: 3,
    amount: 6000,
    reason: 'Trễ hạn 3 ngày khi trả sách',
    status: 'paid',
    recordedBy: staff[0]._id,
    paidAt: new Date(now - 2 * DAY),
    paidConfirmedBy: staff[0]._id,
    createdAt: new Date(now - 3 * DAY),
  });

  // 5. Phạt hư hỏng ĐÃ ĐƯỢC MIỄN (waived) - reader 15
  fines.push({
    reader: readers[14]._id,
    loan: returnedLoan2?._id,
    book: returnedLoan2?.items[0]?.book,
    type: 'damaged',
    amount: 30000,
    reason: 'Quăn mép sách do bảo quản lúc trời mưa',
    status: 'waived',
    recordedBy: staff[1]._id,
    waivedReason: 'Độc giả có hoàn cảnh khó khăn và thành thật nhận lỗi, sách chỉ bị nhẹ đã khắc phục được.',
    waivedAt: new Date(now - 1 * DAY),
    waivedBy: admin._id,
    createdAt: new Date(now - 4 * DAY),
  });

  await Fine.insertMany(fines);

  // Cập nhật trường unpaidFineTotal trên model User cho đồng bộ
  await User.findByIdAndUpdate(readers[3]._id, { unpaidFineTotal: 22000 });
  await User.findByIdAndUpdate(readers[12]._id, { unpaidFineTotal: 50000 });
  await User.findByIdAndUpdate(readers[13]._id, { unpaidFineTotal: 205000 });

  console.log(`  → Đã tạo ${fines.length} khoản tiền phạt:`);
  console.log(`    • 3 Chưa thanh toán (unpaid: trễ hạn, hư hỏng, mất sách)`);
  console.log(`    • 1 Đã thanh toán (paid)`);
  console.log(`    • 1 Đã miễn phạt (waived bởi admin)`);
  console.log(`  → Đã đồng bộ trường unpaidFineTotal cho các tài khoản độc giả liên quan.`);
}

// ── 11. Seed Đặt Trước Sách (Reservations) ───────────────────────

async function seedReservations(readers, books) {
  console.log('\n📌 10. Seed Đặt trước sách (Reservations)...');
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // Lấy các cuốn sách hết bản sao (availableCopies === 0)
  const zeroBooks = books.filter((b) => b.availableCopies === 0);
  const targetBook1 = zeroBooks[0] || books[0]; // Clean Code
  const targetBook2 = zeroBooks[1] || books[1]; // Mắt Biếc

  const reservations = [
    // 1-2: Hàng đợi đang chờ (waiting)
    {
      reader: readers[0]._id,
      book: targetBook1._id,
      status: 'waiting',
      createdAt: new Date(now - 4 * DAY),
    },
    {
      reader: readers[1]._id,
      book: targetBook1._id,
      status: 'waiting',
      createdAt: new Date(now - 2 * DAY),
    },

    // 3: Sách đã về, đang giữ cho độc giả (available - có holdUntil trong 3 ngày tới)
    {
      reader: readers[2]._id,
      book: targetBook2._id,
      status: 'available',
      notifiedAt: new Date(now - 1 * DAY),
      holdUntil: new Date(now + 2 * DAY),
      createdAt: new Date(now - 6 * DAY),
    },

    // 4: Đã nhận sách (fulfilled)
    {
      reader: readers[3]._id,
      book: targetBook2._id,
      status: 'fulfilled',
      notifiedAt: new Date(now - 10 * DAY),
      holdUntil: new Date(now - 7 * DAY),
      createdAt: new Date(now - 15 * DAY),
    },

    // 5: Hết hạn giữ sách (expired)
    {
      reader: readers[4]._id,
      book: targetBook1._id,
      status: 'expired',
      notifiedAt: new Date(now - 8 * DAY),
      holdUntil: new Date(now - 5 * DAY),
      createdAt: new Date(now - 12 * DAY),
    },

    // 6: Độc giả tự hủy đặt trước (cancelled)
    {
      reader: readers[5]._id,
      book: targetBook2._id,
      status: 'cancelled',
      createdAt: new Date(now - 3 * DAY),
    },
  ];

  await Reservation.insertMany(reservations);
  console.log(`  → Đã tạo ${reservations.length} lượt đặt trước (Reservations) với đầy đủ các trạng thái:`);
  console.log(`    • 2 Đang chờ (waiting - hàng đợi FIFO)`);
  console.log(`    • 1 Sẵn sàng nhận (available - giữ sách đến 2 ngày tới)`);
  console.log(`    • 1 Đã nhận (fulfilled), 1 Hết hạn giữ (expired), 1 Đã hủy (cancelled)`);
}

// ── 12. Seed Đánh Giá Sách (Reviews) ─────────────────────────────

async function seedReviews(readers, books, loans, staff) {
  console.log('\n📌 11. Seed Đánh giá sách (Reviews)...');

  // Lấy danh sách các cặp (reader, book) đã có lịch sử mượn (đảm bảo hàm canReview trả về true)
  const returnedOrBorrowingLoans = loans.filter((l) => ['returned', 'borrowing', 'overdue'].includes(l.status));
  const reviewPairs = [];

  for (const l of returnedOrBorrowingLoans) {
    for (const item of l.items) {
      reviewPairs.push({
        readerId: l.reader,
        bookId: item.book,
      });
    }
  }

  const sampleComments = [
    'Sách viết cực kỳ lôi cuốn, văn phong trong sáng và giàu tính nhân văn. Đọc một mạch không dứt ra được!',
    'Một tác phẩm kinh điển đáng đọc ít nhất một lần trong đời. Mở rộng tư duy và thay đổi góc nhìn hoàn toàn.',
    'Nội dung rất thực tế, ví dụ sinh động dễ hiểu, phù hợp cho cả người mới bắt đầu lẫn người có kinh nghiệm.',
    'Chất lượng in ấn tốt, bìa đẹp, kiến thức sâu sắc. Sẽ giới thiệu cho bạn bè cùng đọc.',
    'Rất ấn tượng với cách tác giả phân tích và dẫn dắt câu chuyện. Đọc xong cảm thấy được tiếp thêm nhiều động lực.',
    'Sách trình bày rõ ràng, mạch lạc, rất hữu ích cho công việc và học tập hàng ngày.',
    'Một góc nhìn hoàn toàn mới mẻ và độc đáo. Rất đáng đồng tiền bát gạo.',
  ];

  const reviews = [];
  const processedKeys = new Set();

  for (let i = 0; i < reviewPairs.length; i++) {
    const pair = reviewPairs[i];
    const key = `${pair.readerId}_${pair.bookId}`;
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const isHidden = i === 4; // 1 review bị ẩn để test quyền kiểm duyệt của nhân viên/admin
    const rating = faker.helpers.arrayElement([4, 5, 5, 4, 5]);

    reviews.push({
      reader: pair.readerId,
      book: pair.bookId,
      rating,
      comment: sampleComments[i % sampleComments.length],
      hidden: isHidden,
      hiddenBy: isHidden ? staff[0]._id : undefined,
    });
  }

  await Review.insertMany(reviews);

  // Tính toán lại ratingAvg và ratingCount chuẩn xác cho các sách được review
  const affectedBookIds = [...new Set(reviews.map((r) => r.book.toString()))];
  for (const bookId of affectedBookIds) {
    const [stats] = await Review.aggregate([
      { $match: { book: new (require('mongoose').Types.ObjectId)(bookId), hidden: { $ne: true } } },
      { $group: { _id: '$book', ratingAvg: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
    ]);
    if (stats) {
      await Book.findByIdAndUpdate(bookId, {
        ratingAvg: Number(stats.ratingAvg.toFixed(1)),
        ratingCount: stats.ratingCount,
      });
    }
  }

  console.log(`  → Đã tạo ${reviews.length} đánh giá sách từ các độc giả đã từng mượn.`);
  console.log(`    (Trong đó có 1 đánh giá có cờ 'hidden: true' để kiểm thử tính năng ẩn/hiện review)`);
  console.log(`  → Đã cập nhật lại ratingAvg và ratingCount cho ${affectedBookIds.length} cuốn sách.`);
}

// ── 13. Seed Diễn Đàn (Forum) ────────────────────────────────────

async function seedForum(users, books, staff) {
  console.log('\n📌 12. Seed Diễn đàn cộng đồng (Forum)...');
  const allUsers = [users.admin, ...users.staff, ...users.readers];
  const readers = users.readers;

  // 1. Chuyên mục diễn đàn
  const forumCategoriesData = [
    {
      name: 'Thảo luận chung',
      slug: 'thao-luan-chung',
      description: 'Nơi giao lưu, chia sẻ thông tin và trò chuyện tự do của cộng đồng độc giả thư viện.',
      order: 1,
    },
    {
      name: 'Gợi ý & Review sách',
      slug: 'goi-y-review-sach',
      description: 'Góc chia sẻ cảm nhận, giới thiệu những cuốn sách hay và đáng đọc nhất.',
      order: 2,
    },
    {
      name: 'Hỏi đáp & Hỗ trợ thư viện',
      slug: 'hoi-dap-ho-tro',
      description: 'Giải đáp thắc mắc về thủ tục mượn trả, thẻ thư viện và các dịch vụ trực tuyến.',
      order: 3,
    },
    {
      name: 'Câu lạc bộ Đọc sách',
      slug: 'clb-doc-sach',
      description: 'Không gian sinh hoạt, thảo luận theo chủ đề và sự kiện của các câu lạc bộ sách.',
      order: 4,
    },
  ];

  const categories = await ForumCategory.insertMany(forumCategoriesData);

  // 2. Chủ đề (Threads)
  const threadsData = [
    {
      category: categories[0]._id,
      author: users.admin._id,
      title: '[Ghim] Nội quy và Hướng dẫn sử dụng Diễn đàn Thư viện',
      slug: 'noi-quy-va-huong-dan-su-dung-dien-dan-thu-vien',
      content: 'Chào mừng các bạn đến với Diễn đàn Thư viện! Vui lòng giữ thái độ tôn trọng, không sử dụng từ ngữ thù địch, không đăng tải nội dung quảng cáo spam hoặc vi phạm bản quyền. Chúc các bạn có những giây phút thảo luận bổ ích!',
      pinned: true,
      locked: false,
      tags: ['nội quy', 'hướng dẫn', 'thông báo'],
      viewCount: 340,
      likeCount: 25,
      replyCount: 3,
      likes: [readers[0]._id, readers[1]._id, readers[2]._id],
      status: 'active',
    },
    {
      category: categories[1]._id,
      author: readers[0]._id,
      title: 'Cảm nhận sâu sắc sau khi đọc xong cuốn Sapiens: Lược Sử Loài Người',
      slug: 'cam-nhan-sau-khi-doc-xong-cuon-sapiens-luoc-su-loai-nguoi',
      content: 'Mình vừa hoàn thành cuốn Sapiens của Yuval Noah Harari. Thật sự choáng ngợp trước góc nhìn của tác giả về cuộc cách mạng nhận thức và cách loài người hợp tác thông qua những câu chuyện tưởng tượng chung. Mọi người tâm đắc nhất phần nào trong cuốn sách này?',
      book: books[30]?._id,
      pinned: false,
      locked: false,
      tags: ['sapiens', 'lịch sử', 'review', 'tri thức'],
      viewCount: 185,
      likeCount: 18,
      replyCount: 4,
      likes: [readers[1]._id, readers[2]._id, readers[3]._id],
      status: 'active',
    },
    {
      category: categories[1]._id,
      author: readers[1]._id,
      title: 'Lập trình viên mới ra trường nên đọc Clean Code hay Refactoring trước?',
      slug: 'lap-trinh-vien-moi-ra-truong-nen-doc-clean-code-hay-refactoring-truoc',
      content: 'Em đang là sinh viên năm cuối ngành CNTT, chuẩn bị đi thực tập. Thư viện mình có cả Clean Code và Refactoring của Martin Fowler. Các anh chị thủ thư và độc giả đi trước cho em xin lời khuyên nên đọc cuốn nào trước để dễ tiếp thu hơn ạ?',
      book: books[0]?._id,
      pinned: false,
      locked: false,
      tags: ['cntt', 'clean-code', 'lập trình', 'nghề nghiệp'],
      viewCount: 220,
      likeCount: 14,
      replyCount: 3,
      likes: [users.staff[0]._id, readers[4]._id],
      status: 'active',
    },
    {
      category: categories[2]._id,
      author: readers[2]._id,
      title: 'Hỏi về thời gian gia hạn mượn sách tối đa và cách thức gia hạn online',
      slug: 'hoi-ve-thoi-gian-gia-han-muon-sach-toi-da-va-cach-thuc-gia-han-online',
      content: 'Chào thủ thư, cho em hỏi mỗi cuốn sách được gia hạn tối đa mấy lần và trước hạn trả bao nhiêu ngày thì có thể bấm yêu cầu gia hạn trên website ạ?',
      pinned: false,
      locked: false,
      tags: ['gia hạn', 'thủ tục', 'hỏi đáp'],
      viewCount: 95,
      likeCount: 5,
      replyCount: 2,
      likes: [readers[5]._id],
      status: 'active',
    },
    {
      category: categories[0]._id,
      author: readers[19]._id, // Tài khoản độc giả bị khóa
      title: '[Spam] Bán tài liệu ôn thi và tài khoản học tập giá rẻ qua Zalo',
      slug: 'spam-ban-tai-lieu-on-thi-va-tai-khoan-hoc-tap-gia-re',
      content: 'Liên hệ Zalo 0999xxxxxx để nhận tài liệu ôn thi đại học và tài khoản xem phim VIP giá cực rẻ...',
      pinned: false,
      locked: true,
      tags: ['spam'],
      viewCount: 40,
      likeCount: 0,
      replyCount: 0,
      status: 'hidden', // Bài bị ẩn để kiểm duyệt
    },
  ];

  const threads = await ForumThread.insertMany(threadsData);

  // 3. Bài trả lời (Posts)
  const postsData = [
    // Replies for Thread 1 (Nội quy)
    {
      thread: threads[0]._id,
      author: readers[0]._id,
      content: 'Cảm ơn Ban Quản trị! Giao diện diễn đàn mới rất trực quan và tiện dụng ạ.',
      likeCount: 4,
      likes: [users.admin._id, readers[1]._id],
    },
    {
      thread: threads[0]._id,
      author: readers[1]._id,
      content: 'Mong diễn đàn sẽ là nơi kết nối nhiều bạn yêu sách hơn nữa!',
      likeCount: 2,
    },

    // Replies for Thread 2 (Sapiens review)
    {
      thread: threads[1]._id,
      author: readers[2]._id,
      content: 'Mình cực kỳ thích chương nói về Cuộc cách mạng Nông nghiệp. Tác giả gọi đó là "cú lừa lớn nhất lịch sử" làm mình giật mình luôn!',
      likeCount: 6,
      likes: [readers[0]._id, readers[1]._id],
    },
    {
      thread: threads[1]._id,
      author: users.staff[0]._id,
      content: 'Chào bạn! Thư viện hiện cũng có sẵn cuốn tiếp theo là "Homo Deus: Lược Sử Tương Lai" của cùng tác giả, nếu bạn hứng thú có thể đặt mượn nhé.',
      likeCount: 5,
    },

    // Replies for Thread 3 (Clean Code vs Refactoring)
    {
      thread: threads[2]._id,
      author: users.staff[1]._id,
      content: 'Khuyên bạn nên đọc Clean Code trước để nắm các quy chuẩn cơ bản về đặt tên biến, tách hàm nhỏ và viết code dễ hiểu. Sau đó khi đi làm đọc Refactoring sẽ thấm thía hơn rất nhiều!',
      likeCount: 8,
      likes: [readers[1]._id, readers[0]._id],
    },

    // Replies for Thread 4 (Hỏi đáp gia hạn)
    {
      thread: threads[3]._id,
      author: users.staff[0]._id,
      content: 'Chào bạn! Theo quy định hiện tại, mỗi cuốn sách bạn được gia hạn tối đa 2 lần, mỗi lần 7 ngày. Bạn có thể gửi yêu cầu trước ngày hết hạn từ 1-3 ngày trên trang "Phiếu mượn của tôi" nhé!',
      likeCount: 3,
    },
  ];

  const posts = await ForumPost.insertMany(postsData);

  // 4. Báo cáo vi phạm (ForumReport)
  const reportsData = [
    // 1 report đang chờ xử lý (open)
    {
      targetType: 'thread',
      targetId: threads[4]._id,
      reporter: readers[0]._id,
      reason: 'Bài viết quảng cáo bán hàng spam sai quy định diễn đàn.',
      status: 'open',
    },
    // 1 report đã xử lý (resolved)
    {
      targetType: 'thread',
      targetId: threads[4]._id,
      reporter: readers[1]._id,
      reason: 'Nội dung chứa số điện thoại spam lừa đảo.',
      status: 'resolved',
      handledBy: staff[0]._id,
    },
    // 1 report đã bác bỏ (dismissed)
    {
      targetType: 'post',
      targetId: posts[0]._id,
      reporter: readers[2]._id,
      reason: 'Nhầm lẫn nút báo cáo.',
      status: 'dismissed',
      handledBy: staff[1]._id,
    },
  ];

  await ForumReport.insertMany(reportsData);

  console.log(`  → Đã tạo ${categories.length} chuyên mục diễn đàn.`);
  console.log(`  → Đã tạo ${threads.length} chủ đề (gồm bài ghim, bài gắn sách, bài bị ẩn kiểm duyệt).`);
  console.log(`  → Đã tạo ${posts.length} bài thảo luận phản hồi.`);
  console.log(`  → Đã tạo ${reportsData.length} báo cáo vi phạm (1 open, 1 resolved, 1 dismissed) để kiểm thử trang kiểm duyệt.`);
}

// ── 14. Seed Thông Báo (Notifications) ───────────────────────────

async function seedNotifications(users, staff) {
  console.log('\n📌 13. Seed Thông báo (Notifications)...');
  const readers = users.readers;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const notificationsData = [
    // 1. Thông báo toàn hệ thống (audience: 'all')
    {
      audience: 'all',
      type: 'system',
      title: 'Chào mừng bạn đến với Hệ thống Thư viện Trực tuyến Mới!',
      content: 'Hệ thống đã nâng cấp toàn diện giao diện và bổ sung thêm các tính năng: Đặt trước sách, Kệ sách cá nhân và Diễn đàn độc giả.',
      createdAt: new Date(now - 10 * DAY),
    },
    {
      audience: 'all',
      type: 'system',
      title: 'Lịch hoạt động và phục vụ độc giả dịp cuối tuần',
      content: 'Thư viện mở cửa phục vụ mượn trả trực tiếp tại quầy từ 8h00 đến 17h30 các ngày từ Thứ Hai đến Thứ Bảy.',
      createdAt: new Date(now - 5 * DAY),
    },

    // 2. Thông báo dành riêng cho độc giả (audience: 'readers')
    {
      audience: 'readers',
      type: 'system',
      title: 'Bộ sưu tập sách Công nghệ thông tin và AI mới cập bến thư viện',
      content: 'Hơn 50 đầu sách mới về Lập trình Web, Vi dịch vụ và Trí tuệ nhân tạo đã có sẵn trên kệ. Mời bạn đặt mượn ngay hôm nay!',
      link: '/books?category=cong-nghe-thong-tin',
      createdAt: new Date(now - 3 * DAY),
    },

    // 3. Thông báo dành cho nhân viên (audience: 'staff')
    {
      audience: 'staff',
      type: 'system',
      title: 'Nhắc nhở ca trực: Kiểm tra các phiếu mượn chờ duyệt và đối soát sách quá hạn',
      content: 'Vui lòng kiểm tra mục Quản lý Mượn sách và xử lý các yêu cầu gia hạn còn tồn đọng trước 17h00.',
      link: '/admin/loans',
      createdAt: new Date(now - 1 * DAY),
    },

    // 4. Thông báo cá nhân độc giả (audience: 'user')
    // Reader 1: Phiếu mượn đang chờ duyệt
    {
      recipient: readers[0]._id,
      audience: 'user',
      type: 'loan',
      title: 'Phiếu mượn PM000001 đang được xử lý',
      content: 'Yêu cầu mượn 2 cuốn sách của bạn đã được ghi nhận và đang chờ thủ thư xét duyệt.',
      link: '/me/loans',
      createdAt: new Date(now - 1 * DAY),
    },
    // Reader 2: Phiếu mượn đã được duyệt - mời đến nhận
    {
      recipient: readers[1]._id,
      audience: 'user',
      type: 'loan',
      title: 'Phiếu mượn PM000004 đã được duyệt!',
      content: 'Thủ thư đã duyệt phiếu mượn của bạn. Vui lòng đến quầy thư viện nhận sách trước ngày hẹn.',
      link: '/me/loans',
      createdAt: new Date(now - 1 * DAY),
    },
    // Reader 3: Yêu cầu gia hạn
    {
      recipient: readers[2]._id,
      audience: 'user',
      type: 'renewal',
      title: 'Yêu cầu gia hạn sách đã được gửi',
      content: 'Yêu cầu gia hạn thêm 7 ngày cho cuốn sách của bạn đang được nhân viên xem xét.',
      link: '/me/renewals',
      createdAt: new Date(now - 0.5 * DAY),
    },
    // Reader 4: Cảnh báo quá hạn và phạt
    {
      recipient: readers[3]._id,
      audience: 'user',
      type: 'overdue',
      title: 'Cảnh báo sách quá hạn mượn',
      content: 'Cuốn sách thuộc phiếu mượn PM000010 đã quá hạn 11 ngày. Vui lòng hoàn trả sớm để tránh tăng thêm tiền phạt.',
      link: '/me/loans',
      createdAt: new Date(now - 2 * DAY),
    },
    {
      recipient: readers[3]._id,
      audience: 'user',
      type: 'fine',
      title: 'Phát sinh khoản tiền phạt 22.000 VNĐ',
      content: 'Bạn có khoản tiền phạt trễ hạn 22.000đ cần thanh toán khi trả sách tại quầy.',
      link: '/me/fines',
      createdAt: new Date(now - 1 * DAY),
    },
    // Reader 3: Sách đặt trước đã có sẵn
    {
      recipient: readers[2]._id,
      audience: 'user',
      type: 'reservation',
      title: 'Sách bạn đặt trước đã có sẵn tại thư viện!',
      content: 'Cuốn sách bạn chờ đợi đã được người khác trả về. Thư viện giữ sách cho bạn trong vòng 3 ngày tới.',
      link: '/me/reservations',
      createdAt: new Date(now - 1 * DAY),
    },
  ];

  const insertedNotifs = await Notification.insertMany(notificationsData);

  // Đánh dấu một số thông báo đã đọc (NotificationRead) cho reader 1 để kiểm thử unread count
  await NotificationRead.create({
    user: readers[0]._id,
    notification: insertedNotifs[0]._id, // Đã đọc thông báo hệ thống
    readAt: new Date(),
  });

  console.log(`  → Đã tạo ${insertedNotifs.length} thông báo (hệ thống, độc giả, nhân viên, cá nhân).`);
  console.log(`  → Đã thiết lập trạng thái đã đọc mẫu để kiểm thử số đếm unread count.`);
}

// ── 15. Seed Nhật Ký Kiểm Toán (AuditLogs) ───────────────────────

async function seedAuditLogs(users, staff) {
  console.log('\n📌 14. Seed Nhật ký kiểm toán (AuditLogs)...');
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const logsData = [
    {
      actor: users.admin._id,
      action: 'SETTINGS_UPDATE',
      targetType: 'Setting',
      detail: { note: 'Cập nhật thời hạn mượn tối đa và phí phạt trễ hạn' },
      ip: '127.0.0.1',
      createdAt: new Date(now - 15 * DAY),
    },
    {
      actor: users.admin._id,
      action: 'USER_ROLE_CHANGE',
      targetType: 'User',
      targetId: staff[0]._id,
      detail: { role: 'staff', previousRole: 'reader' },
      ip: '127.0.0.1',
      createdAt: new Date(now - 20 * DAY),
    },
    {
      actor: staff[0]._id,
      action: 'BOOK_CREATE',
      targetType: 'Book',
      detail: { title: 'Lập Trình Web Hiện Đại Với Node.js & MERN Stack' },
      ip: '192.168.1.15',
      createdAt: new Date(now - 10 * DAY),
    },
    {
      actor: staff[0]._id,
      action: 'LOAN_APPROVE',
      targetType: 'Loan',
      detail: { code: 'PM000004' },
      ip: '192.168.1.15',
      createdAt: new Date(now - 1.5 * DAY),
    },
    {
      actor: staff[1]._id,
      action: 'LOAN_HANDOVER',
      targetType: 'Loan',
      detail: { code: 'PM000006' },
      ip: '192.168.1.20',
      createdAt: new Date(now - 5 * DAY),
    },
    {
      actor: staff[0]._id,
      action: 'LOAN_RETURN',
      targetType: 'Loan',
      detail: { code: 'PM000013', condition: 'good' },
      ip: '192.168.1.15',
      createdAt: new Date(now - 6 * DAY),
    },
    {
      actor: staff[0]._id,
      action: 'FINE_COLLECT',
      targetType: 'Fine',
      detail: { amount: 6000, type: 'late', reader: users.readers[4].code },
      ip: '192.168.1.15',
      createdAt: new Date(now - 2 * DAY),
    },
    {
      actor: users.admin._id,
      action: 'FINE_WAIVE',
      targetType: 'Fine',
      detail: { amount: 30000, reason: 'Miễn giảm cho độc giả có hoàn cảnh khó khăn' },
      ip: '127.0.0.1',
      createdAt: new Date(now - 1 * DAY),
    },
    {
      actor: staff[0]._id,
      action: 'USER_LOCK',
      targetType: 'User',
      targetId: users.readers[19]._id,
      detail: { reason: 'Tài khoản tạm khóa do quá hạn trả sách nhiều lần' },
      ip: '192.168.1.15',
      createdAt: new Date(now - 0.5 * DAY),
    },
  ];

  await AuditLog.insertMany(logsData);
  console.log(`  → Đã tạo ${logsData.length} bản ghi nhật ký kiểm toán (AuditLogs) phục vụ trang quản trị.`);
}

// ── 16. In Thống Kê Tổng Quan & Hướng Dẫn Kiểm Thử ─────────────

async function printStatistics() {
  const [
    userCount,
    catCount,
    authorCount,
    pubCount,
    bookCount,
    shelfCount,
    cartCount,
    loanCount,
    renewalCount,
    fineCount,
    resCount,
    reviewCount,
    fCatCount,
    fThreadCount,
    fPostCount,
    notifCount,
    auditCount,
  ] = await Promise.all([
    User.countDocuments(),
    Category.countDocuments(),
    Author.countDocuments(),
    Publisher.countDocuments(),
    Book.countDocuments(),
    Shelf.countDocuments(),
    Cart.countDocuments(),
    Loan.countDocuments(),
    RenewalRequest.countDocuments(),
    Fine.countDocuments(),
    Reservation.countDocuments(),
    Review.countDocuments(),
    ForumCategory.countDocuments(),
    ForumThread.countDocuments(),
    ForumPost.countDocuments(),
    Notification.countDocuments(),
    AuditLog.countDocuments(),
  ]);

  console.log('\n===============================================================');
  console.log('📊 THỐNG KÊ DỮ LIỆU SEED CHO HỆ THỐNG QUẢN LÝ MƯỢN SÁCH');
  console.log('===============================================================');
  console.log(`  • Người dùng (Users):            ${userCount} (1 Admin, 2 Staff, 20 Readers)`);
  console.log(`  • Danh mục (Categories):         ${catCount}`);
  console.log(`  • Tác giả (Authors):             ${authorCount}`);
  console.log(`  • Nhà xuất bản (Publishers):     ${pubCount}`);
  console.log(`  • Đầu sách (Books):              ${bookCount} (có sách hết hàng, sách ẩn, bìa đẹp)`);
  console.log(`  • Kệ sách (Shelves):             ${shelfCount} (kệ mặc định & kệ tự tạo)`);
  console.log(`  • Giỏ sách (Carts):              ${cartCount}`);
  console.log(`  • Phiếu mượn (Loans):            ${loanCount} (đủ các trạng thái nghiệp vụ)`);
  console.log(`  • Yêu cầu gia hạn (Renewals):    ${renewalCount}`);
  console.log(`  • Khoản tiền phạt (Fines):       ${fineCount} (unpaid, paid, waived)`);
  console.log(`  • Đặt trước sách (Reservations): ${resCount} (waiting, available, fulfilled, expired)`);
  console.log(`  • Đánh giá sách (Reviews):       ${reviewCount} (đồng bộ điểm đánh giá)`);
  console.log(`  • Chuyên mục diễn đàn:          ${fCatCount}`);
  console.log(`  • Chủ đề diễn đàn (Threads):     ${fThreadCount}`);
  console.log(`  • Bài trả lời diễn đàn (Posts):  ${fPostCount}`);
  console.log(`  • Thông báo (Notifications):     ${notifCount}`);
  console.log(`  • Nhật ký kiểm toán (AuditLogs): ${auditCount}`);
  console.log('===============================================================\n');

  console.log('🔑 THÔNG TIN TÀI KHOẢN ĐỂ KIỂM THỬ GIAO DIỆN FRONTEND:');
  console.log('---------------------------------------------------------------');
  console.log(`  1. Quản trị viên (Admin):`);
  console.log(`     • Email:    admin1@seed.library.local`);
  console.log(`     • Password: ${SEED_PASSWORD}`);
  console.log(`     • Quyền:    Toàn quyền hệ thống, xem dashboard, quản lý users, settings, audit-logs, miễn phạt`);
  console.log(`\n  2. Nhân viên (Staff):`);
  console.log(`     • Email:    staff1@seed.library.local (hoặc staff2@seed.library.local)`);
  console.log(`     • Password: ${SEED_PASSWORD}`);
  console.log(`     • Quyền:    Duyệt/từ chối mượn, giao sách, trả sách, duyệt gia hạn, thu phạt, kiểm duyệt diễn đàn`);
  console.log(`\n  3. Độc giả tiêu biểu (Readers):`);
  console.log(`     • reader1@seed.library.local : Có phiếu mượn pending (PM000001), có giỏ sách, có kệ custom, có đặt trước waiting`);
  console.log(`     • reader2@seed.library.local : Có phiếu mượn approved (chờ lấy), có giỏ sách, có đặt trước waiting`);
  console.log(`     • reader3@seed.library.local : Có phiếu đang mượn (borrowing), có yêu cầu gia hạn pending, có đặt trước available`);
  console.log(`     • reader4@seed.library.local : Có phiếu quá hạn (overdue), có tiền phạt chưa trả 22.000đ`);
  console.log(`     • reader5@seed.library.local : Có phiếu đã trả, có tiền phạt đã thanh toán`);
  console.log(`     • reader20@seed.library.local: Tài khoản bị KHÓA (locked) để kiểm thử màn hình đăng nhập báo lỗi`);
  console.log(`     • Mật khẩu cho MỌI độc giả: ${SEED_PASSWORD}`);
  console.log('---------------------------------------------------------------\n');
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  if (config.env === 'production') {
    console.error('❌ KHÔNG được chạy script seed trên môi trường production!');
    process.exit(1);
  }

  console.log(`🔧 Môi trường: ${config.env}`);
  console.log(`🔗 Database  : ${config.mongodbUri}\n`);

  await MongoDB.connect();

  try {
    await cleanSeedData();

    await seedSettings();
    const users = await seedUsers();
    const categories = await seedCategories();
    const authors = await seedAuthors();
    const publishers = await seedPublishers();
    const books = await seedBooks(categories, authors, publishers);

    await seedShelvesAndCarts(users.readers, books);
    const loans = await seedLoansAndRenewals(users.readers, books, users.staff, users.admin);
    await seedFines(users.readers, loans, books, users.staff, users.admin);
    await seedReservations(users.readers, books);
    await seedReviews(users.readers, books, loans, users.staff);
    await seedForum(users, books, users.staff);
    await seedNotifications(users, users.staff);
    await seedAuditLogs(users, users.staff);

    await printStatistics();

    console.log('🎉 Toàn bộ quá trình Seed dữ liệu hoàn chỉnh đã THÀNH CÔNG RỰC RỠ!\n');
  } finally {
    await MongoDB.disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
