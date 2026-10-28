#!/usr/bin/env node

/**
 * Script seed dữ liệu mẫu cho môi trường phát triển/kiểm thử
 * Cách dùng: npm run seed
 *
 * - Từ chối chạy khi NODE_ENV=production
 * - Đánh dấu dữ liệu seed bằng email domain "@seed.library.local" → xóa sạch khi chạy lại
 * - Seed: 1 admin, 2 nhân viên, 20 độc giả
 * - Seed danh mục & sách: 10 thể loại, 15 tác giả, 5 NXB, 60 sách (ảnh bìa mẫu, copies hợp lệ)
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
  Counter,
} = require('../app/models');
const { nextCode } = require('../app/utils/code.util');
const config = require('../app/config');

// ── Hằng số đánh dấu dữ liệu seed ─────────────────────────────
const SEED_EMAIL_DOMAIN = '@seed.library.local';
const SEED_PASSWORD = 'Seed@123'; // Mật khẩu chung cho mọi user seed

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

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Sinh chuỗi slug tiếng Việt chuẩn SEO
 * @param {string} text
 * @returns {string}
 */
const makeSlug = (text) =>
  slugify(text, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true,
  });

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
 * Xóa sạch dữ liệu seed cũ để có thể chạy lại script nhiều lần an toàn
 */
async function cleanSeedData() {
  const userResult = await User.deleteMany({
    email: { $regex: SEED_EMAIL_DOMAIN.replace('.', '\\.') + '$' },
  });
  console.log(`  → Đã xóa ${userResult.deletedCount} user seed cũ`);

  const bookResult = await Book.deleteMany({});
  console.log(`  → Đã xóa ${bookResult.deletedCount} sách cũ`);

  const categoryResult = await Category.deleteMany({});
  console.log(`  → Đã xóa ${categoryResult.deletedCount} thể loại cũ`);

  const authorResult = await Author.deleteMany({});
  console.log(`  → Đã xóa ${authorResult.deletedCount} tác giả cũ`);

  const publisherResult = await Publisher.deleteMany({});
  console.log(`  → Đã xóa ${publisherResult.deletedCount} NXB cũ`);

  // Reset counters để mã tự tăng (DG, NXB, S) bắt đầu lại từ đầu
  await Counter.deleteMany({ _id: { $in: ['user', 'publisher', 'book'] } });
  console.log('  → Đã thiết lập lại bộ đếm tự tăng (user, publisher, book)');
}

// ── Seed Users ──────────────────────────────────────────────────

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
        position: faker.helpers.arrayElement(['Thủ thư', 'Nhân viên quản lý']),
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

  const inserted = await User.insertMany(users);
  console.log(`  → Đã tạo ${inserted.length} users`);
  console.log(`    • 1 admin:   ${seedEmail('admin', 1)}`);
  console.log(`    • 2 staff:   ${seedEmail('staff', 1)}, ${seedEmail('staff', 2)}`);
  console.log(`    • 20 reader: ${seedEmail('reader', 1)} … ${seedEmail('reader', 20)}`);
  console.log(`    • Mật khẩu chung: ${SEED_PASSWORD}`);
}

// ── Seed Categories ─────────────────────────────────────────────

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
  console.log('\n📌 Seed categories...');
  const categoriesData = RAW_CATEGORIES.map((c) => ({
    name: c.name,
    slug: makeSlug(c.name),
    description: c.description,
  }));

  const inserted = await Category.insertMany(categoriesData);
  console.log(`  → Đã tạo ${inserted.length} thể loại:`);
  inserted.forEach((cat) => console.log(`    • [${cat.slug}] ${cat.name}`));
  return inserted;
}

// ── Seed Authors ────────────────────────────────────────────────

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
  console.log('\n📌 Seed authors...');
  const authorsData = RAW_AUTHORS.map((a, idx) => ({
    name: a.name,
    bio: a.bio,
    photo: {
      url: SAMPLE_AUTHOR_PHOTOS[idx % SAMPLE_AUTHOR_PHOTOS.length],
      publicId: `seed/author-${idx + 1}`,
    },
  }));

  const inserted = await Author.insertMany(authorsData);
  console.log(`  → Đã tạo ${inserted.length} tác giả mẫu.`);
  return inserted;
}

// ── Seed Publishers ─────────────────────────────────────────────

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
  console.log('\n📌 Seed publishers...');
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
  console.log(`  → Đã tạo ${inserted.length} nhà xuất bản:`);
  inserted.forEach((p) => console.log(`    • [${p.code}] ${p.name}`));
  return inserted;
}

// ── Seed Books ──────────────────────────────────────────────────

/**
 * Định nghĩa 60 đầu sách mẫu chất lượng cao gắn với tác giả & thể loại
 */
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
    description: 'Câu chuyện tình đơn phương da diết của chàng trai Ngạn dành cho cô bạn cùng làng Hà Lan có đôi mắt biếc.',
  },
  {
    title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2010,
    price: 125000,
    pages: 378,
    description: 'Bức tranh làng quê bình dị với những rung động đầu đời, tình anh em cảm động và ký ức tuổi thơ êm đềm.',
  },
  {
    title: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 2008,
    price: 98000,
    pages: 212,
    description: 'Chuyến tàu trở về tuổi thơ trong trẻo, tinh nghịch với những trò chơi con trẻ và góc nhìn ngây thơ về thế giới người lớn.',
  },
  {
    title: 'Đi Qua Hoa Cúc',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1992,
    price: 85000,
    pages: 220,
    description: 'Nỗi xao xuyến của tuổi mới lớn trước những vẻ đẹp dịu dàng và những tiếc nuối đầu đời khó quên.',
  },
  {
    title: 'Ngồi Khóc Trên Cây',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 2013,
    price: 115000,
    pages: 340,
    description: 'Chuyện tình yêu trong sáng giữa núi rừng miền Trung với nhiều tình tiết hồi hộp, bất ngờ và cảm động.',
  },
  {
    title: 'Cô Gái Đến Từ Hôm Qua',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1989,
    price: 95000,
    pages: 208,
    description: 'Những kỷ niệm thơ ấu ngọt ngào đan xen với mối tình học trò đầy e ấp và dí dỏm.',
  },
  {
    title: 'Còn Chút Gì Để Nhớ',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1988,
    price: 90000,
    pages: 236,
    description: 'Bức tranh đời sống sinh viên một thời khó khăn nhưng chan chứa ước mơ, hoài bão và tình bạn chân thành.',
  },
  {
    title: 'Bàn Có Năm Chỗ Ngồi',
    authorNames: ['Nguyễn Nhật Ánh'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1987,
    price: 80000,
    pages: 180,
    description: 'Tình bạn học trò ấm áp của năm bạn nhỏ cùng chung một chiếc bàn học ở lớp học vùng quê.',
  },

  // 15-18: Nam Cao
  {
    title: 'Chí Phèo',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1941,
    price: 75000,
    pages: 180,
    description: 'Kiệt tác hiện thực phê phán viết về bi kịch tha hóa và khát vọng làm người lương thiện của người nông dân cùng quẫn.',
  },
  {
    title: 'Lão Hạc',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1943,
    price: 70000,
    pages: 160,
    description: 'Bức chân dung cảm động về lòng tự trọng cao cả và tình thương con bao la của người cha nghèo khó.',
  },
  {
    title: 'Sống Mòn',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1944,
    price: 88000,
    pages: 270,
    description: 'Tác phẩm khắc họa tấn bi kịch tinh thần của người trí thức tiểu tư sản bị gánh nặng cơm áo gạo tiền bóp nghẹt.',
  },
  {
    title: 'Đôi Mắt',
    authorNames: ['Nam Cao'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1948,
    price: 65000,
    pages: 140,
    description: 'Truyện ngắn đặt ra vấn đề nhãn quan và thái độ tiếp nhận hiện thực cách mạng của người trí thức văn nghệ sĩ.',
  },

  // 19-21: Vũ Trọng Phụng
  {
    title: 'Số Đỏ',
    authorNames: ['Vũ Trọng Phụng'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1936,
    price: 105000,
    pages: 280,
    description: 'Tuyệt tác châm biếm xã hội tư sản thành thị thực dân nửa phong kiến thời kỳ Âu hóa qua cuộc đời Xuân Tóc Đỏ.',
  },
  {
    title: 'Giông Tố',
    authorNames: ['Vũ Trọng Phụng'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1936,
    price: 110000,
    pages: 320,
    description: 'Bức tranh xã hội đen tối đầy rẫy mâu thuẫn giai cấp, sự suy đồi đạo đức và những mưu mô thủ đoạn tàn độc.',
  },
  {
    title: 'Vỡ Đê',
    authorNames: ['Vũ Trọng Phụng'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1936,
    price: 95000,
    pages: 240,
    description: 'Tiểu thuyết phản ánh tình cảnh khốn cùng của nhân dân vùng châu thổ sông Hồng trước thiên tai và sưu cao thuế nặng.',
  },

  // 22-23: Tô Hoài & Nguyễn Du
  {
    title: 'Dế Mèn Phiêu Lưu Ký',
    authorNames: ['Tô Hoài'],
    categoryNames: ['Văn học Việt Nam', 'Thiếu nhi & Tuổi mới lớn'],
    publishYear: 1941,
    price: 85000,
    pages: 190,
    description: 'Tác phẩm thiếu nhi bất hủ về chuyến phiêu lưu vào thế giới muôn loài cùng bài học về lòng nhân ái, lý tưởng sống.',
  },
  {
    title: 'Truyện Kiều (Đoạn Trường Tân Thanh)',
    authorNames: ['Nguyễn Du'],
    categoryNames: ['Văn học Việt Nam'],
    publishYear: 1820,
    price: 135000,
    pages: 350,
    description: 'Đỉnh cao thi ca dân tộc Việt Nam, phản ánh số phận trắc trở của nàng Kiều tài hoa bạc mệnh và khát vọng công lý.',
  },

  // 24-28: Haruki Murakami
  {
    title: 'Rừng Na Uy',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1987,
    price: 145000,
    pages: 512,
    description: 'Bản tình ca đượm buồn về sự mất mát, nỗi cô đơn sâu thẳm và hành trình trưởng thành của tuổi trẻ Tokyo thập niên 60.',
  },
  {
    title: 'Biên Niên Ký Chim Vặn Dây Cót',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1994,
    price: 190000,
    pages: 680,
    description: 'Tiểu thuyết hiện thực kỳ ảo quy mô lớn dẫn dắt người đọc qua các tầng ngầm tiềm thức và vết thương lịch sử.',
  },
  {
    title: 'Kafka Bên Bờ Biển',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2002,
    price: 175000,
    pages: 620,
    description: 'Hành trình trốn chạy lời nguyền bí ẩn của cậu bé 15 tuổi đan xen với cuộc phiêu lưu kỳ lạ của ông lão Nakata biết nói chuyện với mèo.',
  },
  {
    title: 'Phía Nam Biên Giới, Phía Tây Mặt Trời',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1992,
    price: 110000,
    pages: 280,
    description: 'Câu chuyện tình lãng mạn đầy hoài niệm về mối tình đầu không trọn vẹn và nỗi khắc khoải kiếm tìm bình yên.',
  },
  {
    title: '1Q84 - Tập 1',
    authorNames: ['Haruki Murakami'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2009,
    price: 160000,
    pages: 540,
    description: 'Thế giới song song với hai vầng trăng lơ lửng trên bầu trời Tokyo năm 1984 và mối liên kết vô hình giữa hai tâm hồn.',
  },

  // 29-31: Paulo Coelho
  {
    title: 'Nhà Giả Kim',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Văn học Nước ngoài', 'Tâm lý & Kỹ năng sống'],
    publishYear: 1988,
    price: 89000,
    pages: 228,
    description: 'Hành trình vượt sa mạc đi tìm kho báu của cậu bé chăn cừu Santiago cùng bài học sâu sắc về việc theo đuổi Vận Mệnh của mình.',
  },
  {
    title: 'Ngoại Tình',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 2014,
    price: 105000,
    pages: 310,
    description: 'Khám phá sự bất an nội tâm và khủng hoảng tuổi trung niên bên dưới vỏ bọc một cuộc sống hôn nhân hoàn hảo.',
  },
  {
    title: 'Veronika Quyết Chết',
    authorNames: ['Paulo Coelho'],
    categoryNames: ['Văn học Nước ngoài', 'Tâm lý & Kỹ năng sống'],
    publishYear: 1998,
    price: 98000,
    pages: 260,
    description: 'Thông điệp mãnh liệt về giá trị của sự sống khi một cô gái trẻ tìm lại khát khao tồn tại ngay trong những ngày cuối đời.',
  },

  // 32-33: George Orwell
  {
    title: '1984',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1949,
    price: 120000,
    pages: 380,
    description: 'Tiểu thuyết kinh điển cảnh báo về một thế giới bị giám sát toàn diện bởi quyền lực tối cao của Anh Cả.',
  },
  {
    title: 'Chuyện Ở Nông Trại (Animal Farm)',
    authorNames: ['George Orwell'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1945,
    price: 85000,
    pages: 170,
    description: 'Truyện ngụ ngôn sắc bén về sự tha hóa của quyền lực khi lý tưởng bình đẳng ban đầu bị phản bội.',
  },

  // 34-37: Arthur Conan Doyle
  {
    title: 'Sherlock Holmes: Chiếc Nhẫn Tình Cờ (A Study in Scarlet)',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1887,
    price: 95000,
    pages: 230,
    description: 'Vụ án đầu tiên ghi dấu cuộc gặp gỡ định mệnh giữa bác sĩ Watson và vị thám tử lập dị tài ba Sherlock Holmes.',
  },
  {
    title: 'Sherlock Holmes: Dấu Bộ Tứ (The Sign of the Four)',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1890,
    price: 98000,
    pages: 240,
    description: 'Vụ án kho báu Agra kỳ bí cùng những tình tiết rượt đuổi nghẹt thở trên sông Thames.',
  },
  {
    title: 'Sherlock Holmes: Thung Lũng Khủng Khiếp',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1915,
    price: 105000,
    pages: 280,
    description: 'Cuộc điều tra vụ án mạng bí hiểm tại thái ấp Birlstone hé lộ bóng dáng tổ chức tội phạm khét tiếng của Moriarty.',
  },
  {
    title: 'Sherlock Holmes: Chó Săn Của Dòng Họ Baskerville',
    authorNames: ['Arthur Conan Doyle'],
    categoryNames: ['Văn học Nước ngoài'],
    publishYear: 1902,
    price: 110000,
    pages: 290,
    description: 'Truyền thuyết rùng rợn về con quái vật bóng đêm trên đồng hoang Dartmoor và bí mật của gia tộc Baskerville.',
  },

  // 38-41: Dale Carnegie
  {
    title: 'Đắc Nhân Tâm (How to Win Friends and Influence People)',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1936,
    price: 108000,
    pages: 320,
    description: 'Nghệ thuật ứng xử, thu phục lòng người và xây dựng các mối quan hệ bền vững, chân thành.',
  },
  {
    title: 'Quẳng Gánh Lo Đi Và Vui Sống',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1948,
    price: 98000,
    pages: 290,
    description: 'Phương pháp kiểm soát lo âu, giữ tinh thần lạc quan và tận hưởng trọn vẹn từng ngày của cuộc sống.',
  },
  {
    title: 'Nghệ Thuật Nói Trước Công Chúng',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1926,
    price: 115000,
    pages: 310,
    description: 'Bí quyết rèn luyện sự tự tin, làm chủ sân khấu và truyền cảm hứng mạnh mẽ đến người nghe.',
  },
  {
    title: 'Khám Phá Sức Mạnh Bản Thân',
    authorNames: ['Dale Carnegie'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 1950,
    price: 92000,
    pages: 250,
    description: 'Hướng dẫn khơi dậy tiềm năng tiềm ẩn và nâng cao năng lực cá nhân trong công việc lẫn đời sống thường ngày.',
  },

  // 42-44: James Clear & Daniel Kahneman
  {
    title: 'Atomic Habits: Thay Đổi Tí Hon Hiệu Quả Bất Ngờ',
    authorNames: ['James Clear'],
    categoryNames: ['Tâm lý & Kỹ năng sống'],
    publishYear: 2018,
    price: 149000,
    pages: 388,
    description: 'Hệ thống 4 bước khoa học giúp xây dựng thói quen tốt và loại bỏ thói quen xấu một cách dễ dàng, bền vững.',
  },
  {
    title: 'Tư Duy Nhanh Và Chậm (Thinking, Fast and Slow)',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2011,
    price: 198000,
    pages: 610,
    description: 'Khám phá hai hệ thống chi phối tư duy con người và lý giải các thiên kiến nhận thức trong việc ra quyết định.',
  },
  {
    title: 'Nhiễu: Sai Lầm Trong Phán Đoán Của Con Người',
    authorNames: ['Daniel Kahneman'],
    categoryNames: ['Tâm lý & Kỹ năng sống', 'Kinh tế & Kinh doanh'],
    publishYear: 2021,
    price: 215000,
    pages: 520,
    description: 'Phân tích hiện tượng nhiễu ngẫu nhiên trong hệ thống tư pháp, y tế và quản lý cùng giải pháp giảm thiểu sai số.',
  },

  // 45-47: Yuval Noah Harari
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

  // 48-51: Kinh tế & Kinh doanh
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

  // 52-54: Khoa học & Đời sống
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

  // 55-57: Thiếu nhi & Nghệ thuật
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

  // 58-60: Giáo trình & Ngoại ngữ
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
  console.log('\n📌 Seed books...');

  // Map nhanh theo tên
  const catMap = new Map(categories.map((c) => [c.name, c._id]));
  const authorMap = new Map(authors.map((a) => [a.name, a]));
  const pubList = publishers;

  const booksToInsert = [];

  for (let i = 0; i < RAW_BOOKS_DEFINITIONS.length; i++) {
    const def = RAW_BOOKS_DEFINITIONS[i];
    const code = await nextCode('book');
    const slug = makeSlug(def.title);

    // Gán tác giả
    const matchedAuthors = def.authorNames
      .map((name) => authorMap.get(name))
      .filter(Boolean);
    const authorIds = matchedAuthors.map((a) => a._id);
    const authorText = matchedAuthors.map((a) => a.name).join(', ');

    // Gán thể loại
    const categoryIds = def.categoryNames
      .map((name) => catMap.get(name))
      .filter(Boolean);

    // Gán NXB xoay vòng
    const publisher = pubList[i % pubList.length];

    // Số lượng sách: total 5..20, available 2..total
    const totalCopies = faker.number.int({ min: 6, max: 20 });
    const availableCopies = faker.number.int({ min: 2, max: totalCopies });

    // Đánh giá và số lượt mượn (để phục vụ tab Top Mượn & Top Đánh Giá)
    const ratingAvg = Number(faker.number.float({ min: 4.0, max: 5.0, fractionDigits: 1 }));
    const ratingCount = faker.number.int({ min: 8, max: 60 });
    const borrowCount = faker.number.int({ min: 10, max: 150 });

    // Ảnh bìa
    const coverUrl = SAMPLE_BOOK_COVERS[i % SAMPLE_BOOK_COVERS.length];

    // Tạo mã ISBN mẫu
    const isbn = `978-604-${faker.number.int({ min: 10, max: 99 })}-${faker.number.int({ min: 10000, max: 99999 })}-${faker.number.int({ min: 0, max: 9 })}`;

    // Vị trí kệ
    const location = `Kệ ${String.fromCharCode(65 + (i % 6))}${((i % 4) + 1)}-0${(i % 9) + 1}`;

    // 2 cuốn cuối để trạng thái 'hidden' kiểm thử lọc sách ẩn
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
  console.log(`  → Đã tạo ${inserted.length} cuốn sách mẫu.`);
  const activeCount = inserted.filter((b) => b.status === 'active').length;
  const hiddenCount = inserted.filter((b) => b.status === 'hidden').length;
  console.log(`    • Hoạt động (active): ${activeCount}`);
  console.log(`    • Ẩn (hidden):         ${hiddenCount}`);
  return inserted;
}

// ── In Thống Kê Tổng Quan ────────────────────────────────────────

async function printStatistics() {
  const [userCount, catCount, authorCount, pubCount, bookCount] =
    await Promise.all([
      User.countDocuments(),
      Category.countDocuments(),
      Author.countDocuments(),
      Publisher.countDocuments(),
      Book.countDocuments(),
    ]);

  console.log('\n📊 ── THỐNG KÊ DỮ LIỆU ĐÃ SEED ───────────────────');
  console.log(`  • Người dùng (Users):        ${userCount}`);
  console.log(`  • Thể loại (Categories):     ${catCount}`);
  console.log(`  • Tác giả (Authors):         ${authorCount}`);
  console.log(`  • Nhà xuất bản (Publishers): ${pubCount}`);
  console.log(`  • Sách (Books):              ${bookCount}`);
  console.log('───────────────────────────────────────────────────\n');
}

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

    console.log('\n🌱 Bắt đầu seed dữ liệu mẫu...');
    await seedUsers();
    const categories = await seedCategories();
    const authors = await seedAuthors();
    const publishers = await seedPublishers();
    await seedBooks(categories, authors, publishers);

    await printStatistics();

    console.log('✅ Toàn bộ quá trình Seed dữ liệu đã thành công tốt đẹp!');
  } finally {
    await MongoDB.disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi seed:', err.message);
  process.exit(1);
});
