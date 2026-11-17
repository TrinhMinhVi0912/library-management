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
  {
    name: 'Eric Ries',
    bio: 'Doanh nhân và tác giả người Mỹ, người khởi xướng phong trào Khởi nghiệp Tinh gọn (Lean Startup).',
  },
  {
    name: 'W. Chan Kim',
    bio: 'Giáo sư chiến lược và quản trị tại trường kinh doanh INSEAD, đồng tác giả Chiến lược Đại dương xanh.',
  },
  {
    name: 'Renée Mauborgne',
    bio: 'Giáo sư chiến lược tại INSEAD, đồng tác giả cuốn sách quản trị kinh điển Chiến lược Đại dương xanh.',
  },
  {
    name: 'Jim Collins',
    bio: 'Nhà nghiên cứu và tác giả chuyên sâu về quản trị doanh nghiệp, tác giả cuốn Từ tốt đến vĩ đại.',
  },
  {
    name: 'Morgan Housel',
    bio: 'Tác giả và chuyên gia phân tích tài chính hành vi, nổi tiếng với cuốn Tâm lý học về tiền.',
  },
  {
    name: 'Stephen Hawking',
    bio: 'Nhà vật lý lý thuyết và vũ trụ học lừng danh người Anh, tác giả Lược sử thời gian.',
  },
  {
    name: 'Matthew Walker',
    bio: 'Giáo sư khoa học thần kinh và tâm lý học tại UC Berkeley, chuyên gia nghiên cứu về giấc ngủ.',
  },
  {
    name: 'Antoine de Saint-Exupéry',
    bio: 'Nhà văn và phi công người Pháp, tác giả kiệt tác văn học thiếu nhi và triết lý Hoàng tử bé.',
  },
  {
    name: 'Edmondo De Amicis',
    bio: 'Nhà văn, nhà báo người Ý nổi tiếng với tác phẩm giáo dục kinh điển Những tấm lòng cao cả.',
  },
  {
    name: 'Rolf Dobelli',
    bio: 'Nhà văn và doanh nhân người Thụy Sĩ chuyên viết về các thiên kiến nhận thức và tư duy phản biện.',
  },
  {
    name: 'Martin Kleppmann',
    bio: 'Nhà nghiên cứu hệ thống phân tán và tác giả cuốn Designing Data-Intensive Applications.',
  },
  {
    name: 'Aditya Bhargava',
    bio: 'Kỹ sư phần mềm và họa sĩ minh họa, tác giả cuốn Grokking Algorithms giúp tiếp cận thuật toán trực quan.',
  },
  {
    name: 'Andrew Hunt',
    bio: 'Kỹ sư phần mềm, đồng sáng lập Tuyên ngôn Agile và đồng tác giả The Pragmatic Programmer.',
  },
  {
    name: 'David Thomas',
    bio: 'Lập trình viên và tác giả chuyên sâu về kỹ thuật phần mềm, đồng tác giả The Pragmatic Programmer.',
  },
  {
    name: 'Marijn Haverbeke',
    bio: 'Lập trình viên và tác giả người Hà Lan, người viết cuốn Eloquent JavaScript nổi tiếng.',
  },
  {
    name: 'Ian Goodfellow',
    bio: 'Nhà nghiên cứu trí tuệ nhân tạo hàng đầu, người phát minh GAN và đồng tác giả giáo trình Deep Learning.',
  },
  {
    name: 'Ngô Tất Tố',
    bio: 'Nhà văn, nhà báo hiện thực xuất sắc của văn học Việt Nam trước 1945, tác giả tiểu thuyết Tắt đèn.',
  },
  {
    name: 'Kim Lân',
    bio: 'Nhà văn Việt Nam chuyên viết truyện ngắn sâu sắc về đời sống và tâm hồn người nông dân vùng đồng bằng Bắc Bộ.',
  },
  {
    name: 'Đoàn Giỏi',
    bio: 'Nhà văn Nam Bộ nổi tiếng với tác phẩm Đất rừng phương Nam giàu màu sắc thiên nhiên và lịch sử.',
  },
  {
    name: 'Bảo Ninh',
    bio: 'Nhà văn Việt Nam với tác phẩm Nỗi buồn chiến tranh phản ánh sâu sắc thân phận con người thời hậu chiến.',
  },
  {
    name: 'Phùng Quán',
    bio: 'Nhà văn, nhà thơ Việt Nam, tác giả bộ tiểu thuyết thiếu nhi cách mạng Tuổi thơ dữ dội.',
  },
  {
    name: 'Nguyễn Ngọc Tư',
    bio: 'Nhà văn nữ nổi bật của miền Tây Nam Bộ với giọng văn mộc mạc, giàu chất thơ và nỗi niềm thân phận.',
  },
  {
    name: 'Ernest Hemingway',
    bio: 'Nhà văn Mỹ đoạt giải Nobel Văn học năm 1954, nổi tiếng với lối viết súc tích theo nguyên lý tảng băng trôi.',
  },
  {
    name: 'Harper Lee',
    bio: 'Nữ văn sĩ người Mỹ đoạt giải Pulitzer với tiểu thuyết kinh điển Giết con chim nhại.',
  },
  {
    name: 'Gabriel García Márquez',
    bio: 'Nhà văn Colombia đoạt giải Nobel Văn học năm 1982, bậc thầy của chủ nghĩa hiện thực huyền ảo.',
  },
  {
    name: 'Fyodor Dostoevsky',
    bio: 'Đại văn hào Nga thế kỷ XIX nổi tiếng với các tiểu thuyết tâm lý và triết học sâu sắc.',
  },
  {
    name: 'J. D. Salinger',
    bio: 'Nhà văn Mỹ nổi tiếng với tiểu thuyết Bắt trẻ đồng xanh khắc họa tâm lý tuổi mới lớn.',
  },
  {
    name: 'Mario Puzo',
    bio: 'Nhà văn và nhà biên kịch người Mỹ nổi tiếng nhất với tiểu thuyết Bố già (The Godfather).',
  },
  {
    name: 'Robert T. Kiyosaki',
    bio: 'Doanh nhân và tác giả người Mỹ gốc Nhật nổi tiếng với bộ sách giáo dục tài chính Cha giàu cha nghèo.',
  },
  {
    name: 'Peter Thiel',
    bio: 'Doanh nhân công nghệ, đồng sáng lập PayPal và nhà đầu tư mạo hiểm, tác giả cuốn Zero to One.',
  },
  {
    name: 'Viktor E. Frankl',
    bio: 'Bác sĩ tâm thần học và nhà thần kinh học người Áo, người sáng lập liệu pháp ý nghĩa (Logotherapy).',
  },
  {
    name: 'Eckhart Tolle',
    bio: 'Tác giả và diễn giả tâm linh người Đức nổi tiếng với cuốn Sức mạnh của hiện tại.',
  },
  {
    name: 'Trần Trọng Kim',
    bio: 'Nhà sử học, nhà giáo dục Việt Nam, tác giả bộ Việt Nam sử lược viết bằng chữ Quốc ngữ.',
  },
  {
    name: 'Jared Diamond',
    bio: 'Giáo sư địa lý và sinh lý học người Mỹ, tác giả cuốn Súng, vi trùng và thép đoạt giải Pulitzer.',
  },
  {
    name: 'Jostein Gaarder',
    bio: 'Nhà văn và giáo sư triết học người Na Uy, tác giả tiểu thuyết triết học Thế giới của Sophie.',
  },
  {
    name: 'Carl Sagan',
    bio: 'Nhà thiên văn học, vật lý thiên văn và tác giả khoa học đại chúng lừng danh người Mỹ.',
  },
  {
    name: 'Siddhartha Mukherjee',
    bio: 'Bác sĩ chuyên khoa ung thư và tác giả khoa học đoạt giải Pulitzer người Mỹ gốc Ấn.',
  },
  {
    name: 'Hector Malot',
    bio: 'Nhà văn Pháp thế kỷ XIX nổi tiếng toàn thế giới với tiểu thuyết thiếu nhi Không gia đình.',
  },
  {
    name: 'Roald Dahl',
    bio: 'Nhà văn người Anh gốc Na Uy nổi tiếng với nhiều truyện thiếu nhi giàu trí tưởng tượng và hài hước.',
  },
  {
    name: 'Don Norman',
    bio: 'Nhà nghiên cứu thiết kế, khoa học nhận thức và kỹ thuật khả dụng, người đặt nền móng cho lĩnh vực UX.',
  },
  {
    name: 'E. H. Gombrich',
    bio: 'Nhà sử học nghệ thuật người Áo - Anh, tác giả cuốn Câu chuyện nghệ thuật phổ biến toàn cầu.',
  },
  {
    name: 'Austin Kleon',
    bio: 'Tác giả và nghệ sĩ người Mỹ chuyên viết về sáng tạo nghệ thuật trong kỷ nguyên số.',
  },
  {
    name: 'Raymond Murphy',
    bio: 'Tác giả sách giảng dạy tiếng Anh người Ireland, người biên soạn bộ ngữ pháp English Grammar in Use.',
  },
  {
    name: 'Pauline Cullen',
    bio: 'Chuyên gia khảo thí và tác giả nhiều tài liệu luyện thi IELTS chính thức của Cambridge.',
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
    description:
      'Cuốn sách hướng dẫn các nguyên tắc và thực hành viết mã nguồn sạch trong phát triển phần mềm linh hoạt (Agile). Tác giả phân tích cách đặt tên biến, tách hàm nhỏ gọn, xử lý ngoại lệ, viết kiểm thử đơn vị (unit test) và nhận diện các dấu hiệu mã xấu (code smells) qua nhiều ví dụ tái cấu trúc mã Java cụ thể. Sách xoay quanh các chủ đề về chất lượng mã nguồn, lập trình hướng đối tượng, bảo trì phần mềm và kỹ nghệ phần mềm. Phù hợp với lập trình viên, kỹ sư phần mềm và sinh viên ngành công nghệ thông tin muốn nâng cao kỹ năng viết code.',
  },
  {
    title: 'The Clean Coder: A Code of Conduct for Professional Programmers',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2011,
    price: 165000,
    pages: 256,
    description:
      'Tác phẩm bàn về thái độ làm việc, kỷ luật và quy tắc ứng xử nghề nghiệp của một kỹ sư phần mềm chuyên nghiệp. Thông qua các tình huống thực tế, tác giả đề cập đến kỹ năng ước lượng tiến độ, biết cách nói không với yêu cầu phi lý, làm việc nhóm, quản lý thời gian và thực hành phát triển hướng kiểm thử (TDD). Sách tập trung vào chủ đề đạo đức nghề nghiệp, giao tiếp kỹ thuật và tác phong làm việc trong ngành công nghệ phần mềm. Dành cho lập trình viên chuyên nghiệp, trưởng nhóm kỹ thuật và người chuẩn bị bước vào môi trường làm việc phần mềm.',
  },
  {
    title: 'Clean Architecture: A Craftsman Guide to Software Structure',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2017,
    price: 195000,
    pages: 432,
    description:
      'Cuốn sách trình bày các nguyên lý nền tảng về thiết kế và tổ chức cấu trúc hệ thống phần mềm bền vững theo thời gian. Tác giả giải thích các mô hình lập trình, nguyên lý SOLID, cách phân chia thành phần (component), ranh giới kiến trúc và quy tắc phụ thuộc để tách biệt nghiệp vụ cốt lõi khỏi cơ sở dữ liệu hay giao diện. Nội dung gắn với chủ đề kiến trúc phần mềm, thiết kế hệ thống, module hóa và khả năng mở rộng ứng dụng. Phù hợp với kiến trúc sư phần mềm, kỹ sư phần mềm có kinh nghiệm và người thiết kế hệ thống.',
  },
  {
    title: 'Refactoring: Improving the Design of Existing Code',
    authorNames: ['Martin Fowler'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2018,
    price: 210000,
    pages: 448,
    description:
      'Tác phẩm giới thiệu có hệ thống các kỹ thuật tái cấu trúc mã nguồn nhằm cải thiện thiết kế bên trong của chương trình mà không làm thay đổi hành vi bên ngoài. Sách trình bày danh mục các phép tái cấu trúc phổ biến như tách hàm, gom lớp, đơn giản hóa câu điều kiện, kết hợp với bộ kiểm thử tự động để đảm bảo an toàn khi sửa đổi mã JavaScript. Chủ đề chính gồm cải tiến mã nguồn cũ (legacy code), nâng cao khả năng đọc hiểu và bảo trì phần mềm. Phù hợp cho lập trình viên và kỹ sư phần mềm làm việc với các dự án đang vận hành.',
  },
  {
    title: 'Patterns of Enterprise Application Architecture',
    authorNames: ['Martin Fowler'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2002,
    price: 230000,
    pages: 560,
    description:
      'Cuốn sách tổng hợp hơn 40 mẫu thiết kế kiến trúc thường gặp khi xây dựng các ứng dụng doanh nghiệp quy mô lớn. Tác giả phân tích cách tổ chức tầng nghiệp vụ (Domain Model, Transaction Script), tầng truy cập dữ liệu (Data Mapper, Active Record), xử lý đồng thời và giao diện web. Sách đề cập đến các chủ đề kiến trúc ứng dụng doanh nghiệp, mẫu thiết kế (design patterns), ánh xạ đối tượng - quan hệ (ORM) và thiết kế phân tầng. Thích hợp cho kiến trúc sư phần mềm và kỹ sư phát triển hệ thống backend.',
  },
  {
    title: 'Clean Agile: Back to Basics',
    authorNames: ['Robert C. Martin'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2019,
    price: 150000,
    pages: 240,
    description:
      'Tác phẩm nhìn lại những giá trị cốt lõi ban đầu của Tuyên ngôn Agile sau nhiều năm bị hiểu sai trong thực tế triển khai. Tác giả phân tích vai trò của các vòng lặp ngắn, lập kế hoạch phát hành, thực hành kỹ thuật như lập trình cặp (pair programming), phát triển hướng kiểm thử và phản hồi liên tục giữa đội ngũ kỹ thuật với khách hàng. Chủ đề xoay quanh phương pháp phát triển phần mềm linh hoạt, quản lý dự án phần mềm và quy trình Agile. Phù hợp với lập trình viên, Scrum Master, quản lý dự án và thành viên đội ngũ sản phẩm.',
  },

  // 7-13: Nguyễn Nhật Ánh
  {
    title: 'Mắt Biếc',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1990,
    price: 110000,
    pages: 300,
    description:
      'Tiểu thuyết kể về mối tình đơn phương kéo dài từ thuở thơ ấu đến khi trưởng thành của chàng trai làng Đo Đo tên Ngạn dành cho cô bạn gái có đôi mắt biếc tên Hà Lan. Khi lớn lên ra thành phố học, Hà Lan bị cuốn vào lối sống phồn hoa và chịu nhiều tổn thương, trong khi Ngạn vẫn thủy chung với ký ức làng quê và tình cảm thầm lặng. Tác phẩm mang các chủ đề về tình yêu đơn phương, sự chia ly, nỗi hoài niệm tuổi thơ và sự đối lập giữa nông thôn yên bình với đô thị. Phù hợp với độc giả yêu thích văn học lãng mạn, truyện tuổi trẻ và văn xuôi Việt Nam hiện đại.',
  },
  {
    title: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2008,
    price: 95000,
    pages: 216,
    description:
      'Tác phẩm là dòng hồi ức xen lẫn suy ngẫm hóm hỉnh của nhân vật chính tên Mùi cùng nhóm bạn Tủn, Tí sún và Hải cò về những trò nghịch ngợm thời tiểu học. Qua những tình huống trẻ thơ hồn nhiên như mở phiên tòa xét xử người lớn hay đặt tên mới cho mọi đồ vật, câu chuyện gợi mở khoảng cách giữa thế giới trẻ em và quy chuẩn của người trưởng thành. Sách xoay quanh chủ đề ký ức tuổi thơ, tình bạn hồn nhiên và góc nhìn trong trẻo về cuộc sống. Phù hợp với cả thiếu nhi lẫn người lớn muốn tìm lại cảm xúc tuổi nhỏ.',
  },
  {
    title: 'Cô Gái Đến Từ Hôm Qua',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1989,
    price: 85000,
    pages: 204,
    description:
      'Truyện dài xoay quanh cậu học trò Thư luôn tìm cách chinh phục cô bạn cùng lớp xinh đẹp và lạnh lùng tên Việt An, đan xen với những mảnh ký ức thuở nhỏ của Thư cùng cô bé hàng xóm Tiểu Li. Qua những tình huống dở khóc dở cười cùng quân sư Hải gầy, bí mật về sợi dây gắn kết giữa quá khứ và hiện tại dần hé lộ. Tác phẩm nổi bật với chủ đề tình cảm học trò, rung động đầu đời, tình bạn tuổi học đường và sự gắn bó của ký ức. Phù hợp với học sinh, sinh viên và độc giả yêu thích truyện tình cảm nhẹ nhàng.',
  },
  {
    title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2010,
    price: 125000,
    pages: 378,
    description:
      'Câu chuyện được kể qua cuốn nhật ký của cậu bé Thiều sống ở một làng quê nghèo ven biển miền Trung những năm cuối thập niên 1980, bên cạnh cậu em trai hiền lành tên Tường và cô bạn hàng xóm Mận. Giữa những trò chơi dân dã, nỗi sợ ma, cơn đói mùa mất mùa và những lỗi lầm tuổi mới lớn, Thiều dần hiểu giá trị của tình anh em và sự bao dung. Tác phẩm khai thác chủ đề tình cảm gia đình, tuổi thơ miền quê, tình bạn và sự trưởng thành. Phù hợp với độc giả tuổi thiếu niên và người yêu văn học Việt Nam giàu cảm xúc.',
  },
  {
    title: 'Ngồi Khóc Trên Cây',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2013,
    price: 105000,
    pages: 348,
    description:
      'Tiểu thuyết kể về cuộc gặp gỡ giữa Đông, chàng sinh viên từ thành phố về thăm bà ngoại ở vùng quê Quảng Nam, và Rùa, cô bé mười bốn tuổi mồ côi sống lặng lẽ giữa thiên nhiên hoang sơ. Giữa bối cảnh núi rừng và những biến cố bất ngờ về gia đình, tình cảm trong sáng giữa hai người dần nảy nở nhưng phải đối mặt với nhiều thử thách và chia xa. Sách mang chủ đề tình yêu trong trẻo, tình người nơi thôn dã, nỗi mất mát và lòng vị tha. Thích hợp cho bạn đọc trẻ và người yêu thích tiểu thuyết tình cảm trữ tình.',
  },
  {
    title: 'Lá Nằm Trong Sương',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2002,
    price: 78000,
    pages: 180,
    description:
      'Tác phẩm khắc họa đời sống học đường của nhóm học sinh trung học với những rung động mơ hồ, tình bạn chân thành và những kỷ niệm khó quên dưới mái trường xưa. Câu chuyện tái hiện tâm trạng bâng khuâng của tuổi mới lớn trước những ngã rẽ đầu đời và sự chia tay khi năm học khép lại. Chủ đề chính xoay quanh tuổi học trò, kỷ niệm trường lớp và tình bạn trong sáng. Phù hợp với lứa tuổi học sinh và độc giả yêu thích phong cách văn học hoài niệm.',
  },
  {
    title: 'Cây Chuối Non Đi Giày Xanh',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2017,
    price: 110000,
    pages: 304,
    description:
      'Cuốn truyện theo chân nhân vật Đăng hồi tưởng lại tuổi thơ tại thị trấn Hà Lam cùng cô bạn thân nhỏ Thắm và chú tiểu Khôi. Trước những biến cố của gia đình và những định kiến trong xóm nhỏ, tình bạn gắn bó giữa những đứa trẻ trở thành điểm tựa giúp chúng vượt qua nỗi sợ hãi và tổn thương. Sách đề cập đến chủ đề tình bạn, tình làng nghĩa xóm, ký ức tuổi thơ và lòng nhân hậu. Phù hợp với thanh thiếu niên và độc giả yêu thích truyện đồng quê.',
  },

  // 14-17: Nam Cao, Tô Hoài, Vũ Trọng Phụng, Nguyễn Du
  {
    title: 'Chí Phèo',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1941,
    price: 65000,
    pages: 160,
    description:
      'Tập truyện ngắn tiêu biểu với tác phẩm trung tâm kể về cuộc đời bi kịch của Chí Phèo tại làng Vũ Đại, từ một anh canh điền lương thiện bị Bá Kiến đẩy vào tù rồi tha hóa thành kẻ rạch mặt ăn vạ. Cuộc gặp gỡ với Thị Nở và bát cháo hành đánh thức khát vọng hoàn lương trong Chí, nhưng định kiến xã hội lại dập tắt con đường trở về làm người lương thiện. Tác phẩm phản ánh chủ đề hiện thực phê phán, số phận người nông dân trước năm 1945, sự tha hóa và bi kịch bị cự tuyệt quyền làm người. Phù hợp với học sinh, sinh viên và độc giả nghiên cứu văn học Việt Nam.',
  },
  {
    title: 'Dế Mèn Phiêu Lưu Ký',
    authorNames: ['Tô Hoài'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1941,
    price: 75000,
    pages: 190,
    description:
      'Tác phẩm kể về cuộc phiêu lưu của Dế Mèn qua nhiều vùng đất. Trong hành trình, nhân vật trải qua những sai lầm như trêu chị Cốc dẫn đến cái chết của Dế Choắt, gặp gỡ các loài vật khác như Dế Trũi, Nhà Trò, Xiến Tóc và dần học cách sống có trách nhiệm, bênh vực kẻ yếu. Sách có các chủ đề về tình bạn, lòng dũng cảm, bài học tự kiêu và quá trình trưởng thành. Phù hợp với độc giả thiếu nhi, học sinh và người yêu thích truyện đồng thoại Việt Nam.',
  },
  {
    title: 'Số Đỏ',
    authorNames: ['Vũ Trọng Phụng'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1936,
    price: 88000,
    pages: 250,
    description:
      'Tiểu thuyết trào phúng xoay quanh nhân vật Xuân Tóc Đỏ, một kẻ lang thang thất học nhưng nhờ những tình huống trớ trêu và sự lố lăng của giới thượng lưu thành thị đã leo lên vị trí bác sĩ, nhà cải cách xã hội rồi anh hùng cứu quốc. Tác giả sử dụng tiếng cười châm biếm để phơi bày phong trào Âu hóa giả hiệu, thói đạo đức giả và sự suy đồi của xã hội thực dân nửa phong kiến thập niên 1930. Sách mang chủ đề châm biếm xã hội, văn học hiện thực phê phán và bi hài kịch đô thị. Phù hợp với học sinh trung học phổ thông, sinh viên và độc giả yêu văn học kinh điển Việt Nam.',
  },
  {
    title: 'Truyện Kiều',
    authorNames: ['Nguyễn Du'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1820,
    price: 95000,
    pages: 320,
    description:
      'Tác phẩm thơ lục bát gồm 3.254 câu kể lại mười lăm năm lưu lạc đầy bi thương của Thúy Kiều, người con gái tài sắc vẹn toàn phải bán mình chuộc cha và trải qua nhiều cảnh ngộ éo le như thanh lâu, làm lẽ, đi tu trước khi đoàn tụ cùng gia đình và Kim Trọng. Đại thi hào Nguyễn Du gửi gắm tiếng nói nhân đạo sâu sắc, tố cáo thế lực đồng tiền và bênh vực thân phận người phụ nữ trong xã hội phong kiến. Chủ đề chính gồm chữ hiếu, chữ tình, bi kịch tài mệnh tương đố và giá trị nhân văn. Phù hợp với học sinh, sinh viên và độc giả yêu thơ ca cổ điển Việt Nam.',
  },

  // 18-24: Văn học Nước ngoài (Murakami, Paulo Coelho, George Orwell, Conan Doyle)
  {
    title: 'Rừng Na Uy (Norwegian Wood)',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1987,
    price: 135000,
    pages: 512,
    description:
      'Tiểu thuyết theo chân chàng sinh viên Toru Watanabe tại Tokyo cuối thập niên 1960 khi anh nhớ lại mối tình đầy giằng xé với Naoko, cô gái mang vết thương tâm lý sau cái chết của người bạn thân Kizuki, và tình cảm tươi mới dành cho Midori. Tác phẩm đi sâu vào cảm giác cô đơn, sự mất mát, khủng hoảng tinh thần và quá trình bước vào đời của người trẻ. Sách mang các chủ đề về tình yêu, nỗi cô đơn, tâm lý tuổi trẻ và sự đối diện với cái chết. Phù hợp với độc giả trưởng thành yêu thích văn học Nhật Bản hiện đại.',
  },
  {
    title: 'Kafka Bên Bờ Biển',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2002,
    price: 155000,
    pages: 648,
    description:
      'Cuốn tiểu thuyết đan xen hai tuyến truyện song song: cậu thiếu niên mười lăm tuổi Kafka Tamura bỏ nhà trốn chạy lời nguyền gia đình đến một thư viện tư nhân ở Takamatsu, và ông lão Nakata mất khả năng đọc viết nhưng có thể trò chuyện với mèo. Hai hành trình tưởng chừng tách biệt dần giao thoa trong những sự kiện siêu thực đầy bí ẩn về ký ức, bản ngã và định mệnh. Tác phẩm tiêu biểu cho chủ đề hiện thực huyền ảo, hành trình tìm kiếm bản thân và triết lý số phận. Phù hợp với độc giả yêu thích tiểu thuyết kỳ ảo và văn học đương đại.',
  },
  {
    title: '1Q84 (Tập 1 & 2)',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2009,
    price: 195000,
    pages: 720,
    description:
      'Câu chuyện lấy bối cảnh năm 1984 giả tưởng tại Tokyo, xoay quanh Aomame, một nữ sát thủ bí ẩn, và Tengo, một giáo viên toán kiêm nhà văn trẻ nhận lời chỉnh sửa bản thảo kỳ lạ mang tên Nhộng Khí. Cả hai vô tình bước vào thế giới song song mang tên 1Q84 có hai mặt trăng trên bầu trời, nơi các giáo phái bí mật và thế lực siêu nhiên chi phối thực tại. Tác phẩm khai thác chủ đề thế giới song song, tình yêu vượt không gian, tự do cá nhân và quyền lực tôn giáo cực đoan. Dành cho độc giả yêu thích tiểu thuyết dài hơi đậm chất huyền bí.',
  },
  {
    title: 'Nhà Giả Kim (The Alchemist)',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Văn học Nước ngoài', 'Tâm lý & Kỹ năng sống'],
    publishYear: 1988,
    price: 79000,
    pages: 228,
    description:
      'Tiểu thuyết ngụ ngôn kể về chàng chăn cừu người Tây Ban Nha tên Santiago rời bỏ quê hương lên đường sang Ai Cập tìm kho báu trong giấc mơ lặp đi lặp lại. Trên hành trình băng qua sa mạc Sahara, cậu gặp gỡ nhiều người dẫn đường, học cách lắng nghe trái tim, đọc các dấu hiệu của vũ trụ và gặp nhà giả kim thông thái. Sách truyền tải chủ đề theo đuổi ước mơ, vận mệnh cá nhân, lòng kiên trì và giá trị của hành trình khám phá bản thân. Phù hợp với mọi độc giả đang tìm kiếm động lực sống và câu chuyện triết lý nhẹ nhàng.',
  },
  {
    title: '1984',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1949,
    price: 115000,
    pages: 368,
    description:
      'Tiểu thuyết phản địa đàng lấy bối cảnh quốc gia giả tưởng Oceania dưới sự kiểm soát tuyệt đối của Đảng và biểu tượng Anh Cả thông qua hệ thống giám sát, cảnh sát tư tưởng và ngôn ngữ Newspeak. Nhân vật chính Winston Smith, một nhân viên sửa đổi tài liệu lịch sử, âm thầm nuôi dưỡng tư tưởng phản kháng và tình yêu bị cấm đoán với Julia trước khi bị bộ máy quyền lực nghiền nát. Tác phẩm đề cập đến chủ đề chế độ toàn trị, kiểm duyệt thông tin, quyền riêng tư và tự do tư tưởng. Phù hợp với độc giả quan tâm đến văn học chính luận và xã hội học.',
  },
  {
    title: 'Chuyện Ở Nông Trại (Animal Farm)',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1945,
    price: 72000,
    pages: 160,
    description:
      'Truyện ngụ ngôn kể về bầy gia súc ở trang trại Manor đứng lên lật đổ ông chủ Jones để xây dựng một cộng đồng bình đẳng do chính loài vật tự quản. Tuy nhiên, tầng lớp lợn dẫn đầu bởi Napoleon dần thâu tóm quyền lực, sửa đổi các điều răn và trở nên độc tài chẳng khác gì con người năm xưa. Tác phẩm khai thác chủ đề châm biếm chính trị, sự tha hóa của quyền lực, tuyên truyền và bất công xã hội. Phù hợp với độc giả yêu thích văn học ngụ ngôn và phê phán xã hội.',
  },
  {
    title: 'Chiếc Nhẫn Tình Cờ (A Study in Scarlet - Sherlock Holmes)',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1887,
    price: 85000,
    pages: 210,
    description:
      'Tác phẩm mở đầu loạt truyện trinh thám kinh điển, đánh dấu cuộc gặp gỡ giữa bác sĩ quân y John Watson và thám tử tư Sherlock Holmes tại số 221B phố Baker. Cả hai cùng điều tra vụ án mạng bí ẩn trong một căn nhà bỏ hoang ở London với dòng chữ máu "Rache" trên tường và chiếc nhẫn cưới rơi lại hiện trường, dần hé lộ câu chuyện trả thù kéo dài từ nước Mỹ. Sách nổi bật với chủ đề điều tra phá án, suy luận logic, quan sát tỉ mỉ và tình bạn giữa Holmes và Watson. Phù hợp với người yêu thích tiểu thuyết trinh thám cổ điển.',
  },

  // 25-29: Kỹ năng & Tâm lý (James Clear, Dale Carnegie, Daniel Kahneman)
  {
    title: 'Atomic Habits: Thay Đổi Tí Hon, Hiệu Quả Bất Ngờ',
    authorNames: ['James Clear'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 2018,
    price: 189000,
    pages: 388,
    description:
      'Cuốn sách trình bày phương pháp xây dựng thói quen tốt và loại bỏ thói quen xấu dựa trên những cải thiện nhỏ chỉ 1% mỗi ngày. Tác giả giới thiệu vòng lặp thói quen gồm bốn bước (tín hiệu, khao khát, phản hồi, phần thưởng) cùng bốn quy luật thực hành cụ thể để biến hành vi mong muốn thành tự động và bền vững. Chủ đề chính xoay quanh phát triển bản thân, tâm lý học hành vi, kỷ luật tự giác và nâng cao hiệu suất cá nhân. Phù hợp với bất kỳ ai muốn thay đổi lối sống, rèn luyện thói quen học tập hoặc làm việc hiệu quả.',
  },
  {
    title: 'Đắc Nhân Tâm (How to Win Friends and Influence People)',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1936,
    price: 86000,
    pages: 320,
    description:
      'Tác phẩm hướng dẫn nghệ thuật giao tiếp và ứng xử khéo léo trong công việc lẫn đời sống hằng ngày dựa trên sự thấu hiểu tâm lý con người. Qua các nguyên tắc như lắng nghe chân thành, nhớ tên người đối diện, tránh chỉ trích trực diện và khơi gợi thiện chí hợp tác, tác giả chỉ ra cách xây dựng mối quan hệ bền vững và tạo ảnh hưởng tích cực. Sách tập trung vào chủ đề kỹ năng giao tiếp, nghệ thuật ứng xử, thuyết phục và lãnh đạo con người. Phù hợp với sinh viên, nhân viên văn phòng, người làm kinh doanh và quản lý.',
  },
  {
    title: 'Quẳng Gánh Lo Đi Và Vui Sống',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1948,
    price: 92000,
    pages: 340,
    description:
      'Cuốn sách cung cấp các phương pháp thực tế giúp con người nhận diện, phân tích và giải tỏa nỗi lo âu trong cuộc sống hiện đại. Tác giả đưa ra nhiều câu chuyện thực tế cùng các nguyên tắc như sống trong từng khoảnh khắc hiện tại, chấp nhận điều tồi tệ nhất có thể xảy ra để bình tĩnh tìm giải pháp và giữ tâm trí bận rộn với công việc có ích. Chủ đề chính gồm quản lý căng thẳng (stress), cân bằng cảm xúc, tư duy tích cực và chăm sóc sức khỏe tinh thần. Phù hợp với người thường xuyên chịu áp lực công việc hoặc lo âu kéo dài.',
  },
  {
    title: 'Tư Duy Nhanh Và Chậm (Thinking, Fast and Slow)',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2011,
    price: 245000,
    pages: 610,
    description:
      'Công trình tổng hợp hàng thập kỷ nghiên cứu về tâm lý học nhận thức và kinh tế học hành vi của tác giả đoạt giải Nobel Kinh tế. Sách mô tả hai cơ chế vận hành trí não: Hệ thống 1 suy nghĩ nhanh, cảm tính, tự động và Hệ thống 2 suy nghĩ chậm, có chủ đích và phân tích logic, đồng thời chỉ ra hàng loạt thiên kiến nhận thức như hiệu ứng mỏ neo hay ác cảm mất mát. Chủ đề gồm ra quyết định, tâm lý học hành vi, nhận thức sai lầm và tư duy phản biện. Phù hợp với người làm quản lý, tài chính, nghiên cứu và độc giả quan tâm đến cách bộ não hoạt động.',
  },
  {
    title: 'Nhiễu: Điểm Mù Trong Phán Đoán Của Con Người',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2021,
    price: 215000,
    pages: 520,
    description:
      'Tác phẩm phân tích sự khác biệt giữa thiên kiến (sai lệch có hệ thống) và nhiễu (sự dao động ngẫu nhiên không mong muốn) trong các quyết định chuyên môn của con người. Thông qua dữ liệu từ tòa án, bệnh viện, công ty bảo hiểm và tuyển dụng, sách lý giải vì sao hai chuyên gia cùng xem một hồ sơ lại đưa ra phán quyết khác nhau và đề xuất quy trình kiểm soát nhiễu. Sách xoay quanh chủ đề đánh giá rủi ro, ra quyết định tổ chức, kinh tế học hành vi và giảm thiểu sai số. Phù hợp với nhà quản lý, chuyên gia nhân sự, bác sĩ và luật sư.',
  },

  // 30-32: Yuval Noah Harari
  {
    title: 'Sapiens: Lược Sử Loài Người',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học', 'Khoa học & Tự nhiên'],
    publishYear: 2011,
    price: 185000,
    pages: 560,
    description:
      'Cuốn sách tái hiện lịch sử tiến hóa của loài Homo sapiens qua bốn bước ngoặt lớn: Cách mạng Nhận thức, Cách mạng Nông nghiệp, sự thống nhất nhân loại nhờ tiền tệ và tôn giáo, cùng Cách mạng Khoa học. Tác giả lý giải khả năng hợp tác quy mô lớn của con người thông qua những câu chuyện tưởng tượng chung như quốc gia, pháp luật và tập đoàn. Chủ đề chính gồm lịch sử nhân loại, nhân chủng học, văn minh loài người và tiến hóa xã hội. Phù hợp với độc giả yêu thích lịch sử đại chúng và khoa học xã hội.',
  },
  {
    title: 'Homo Deus: Lược Sử Tương Lai',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học', 'Khoa học & Tự nhiên'],
    publishYear: 2015,
    price: 195000,
    pages: 520,
    description:
      'Tiếp nối Sapiens, tác phẩm đặt ra câu hỏi về đích đến tiếp theo của nhân loại sau khi phần lớn kiểm soát được nạn đói, dịch bệnh và chiến tranh truyền thống. Tác giả phân tích tham vọng đạt tới bất tử, hạnh phúc sinh hóa và quyền năng sáng tạo nhờ công nghệ sinh học, thuật toán dữ liệu lớn và trí tuệ nhân tạo (AI), cùng nguy cơ con người bị thuật toán thay thế. Sách xoay quanh chủ đề tương lai học, đạo đức công nghệ, trí tuệ nhân tạo và triết học nhân văn. Phù hợp với độc giả quan tâm đến xu hướng công nghệ và tương lai xã hội.',
  },
  {
    title: '21 Bài Học Cho Thế Kỷ 21',
    authorNames: ['Yuval Noah Harari'],
    categoryNames: ['Lịch sử & Triết học'],
    publishYear: 2018,
    price: 175000,
    pages: 440,
    description:
      'Tác phẩm tập trung vào những vấn đề nóng bỏng của thế giới đương đại thay vì quá khứ xa xôi hay tương lai viễn tưởng. Qua 21 chương ngắn, tác giả bàn về tác động của tự động hóa tới thị trường lao động, cuộc khủng hoảng tin giả, biến đổi khí hậu, chủ nghĩa dân tộc, giáo dục kỹ năng thích nghi và thực hành thiền định. Chủ đề chính là xã hội đương đại, công nghệ và việc làm, tư duy toàn cầu và giáo dục thế kỷ mới. Phù hợp với bạn đọc trẻ, nhà giáo dục và người quan tâm đến thời sự quốc tế.',
  },

  // 33-36: Kinh tế & Kinh doanh (đã sửa tác giả đúng thực tế)
  {
    title: 'Khởi Nghiệp Tinh Gọn (The Lean Startup)',
    authorNames: ['Eric Ries'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2011,
    price: 135000,
    pages: 340,
    description:
      'Cuốn sách giới thiệu phương pháp luận xây dựng doanh nghiệp khởi nghiệp và phát triển sản phẩm mới trong điều kiện bất định cao. Tác giả đề xuất quy trình Xây dựng - Đo lường - Học hỏi, tạo sản phẩm khả dụng tối thiểu (MVP) để kiểm chứng giả thuyết thị trường sớm và quyết định xoay trục (pivot) kịp thời nhằm tránh lãng phí nguồn lực. Chủ đề gồm khởi nghiệp (startup), đổi mới sáng tạo, quản trị sản phẩm và kiểm chứng thị trường. Phù hợp với nhà sáng lập, quản lý sản phẩm và sinh viên kinh doanh.',
  },
  {
    title: 'Chiến Lược Đại Dương Xanh',
    authorNames: ['W. Chan Kim', 'Renée Mauborgne'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2005,
    price: 145000,
    pages: 360,
    description:
      'Tác phẩm trình bày tư duy chiến lược thoát khỏi sự cạnh tranh khốc liệt ở các thị trường bão hòa ("đại dương đỏ") để kiến tạo không gian thị trường mới chưa có đối thủ ("đại dương xanh"). Thông qua khung bốn hành động (Loại bỏ - Giảm bớt - Tăng cường - Sáng tạo) và các ví dụ như Cirque du Soleil hay Nintendo Wii, sách hướng dẫn cách tạo giá trị đột phá với chi phí hợp lý. Chủ đề chính là chiến lược kinh doanh, đổi mới giá trị và lợi thế cạnh tranh. Phù hợp với lãnh đạo doanh nghiệp, nhà hoạch định chiến lược và người làm marketing.',
  },
  {
    title: 'Từ Tốt Đến Vĩ Đại (Good to Great)',
    authorNames: ['Jim Collins'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2001,
    price: 155000,
    pages: 410,
    description:
      'Kết quả nghiên cứu kéo dài năm năm của nhóm tác giả nhằm tìm hiểu điều gì giúp một số công ty bình thường bứt phá đạt hiệu quả vượt trội và duy trì bền vững ít nhất mười lăm năm. Sách rút ra các khái niệm cốt lõi như Lãnh đạo cấp độ 5, nguyên tắc "chọn đúng người lên xe trước", khái niệm Con Nhím và vòng quay bánh đà. Chủ đề gồm quản trị doanh nghiệp, văn hóa kỷ luật, lãnh đạo tổ chức và tăng trưởng dài hạn. Phù hợp với giám đốc điều hành, quản lý cấp trung và người nghiên cứu quản trị.',
  },
  {
    title: 'Tâm Lý Học Về Tiền (The Psychology of Money)',
    authorNames: ['Morgan Housel'],
    categoryNames: ['Kinh tế & Kinh doanh', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2020,
    price: 139000,
    pages: 312,
    description:
      'Qua mười chín câu chuyện ngắn gọn, tác giả chứng minh rằng thành công tài chính phụ thuộc nhiều vào hành vi, sự kiên nhẫn và khả năng kiểm soát lòng tham hơn là kiến thức toán học phức tạp. Sách giải thích sức mạnh của lãi kép, sự khác biệt giữa làm giàu và giữ giàu, tầm quan trọng của biên độ an toàn và biết thế nào là "đủ". Chủ đề chính gồm tài chính cá nhân, đầu tư dài hạn, tâm lý tiêu dùng và tự do tài chính. Phù hợp với người mới bắt đầu quản lý tài chính cá nhân và nhà đầu tư.',
  },

  // 37-39: Khoa học & Tự nhiên (đã sửa tác giả đúng thực tế)
  {
    title: 'Lược Sử Thời Gian (A Brief History of Time)',
    authorNames: ['Stephen Hawking'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 1988,
    price: 125000,
    pages: 280,
    description:
      'Tác phẩm khoa học đại chúng giải thích những câu hỏi nền tảng về nguồn gốc, cấu trúc và số phận của vũ trụ bằng ngôn ngữ dễ tiếp cận với công chúng. Tác giả trình bày về vụ nổ lớn Big Bang, thuyết tương đối của Einstein, cơ học lượng tử, hố đen (bức xạ Hawking) và mũi tên thời gian. Sách gắn với chủ đề vật lý thiên văn, vũ trụ học và khoa học cơ bản. Phù hợp với học sinh, sinh viên và độc giả yêu thích khám phá khoa học tự nhiên.',
  },
  {
    title: 'Vũ Trụ Trong Vỏ Hạt Dẻ',
    authorNames: ['Stephen Hawking'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 2001,
    price: 140000,
    pages: 290,
    description:
      'Tiếp nối Lược Sử Thời Gian, cuốn sách minh họa trực quan những bước tiến mới của vật lý lý thuyết đầu thế kỷ 21. Tác giả giới thiệu về thuyết siêu dây, thuyết M, không-thời gian nhiều chiều, hình học màng (brane) và khả năng du hành thời gian hay dự đoán tương lai vũ trụ. Chủ đề chính gồm vật lý lý thuyết, cơ học lượng tử và vũ trụ học hiện đại. Phù hợp với độc giả đã có nền tảng cơ bản và yêu thích khoa học vũ trụ.',
  },
  {
    title: 'Tại Sao Chúng Ta Lại Ngủ',
    authorNames: ['Matthew Walker'],
    categoryNames: ['Khoa học & Tự nhiên', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2017,
    price: 165000,
    pages: 420,
    description:
      'Dựa trên hơn hai mươi năm nghiên cứu khoa học thần kinh, tác giả giải thích vai trò thiết yếu của giấc ngủ REM và NREM đối với não bộ và cơ thể người. Sách phân tích cách giấc ngủ củng cố trí nhớ, tăng cường hệ miễn dịch, điều hòa cảm xúc, đồng thời cảnh báo tác hại của thiếu ngủ mạn tính, caffeine và ánh sáng xanh. Chủ đề gồm khoa học giấc ngủ, sức khỏe thể chất, chăm sóc tinh thần và nhịp sinh học. Phù hợp với mọi độc giả muốn cải thiện chất lượng giấc ngủ và sức khỏe.',
  },

  // 40-42: Thiếu nhi & Nghệ thuật (đã sửa tác giả đúng thực tế)
  {
    title: 'Hoàng Tử Bé (Le Petit Prince)',
    authorNames: ['Antoine de Saint-Exupéry'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn', 'Văn học Nước ngoài'],
    publishYear: 1943,
    price: 75000,
    pages: 120,
    description:
      'Truyện kể về cuộc gặp gỡ giữa một phi công bị rơi máy bay trên sa mạc Sahara và cậu bé tóc vàng đến từ tiểu hành tinh B612. Qua lời kể của Hoàng tử bé về bông hồng kiêu kỳ và hành trình ghé thăm các hành tinh có những người lớn kỳ quặc, cùng bài học của con cáo về sự "cảm hóa", tác phẩm tôn vinh tình bạn, trách nhiệm và sự trong sáng của tâm hồn. Sách mang chủ đề triết lý sống, tình yêu thương, sự ngây thơ và cái nhìn trẻ thơ. Phù hợp với cả thiếu nhi lẫn người lớn.',
  },
  {
    title: 'Những Tấm Lòng Cao Cả',
    authorNames: ['Edmondo De Amicis'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn', 'Văn học Nước ngoài'],
    publishYear: 1886,
    price: 95000,
    pages: 290,
    description:
      'Tác phẩm viết dưới dạng nhật ký năm học lớp Ba của cậu bé người Ý tên Enrico Bottini, ghi lại những câu chuyện hằng ngày ở trường học, gia đình cùng các truyện đọc hằng tháng do thầy giáo kể. Qua hình ảnh người bạn Garrone hào hiệp, cậu bé Derossi học giỏi hay Coretti hiếu thảo, cuốn sách ca ngợi lòng nhân ái, tình thầy trò, lòng yêu nước và sự sẻ chia với người nghèo khổ. Chủ đề gồm giáo dục nhân cách, tình bạn tuổi học trò và đạo đức gia đình. Rất phù hợp cho học sinh tiểu học, trung học cơ sở và phụ huynh.',
  },
  {
    title: 'Nghệ Thuật Tư Duy Rành Mạch',
    authorNames: ['Rolf Dobelli'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 2011,
    price: 118000,
    pages: 330,
    description:
      'Cuốn sách tổng hợp ngắn gọn 99 lỗi tư duy và thiên kiến nhận thức phổ biến khiến con người dễ mắc sai lầm trong đánh giá và hành động. Tác giả phân tích các bẫy tâm lý như thiên kiến sống sót, ngụy biện chi phí chìm, hiệu ứng bầy đàn và ảo tưởng kiểm soát kèm ví dụ đời thường dễ hiểu. Chủ đề chính là tư duy phản biện, logic học ứng dụng, tránh sai lầm nhận thức và ra quyết định sáng suốt. Phù hợp với sinh viên, nhân viên văn phòng và người muốn rèn luyện tư duy logic.',
  },

  // 43-45: Giáo trình & Ngoại ngữ & CNTT thực hành (sách thật, thông tin chuẩn xác)
  {
    title: 'English Grammar in Use',
    authorNames: ['Raymond Murphy'],
    categoryNames: ['Giáo trình & Ngoại ngữ'],
    publishYear: 2019,
    price: 195000,
    pages: 380,
    description:
      'Giáo trình tự học ngữ pháp tiếng Anh trình độ trung cấp (B1-B2) gồm hơn 140 bài học trình bày song song phần giải thích ngắn gọn bên trái và bài tập thực hành bên phải. Sách bao quát các thì động từ, câu điều kiện, câu bị động, mệnh đề quan hệ, giới từ và cụm động từ thông dụng trong giao tiếp lẫn học thuật. Chủ đề chính là học tiếng Anh, ngữ pháp tiếng Anh ứng dụng và luyện thi chứng chỉ. Phù hợp với học sinh, sinh viên và người tự học tiếng Anh trình độ trung cấp.',
  },
  {
    title: 'The Official Cambridge Guide to IELTS',
    authorNames: ['Pauline Cullen'],
    categoryNames: ['Giáo trình & Ngoại ngữ'],
    publishYear: 2014,
    price: 265000,
    pages: 400,
    description:
      'Tài liệu luyện thi IELTS chính thức cung cấp hướng dẫn chi tiết từng dạng bài cho cả bốn kỹ năng Nghe, Nói, Đọc, Viết ở hai hình thức Academic và General Training. Sách phân tích các lỗi thường gặp của thí sinh, chiến lược quản lý thời gian làm bài và kèm theo tám đề thi thử hoàn chỉnh sát với đề thi thật. Chủ đề gồm luyện thi IELTS, tiếng Anh học thuật và chiến thuật làm bài thi quốc tế. Phù hợp với thí sinh ôn thi IELTS mục tiêu từ 5.5 đến 8.0+.',
  },
  {
    title: 'Eloquent JavaScript: A Modern Introduction to Programming',
    authorNames: ['Marijn Haverbeke'],
    categoryNames: ['Công nghệ thông tin', 'Giáo trình & Ngoại ngữ'],
    publishYear: 2018,
    price: 240000,
    pages: 472,
    description:
      'Giáo trình nhập môn lập trình hiện đại sử dụng ngôn ngữ JavaScript, đi từ cú pháp cơ bản, hàm bậc cao, cấu trúc dữ liệu đến lập trình bất đồng bộ, thao tác DOM trên trình duyệt và xây dựng ứng dụng với Node.js. Mỗi phần đều kèm bài tập thực hành và dự án nhỏ giúp người học nắm vững tư duy lập trình web. Chủ đề xoay quanh lập trình JavaScript, phát triển web frontend và backend, và kỹ thuật lập trình cơ bản. Phù hợp với người mới học lập trình và lập trình viên web.',
  },

  // ── SÁCH MỚI BỔ SUNG CHO SEMANTIC SEARCH (46 - 73) ────────────────

  // 46-50: Công nghệ thông tin mở rộng (Hệ thống dữ liệu, Thuật toán, AI, Thực hành)
  {
    title: 'Designing Data-Intensive Applications',
    authorNames: ['Martin Kleppmann'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2017,
    price: 320000,
    pages: 611,
    description:
      'Cuốn sách chuyên sâu về nguyên lý kiến trúc của các hệ thống xử lý dữ liệu quy mô lớn, tin cậy và có khả năng mở rộng. Tác giả phân tích cơ chế lưu trữ và chỉ mục của cơ sở dữ liệu quan hệ lẫn NoSQL, sao chép dữ liệu (replication), phân mảnh (partitioning), giao dịch phân tán, xử lý theo lô (batch) và xử lý luồng (stream processing). Chủ đề gồm hệ thống phân tán, kiến trúc dữ liệu, cơ sở dữ liệu và kỹ thuật backend nâng cao. Phù hợp với kỹ sư backend, kỹ sư dữ liệu và kiến trúc sư hệ thống.',
  },
  {
    title: 'Grokking Algorithms: An Illustrated Guide for Programmers',
    authorNames: ['Aditya Bhargava'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2016,
    price: 210000,
    pages: 256,
    description:
      'Tài liệu giới thiệu cấu trúc dữ liệu và giải thuật bằng hình vẽ minh họa trực quan, dễ hiểu cho người mới tiếp cận. Sách trình bày tìm kiếm nhị phân, sắp xếp nhanh (quicksort), bảng băm (hash table), thuật toán đồ thị BFS, Dijkstra, thuật toán tham lam và quy hoạch động kèm mã nguồn Python minh họa. Chủ đề chính là thuật toán, cấu trúc dữ liệu, độ phức tạp tính toán (Big O) và tư duy giải quyết vấn đề. Phù hợp với sinh viên công nghệ thông tin và người ôn luyện phỏng vấn lập trình.',
  },
  {
    title: 'The Pragmatic Programmer: Your Journey to Mastery',
    authorNames: ['Andrew Hunt', 'David Thomas'],
    categoryNames: ['Công nghệ thông tin'],
    publishYear: 2019,
    price: 250000,
    pages: 352,
    description:
      'Tác phẩm chia sẻ các nguyên tắc thực tế giúp lập trình viên nâng cao tay nghề, từ nguyên lý DRY (không lặp lại mã), tính trực giao, kiểm soát phiên bản đến kỹ năng gỡ lỗi và làm việc hiệu quả với yêu cầu thay đổi liên tục. Sách nhấn mạnh tinh thần trách nhiệm, học hỏi suốt đời và tư duy thực dụng trong xây dựng phần mềm chất lượng. Chủ đề gồm kỹ năng lập trình, kỹ nghệ phần mềm và phát triển sự nghiệp IT. Phù hợp với lập trình viên ở mọi cấp độ.',
  },
  {
    title: 'Deep Learning',
    authorNames: ['Ian Goodfellow'],
    categoryNames: ['Công nghệ thông tin', 'Khoa học & Tự nhiên'],
    publishYear: 2016,
    price: 380000,
    pages: 800,
    description:
      'Giáo trình nền tảng về học sâu (Deep Learning) trình bày cơ sở toán học gồm đại số tuyến tính, xác suất và tối ưu hóa số trước khi đi sâu vào mạng nơ-ron truyền thẳng, mạng tích chập (CNN), mạng hồi quy (RNN) và các mô hình sinh (generative models). Tác giả giải thích cách huấn luyện, điều chuẩn (regularization) và ứng dụng học sâu trong thị giác máy tính cũng như xử lý ngôn ngữ tự nhiên. Chủ đề gồm trí tuệ nhân tạo (AI), học máy (Machine Learning) và mạng nơ-ron nhân tạo. Phù hợp với sinh viên sau đại học, nhà nghiên cứu và kỹ sư AI.',
  },

  // 51-57: Văn học Việt Nam kinh điển mở rộng
  {
    title: 'Tắt Đèn',
    authorNames: ['Ngô Tất Tố'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1939,
    price: 68000,
    pages: 192,
    description:
      'Tiểu thuyết hiện thực tố cáo chế độ sưu thuế tàn bạo ở nông thôn Việt Nam thời Pháp thuộc qua bi kịch của gia đình chị Dậu tại làng Đông Xá. Để cứu chồng khỏi trận đòn tàn nhẫn của bọn cường hào vì thiếu tiền sưu, chị Dậu phải bán con gái lớn và đàn chó mới đẻ nhưng vẫn bị dồn vào bước đường cùng trong đêm tối như mực. Tác phẩm mang chủ đề áp bức giai cấp, thân phận người phụ nữ nông dân, tình mẫu tử và sức phản kháng tiềm tàng. Phù hợp với học sinh, sinh viên và độc giả yêu văn học hiện thực phê phán.',
  },
  {
    title: 'Lão Hạc',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1943,
    price: 58000,
    pages: 148,
    description:
      'Tập truyện ngắn tiêu biểu xoay quanh câu chuyện cảm động về Lão Hạc, người nông dân nghèo khổ sống cô độc sau khi vợ mất và con trai bỏ đi làm đồn điền cao su. Vì muốn giữ mảnh vườn cho con và không muốn làm phiền hàng xóm, lão đành bán con chó Vàng thân thiết rồi chọn cái chết bằng bả chó để giữ trọn lòng tự trọng. Sách khắc họa chủ đề nghèo đói, nhân phẩm con người, tình phụ tử và nỗi đau của người trí thức nghèo qua nhân vật ông giáo. Phù hợp với học sinh và người yêu truyện ngắn Việt Nam.',
  },
  {
    title: 'Vợ Nhặt',
    authorNames: ['Kim Lân'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1955,
    price: 62000,
    pages: 164,
    description:
      'Truyện ngắn lấy bối cảnh nạn đói khủng khiếp năm 1945 tại xóm ngụ cư, kể về anh Tràng nghèo khổ bất ngờ lấy được vợ chỉ sau vài câu nói đùa và bốn bát bánh đúc. Trong cảnh đói khát bủa vây, sự xuất hiện của người vợ nhặt cùng niềm vui lặng lẽ của bà cụ Tứ thắp lên hy vọng về một tương lai đổi đời. Tác phẩm nổi bật với chủ đề giá trị nhân đạo, khát vọng sống, tình cảm gia đình và sự cưu mang giữa hoạn nạn. Phù hợp với học sinh trung học phổ thông và độc giả văn học Việt Nam.',
  },
  {
    title: 'Đất Rừng Phương Nam',
    authorNames: ['Đoàn Giỏi'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1957,
    price: 98000,
    pages: 310,
    description:
      'Tiểu thuyết kể về hành trình lưu lạc tìm cha của cậu bé An qua các vùng rừng tràm U Minh, sông nước Cửu Long trong những ngày đầu Nam Bộ kháng chiến chống Pháp. Cùng người bạn đồng hành Cò và những con người Nam Bộ hào sảng như tía nuôi, chú Võ Tòng, An chứng kiến thiên nhiên hoang sơ trù phú và tinh thần yêu nước kiên cường. Chủ đề chính gồm phiêu lưu tuổi thơ, thiên nhiên miền Tây Nam Bộ, tình đồng bào và lòng yêu nước. Phù hợp với thiếu nhi, thanh thiếu niên và độc giả mọi lứa tuổi.',
  },
  {
    title: 'Nỗi Buồn Chiến Tranh',
    authorNames: ['Bảo Ninh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1990,
    price: 115000,
    pages: 320,
    description:
      'Tiểu thuyết được viết theo dòng hồi ức đứt đoạn của Kiên, người lính sống sót trở về sau chiến tranh, nay viết văn để đối diện với ký ức về đồng đội đã hy sinh và mối tình đầu tan vỡ với Phương. Tác phẩm không chỉ miêu tả sự khốc liệt nơi chiến trường mà còn khắc họa nỗi cô đơn, chấn thương tâm lý và sự lạc lõng của con người thời hậu chiến. Sách xoay quanh chủ đề chiến tranh và hòa bình, ký ức hậu chiến, tình yêu tuổi trẻ và thân phận con người. Phù hợp với độc giả trưởng thành yêu thích văn học đương đại.',
  },
  {
    title: 'Tuổi Thơ Dữ Dội',
    authorNames: ['Phùng Quán'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1988,
    price: 135000,
    pages: 680,
    description:
      'Bộ tiểu thuyết tái hiện cuộc sống chiến đấu đầy gian khổ nhưng hồn nhiên của các em nhỏ trong Đội Thiếu niên trinh sát Trung đoàn Trần Cao Vân tại Huế thời kỳ kháng chiến chống Pháp. Những nhân vật như Mừng, Lượm, Quỳnh sơn ca, Vịnh sưa đã vượt qua mất mát, hiểm nguy và hy sinh tuổi nhỏ vì độc lập dân tộc. Tác phẩm mang chủ đề lòng yêu nước, tình đồng đội, sự hy sinh và vẻ đẹp tâm hồn tuổi thơ trong chiến tranh. Phù hợp với thanh thiếu niên và độc giả yêu thích tiểu thuyết lịch sử.',
  },
  {
    title: 'Cánh Đồng Bất Tận',
    authorNames: ['Nguyễn Ngọc Tư'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2005,
    price: 82000,
    pages: 218,
    description:
      'Tập truyện ngắn với tác phẩm trung tâm kể về hai chị em Nương và Điền theo cha là ông Út Vũ sống đời rày đây mai đó trên chiếc ghe nuôi vịt dọc các cánh đồng miền Tây. Bị ám ảnh bởi sự phản bội của vợ, người cha trở nên cọc cằn và lạnh lùng, đẩy hai đứa trẻ lớn lên trong nỗi cô đơn nhưng vẫn khao khát yêu thương và tha thứ. Chủ đề chính gồm đời sống sông nước miền Tây, nỗi đau gia đình, sự bao dung và thân phận con người. Phù hợp với độc giả trưởng thành yêu văn xuôi Nam Bộ.',
  },

  // 58-63: Văn học Nước ngoài kinh điển mở rộng
  {
    title: 'Ông Già Và Biển Cả (The Old Man and the Sea)',
    authorNames: ['Ernest Hemingway'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1952,
    price: 65000,
    pages: 128,
    description:
      'Truyện vừa kể về ông lão đánh cá người Cuba tên Santiago đã trải qua tám mươi bốn ngày liên tiếp ra khơi tay trắng trước khi câu được một con cá kiếm khổng lồ ngoài khơi xa. Suốt ba ngày đêm vật lộn với con cá rồi chiến đấu bảo vệ thành quả trước bầy cá mập hung dữ, ông lão dù chỉ mang về bộ xương cá vẫn giữ trọn phẩm giá và ý chí bất khuất. Tác phẩm mang chủ đề nghị lực con người, cuộc đấu tranh với thiên nhiên, sự cô độc và nguyên lý "con người có thể bị hủy diệt chứ không thể bị đánh bại". Phù hợp với học sinh, sinh viên và độc giả mọi lứa tuổi.',
  },
  {
    title: 'Giết Con Chim Nhại (To Kill a Mockingbird)',
    authorNames: ['Harper Lee'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1960,
    price: 120000,
    pages: 380,
    description:
      'Tiểu thuyết được kể qua góc nhìn ngây thơ của cô bé Scout Finch sống tại thị trấn nhỏ Maycomb miền Nam nước Mỹ thập niên 1930. Cha cô, luật sư Atticus Finch, dũng cảm đứng ra bào chữa cho Tom Robinson, một người đàn ông da đen bị vu oan cưỡng hiếp phụ nữ da trắng giữa bầu không khí định kiến nặng nề. Tác phẩm đề cập đến chủ đề phân biệt chủng tộc, công lý, lòng trắc ẩn và bài học đạo đức về sự thấu cảm người khác. Phù hợp với thanh thiếu niên và độc giả yêu văn học kinh điển Mỹ.',
  },
  {
    title: 'Trăm Năm Cô Đơn (One Hundred Years of Solitude)',
    authorNames: ['Gabriel García Márquez'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1967,
    price: 165000,
    pages: 480,
    description:
      'Kiệt tác hiện thực huyền ảo kể lại lịch sử thăng trầm qua bảy thế hệ của dòng họ Buendía tại ngôi làng hư cấu Macondo ở vùng Nam Mỹ, bắt đầu từ cặp vợ chồng sáng lập José Arcadio Buendía và Úrsula Iguarán. Giữa những cuộc nội chiến, dịch mất ngủ, cơn mưa kéo dài nhiều năm và những mối tình ngang trái, các thành viên trong gia tộc đều lặp lại vòng xoáy cô đơn định mệnh. Sách khai thác chủ đề lịch sử Mỹ Latinh, ký ức dòng tộc, sự cô đơn và chủ nghĩa hiện thực huyền ảo. Phù hợp với độc giả yêu thích văn học kinh điển thế giới.',
  },
  {
    title: 'Tội Ác Và Hình Phạt (Crime and Punishment)',
    authorNames: ['Fyodor Dostoevsky'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1866,
    price: 175000,
    pages: 640,
    description:
      'Tiểu thuyết tâm lý lấy bối cảnh thành phố Saint Petersburg thế kỷ 19, theo chân chàng cựu sinh viên nghèo Raskolnikov tin vào thuyết "siêu nhân" cho phép kẻ phi thường vượt qua luân thường để thực hiện tội ác giết bà chủ tiệm cầm đồ. Sau vụ án, Raskolnikov rơi vào cuộc giằng xé lương tâm dữ dội, đối đầu trí tuệ với thanh tra Porfiry và dần tìm thấy con đường chuộc lỗi nhờ tình thương của cô gái Sonya. Chủ đề chính gồm tâm lý tội phạm, lương tâm đạo đức, sự cứu rỗi và triết học hiện sinh. Phù hợp với độc giả trưởng thành yêu thích văn học Nga.',
  },
  {
    title: 'Bắt Trẻ Đồng Xanh (The Catcher in the Rye)',
    authorNames: ['J. D. Salinger'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1951,
    price: 89000,
    pages: 256,
    description:
      'Cuốn sách ghi lại ba ngày lang thang tại thành phố New York của cậu thiếu niên mười sáu tuổi Holden Caulfield ngay sau khi bị đuổi khỏi trường nội trú Pencey. Với giọng kể bất cần nhưng đầy nhạy cảm, Holden bộc lộ nỗi chán ghét sự giả tạo của thế giới người lớn và khao khát bảo vệ sự ngây thơ của trẻ nhỏ như em gái Phoebe. Tác phẩm xoay quanh chủ đề khủng hoảng tuổi mới lớn, sự cô độc, nỗi mất mát và ranh giới giữa tuổi thơ với trưởng thành. Phù hợp với thanh thiếu niên và người trẻ.',
  },
  {
    title: 'Bố Già (The Godfather)',
    authorNames: ['Mario Puzo'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1969,
    price: 145000,
    pages: 560,
    description:
      'Tiểu thuyết xoay quanh gia đình mafia gốc Ý Corleone tại New York sau Thế chiến thứ hai, đứng đầu là ông trùm Vito Corleone trọng chữ tín và nguyên tắc gia đình. Khi Vito bị ám sát hụt và thế giới ngầm nổ ra cuộc thanh trừng đẫm máu, cậu con trai út Michael Corleone từ một cựu quân nhân muốn đứng ngoài vòng tội ác buộc phải tiếp quản đế chế của cha. Sách khai thác chủ đề quyền lực ngầm, lòng trung thành gia đình, danh dự và sự tha hóa. Phù hợp với độc giả trưởng thành yêu thích tiểu thuyết hình sự và tâm lý xã hội.',
  },

  // 64-65: Kinh tế & Kinh doanh mở rộng
  {
    title: 'Cha Giàu Cha Nghèo (Rich Dad Poor Dad)',
    authorNames: ['Robert T. Kiyosaki'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 1997,
    price: 110000,
    pages: 336,
    description:
      'Cuốn sách chia sẻ những bài học tài chính qua sự đối lập trong tư duy tiền bạc giữa "người cha nghèo" là tiến sĩ làm công ăn lương và "người cha giàu" là doanh nhân đầu tư của tác giả. Sách nhấn mạnh sự khác biệt giữa tài sản (tạo ra dòng tiền) và tiêu sản, tầm quan trọng của giáo dục tài chính, đầu tư bất động sản, doanh nghiệp và thoát khỏi vòng luẩn quẩn làm việc chỉ vì tiền. Chủ đề gồm tư duy tài chính cá nhân, đầu tư và tự do tài chính. Phù hợp với người mới tìm hiểu quản lý tài chính và kinh doanh.',
  },
  {
    title: 'Zero to One: Những Bài Học Về Khởi Nghiệp Và Tương Lai',
    authorNames: ['Peter Thiel'],
    categoryNames: ['Kinh tế & Kinh doanh'],
    publishYear: 2014,
    price: 125000,
    pages: 224,
    description:
      'Tác phẩm đúc kết từ các bài giảng về khởi nghiệp của đồng sáng lập PayPal tại Đại học Stanford, đặt trọng tâm vào việc tạo ra giá trị hoàn toàn mới (từ 0 đến 1) thay vì sao chép mô hình đã có (từ 1 đến n). Tác giả phân tích lợi thế độc quyền sáng tạo, công nghệ đột phá, xây dựng đội ngũ sáng lập và bảy câu hỏi cốt lõi mọi công ty công nghệ cần trả lời. Chủ đề gồm khởi nghiệp công nghệ, chiến lược độc quyền và đổi mới sáng tạo. Phù hợp với nhà sáng lập startup, nhà đầu tư và sinh viên kinh tế.',
  },

  // 66-67: Tâm lý & Triết lý sống mở rộng
  {
    title: 'Đi Tìm Lẽ Sống (Man\'s Search for Meaning)',
    authorNames: ['Viktor E. Frankl'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Lịch sử & Triết học'],
    publishYear: 1946,
    price: 98000,
    pages: 220,
    description:
      'Phần đầu tác phẩm là hồi ký chân thực của bác sĩ tâm thần học Viktor Frankl về những năm tháng sinh tồn trong các trại tập trung khắc nghiệt của Đức Quốc xã như Auschwitz. Phần hai trình bày học thuyết Liệu pháp Ý nghĩa (Logotherapy), khẳng định động lực lớn nhất giúp con người vượt qua khổ đau là tìm thấy mục đích sống thông qua công việc, tình yêu thương hoặc thái độ trước nghịch cảnh. Chủ đề gồm ý nghĩa cuộc sống, tâm lý học hiện sinh, nghị lực vượt khó và tự do nội tâm. Phù hợp với mọi độc giả đang tìm điểm tựa tinh thần.',
  },
  {
    title: 'Sức Mạnh Của Hiện Tại (The Power of Now)',
    authorNames: ['Eckhart Tolle'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1997,
    price: 115000,
    pages: 280,
    description:
      'Cuốn sách viết theo hình thức hỏi đáp hướng dẫn người đọc nhận diện sự chi phối của bản ngã và dòng suy nghĩ miên man về quá khứ hay lo âu tương lai. Tác giả chỉ ra cách thực hành chánh niệm, quan sát tâm trí và sống trọn vẹn trong khoảnh khắc hiện tại để tìm thấy sự bình an nội tâm. Chủ đề chính gồm tỉnh thức (mindfulness), kiểm soát cảm xúc, giảm lo âu và phát triển tinh thần. Phù hợp với người tìm kiếm sự tĩnh tâm và cân bằng cuộc sống.',
  },

  // 68-70: Lịch sử & Triết học mở rộng
  {
    title: 'Việt Nam Sử Lược',
    authorNames: ['Trần Trọng Kim'],
    categoryNames: ['Lịch sử & Triết học'],
    publishYear: 1920,
    price: 145000,
    pages: 620,
    description:
      'Bộ thông sử đầu tiên của Việt Nam viết bằng chữ Quốc ngữ, hệ thống hóa tiến trình lịch sử dân tộc từ thời Hồng Bàng dựng nước qua các triều đại Ngô, Đinh, Tiền Lê, Lý, Trần, Lê, Nguyễn cho đến đầu thời kỳ Pháp thuộc. Tác giả trình bày rõ ràng các sự kiện chính trị, cuộc kháng chiến chống ngoại xâm và biến chuyển xã hội theo mạch thời gian mạch lạc. Chủ đề chính là lịch sử Việt Nam, các triều đại phong kiến và truyền thống dân tộc. Phù hợp với học sinh, sinh viên và người muốn nắm tổng quan lịch sử nước nhà.',
  },
  {
    title: 'Súng, Vi Trùng Và Thép (Guns, Germs, and Steel)',
    authorNames: ['Jared Diamond'],
    categoryNames: ['Lịch sử & Triết học', 'Khoa học & Tự nhiên'],
    publishYear: 1997,
    price: 215000,
    pages: 560,
    description:
      'Công trình nghiên cứu liên ngành lý giải nguyên nhân sâu xa khiến các nền văn minh Âu - Á phát triển nhanh hơn và chinh phục các châu lục khác trong lịch sử hiện đại. Tác giả chứng minh lợi thế đến từ yếu tố địa lý, trục lục địa Đông - Tây, số lượng loài cây trồng và gia súc thuần hóa được, dẫn tới thặng dư lương thực, vũ khí thép, chữ viết và khả năng miễn dịch với dịch bệnh truyền nhiễm. Chủ đề gồm lịch sử thế giới, địa lý nhân văn, nhân chủng học và tiến hóa văn minh. Phù hợp với độc giả yêu thích lịch sử và khoa học xã hội.',
  },
  {
    title: 'Thế Giới Của Sophie (Sophie\'s World)',
    authorNames: ['Jostein Gaarder'],
    categoryNames: ['Lịch sử & Triết học', 'Văn học Nước ngoài'],
    publishYear: 1991,
    price: 175000,
    pages: 640,
    description:
      'Tiểu thuyết kết hợp giáo trình dẫn nhập triết học, kể về cô bé mười bốn tuổi người Na Uy tên Sophie Amundsen bất ngờ nhận được những bức thư hỏi "Bạn là ai?" và "Thế giới từ đâu mà có?". Qua các lá thư của nhà triết học bí ẩn Alberto Knox, Sophie bước vào hành trình khám phá lịch sử triết học phương Tây từ thần thoại Hy Lạp, Socrates, Plato, Aristotle đến Descartes, Kant, Marx và thuyết hiện sinh. Chủ đề gồm lịch sử triết học, tư duy đặt câu hỏi và khám phá bản chất tồn tại. Phù hợp với học sinh trung học, sinh viên và người mới tìm hiểu triết học.',
  },

  // 71-72: Khoa học & Tự nhiên mở rộng
  {
    title: 'Vũ Trụ (Cosmos)',
    authorNames: ['Carl Sagan'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 1980,
    price: 185000,
    pages: 430,
    description:
      'Tác phẩm khoa học kinh điển đưa người đọc du hành qua mười lăm tỷ năm tiến hóa của vũ trụ, từ sự hình thành các thiên hà, ngôi sao đến nguồn gốc sự sống trên Trái Đất và hành trình khám phá không gian của loài người. Tác giả kết hợp kiến thức thiên văn học, sinh học và lịch sử khoa học từ thư viện Alexandria cổ đại đến tàu vũ trụ Voyager bằng văn phong giàu chất thơ. Chủ đề gồm thiên văn học, lịch sử khoa học, sự sống ngoài Trái Đất và phương pháp tư duy khoa học. Phù hợp với mọi độc giả yêu thích thiên văn và tri thức nhân loại.',
  },
  {
    title: 'Gen: Lịch Sử Và Tương Lai Của Nhân Loại',
    authorNames: ['Siddhartha Mukherjee'],
    categoryNames: ['Khoa học & Tự nhiên'],
    publishYear: 2016,
    price: 235000,
    pages: 640,
    description:
      'Cuốn sách kể lại lịch sử khám phá bản chất di truyền từ thí nghiệm đậu Hà Lan của Gregor Mendel, học thuyết tiến hóa của Darwin, việc giải mã cấu trúc xoắn kép ADN cho đến công nghệ chỉnh sửa gen CRISPR hiện đại. Tác giả phân tích mối liên hệ giữa gen, môi trường và bệnh tật di truyền, đồng thời đặt ra các vấn đề đạo đức sinh học trong tương lai. Chủ đề gồm di truyền học, sinh học phân tử, lịch sử y học và công nghệ sinh học. Phù hợp với sinh viên sinh học, y khoa và bạn đọc yêu khoa học đời sống.',
  },

  // 73-74: Thiếu nhi mở rộng
  {
    title: 'Không Gia Đình (Sans Famille)',
    authorNames: ['Hector Malot'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn', 'Văn học Nước ngoài'],
    publishYear: 1878,
    price: 115000,
    pages: 520,
    description:
      'Tiểu thuyết phiêu lưu cảm động kể về cậu bé mồ côi Rémi bị người cha nuôi bán cho gánh xiếc rong của cụ Vitalis cùng ba chú chó Capi, Zerbino, Dolce và chú khỉ Joli-Coeur. Trải qua muôn vàn gian khổ từ đói rét, tai nạn hầm mỏ đến mất mát người thân dọc nước Pháp và nước Anh, Rémi vẫn giữ vững lòng nhân hậu, sự trung thực và ý chí lao động tự lập trước khi tìm lại được gia đình ruột thịt. Chủ đề gồm nghị lực vượt khó, tình bạn, lòng trung thực và tình cảm gia đình. Phù hợp với thiếu nhi và thanh thiếu niên.',
  },
  {
    title: 'Charlie Và Nhà Máy Sô-cô-la',
    authorNames: ['Roald Dahl'],
    categoryNames: ['Thiếu nhi & Tuổi mới lớn', 'Văn học Nước ngoài'],
    publishYear: 1964,
    price: 78000,
    pages: 192,
    description:
      'Câu chuyện kỳ diệu về cậu bé nghèo hiền lành Charlie Bucket may mắn tìm thấy một trong năm chiếc Vé Vàng hiếm hoi để vào tham quan nhà máy bánh kẹo bí mật của ông chủ lập dị Willy Wonka. Trong chuyến tham quan qua dòng sông sô-cô-la và những căn phòng kỳ ảo, bốn đứa trẻ hư hỏng lần lượt gặp rắc rối vì thói tham lam, ích kỷ, còn Charlie nhờ sự khiêm tốn đã nhận được phần thưởng bất ngờ. Chủ đề gồm trí tưởng tượng trẻ thơ, lòng khiêm nhường và bài học giáo dục nhẹ nhàng. Phù hợp với độc giả thiếu nhi.',
  },

  // 75-77 (để 2 cuốn cuối là Nghệ thuật & Thiết kế làm hidden theo logic seedBooks)
  {
    title: 'Thiết Kế Cho Mọi Người (The Design of Everyday Things)',
    authorNames: ['Don Norman'],
    categoryNames: ['Nghệ thuật & Thiết kế', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2013,
    price: 165000,
    pages: 368,
    description:
      'Tác phẩm nền tảng về thiết kế lấy con người làm trung tâm, giải thích vì sao nhiều vật dụng hằng ngày từ cánh cửa, công tắc đến phần mềm lại gây bối rối cho người dùng. Tác giả giới thiệu các khái niệm cốt lõi như khả năng gợi ý thao tác (affordance), tín hiệu chỉ dẫn (signifier), ánh xạ tự nhiên, phản hồi hệ thống và mô hình khái niệm. Chủ đề gồm thiết kế trải nghiệm người dùng (UX/UI), thiết kế công nghiệp và tâm lý học tương tác. Phù hợp với nhà thiết kế sản phẩm, UX designer và lập trình viên frontend.',
  },
  {
    title: 'Câu Chuyện Nghệ Thuật (The Story of Art)',
    authorNames: ['E. H. Gombrich'],
    categoryNames: ['Nghệ thuật & Thiết kế', 'Lịch sử & Triết học'],
    publishYear: 1950,
    price: 340000,
    pages: 688,
    description:
      'Cuốn sách dẫn nhập kinh điển về lịch sử mỹ thuật và kiến trúc thế giới, đi từ tranh hang động thời tiền sử, nghệ thuật Ai Cập, Hy Lạp cổ đại, thời Phục Hưng với Leonardo da Vinci hay Michelangelo đến nghệ thuật hiện đại thế kỷ 20. Tác giả giải thích bối cảnh văn hóa và ý đồ sáng tạo đằng sau mỗi tác phẩm bằng ngôn từ giản dị, tránh thuật ngữ hàn lâm khó hiểu. Chủ đề gồm lịch sử mỹ thuật, hội họa, điêu khắc, kiến trúc và thẩm mỹ học. Phù hợp với sinh viên mỹ thuật và người yêu nghệ thuật.',
  },
  {
    title: 'Cướp Như Một Nghệ Sĩ (Steal Like an Artist)',
    authorNames: ['Austin Kleon'],
    categoryNames: ['Nghệ thuật & Thiết kế', 'Tâm lý & Kỹ năng sống'],
    publishYear: 2012,
    price: 85000,
    pages: 160,
    description:
      'Cuốn cẩm nang ngắn gọn chia sẻ mười nguyên tắc khơi nguồn sáng tạo trong nghệ thuật và công việc hiện đại. Tác giả khuyên người làm sáng tạo biết học hỏi có chọn lọc từ nhiều nguồn cảm hứng, kết hợp các ý tưởng sẵn có thành phong cách riêng, bắt tay làm việc bằng đôi tay thay vì chỉ nhìn màn hình và chia sẻ quá trình thực hiện với cộng đồng. Chủ đề gồm tư duy sáng tạo, vượt qua bế tắc ý tưởng và thực hành nghệ thuật. Phù hợp với họa sĩ, nhà thiết kế, người viết lách và bạn trẻ sáng tạo.',
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
