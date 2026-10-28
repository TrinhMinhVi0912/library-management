const Counter = require('../models/counter.model');

/**
 * Cấu hình định dạng mã cho từng đối tượng nghiệp vụ
 */
const CODE_CONFIG = {
  user: { prefix: 'DG', digits: 6 },
  loan: { prefix: 'PM', digits: 6 },
  book: { prefix: 'S', digits: 6 },
  publisher: { prefix: 'NXB', digits: 3 },
};

/**
 * Định dạng số thứ tự thành chuỗi mã nghiệp vụ
 * @param {string} name - Tên đối tượng: 'user' | 'loan' | 'book' | 'publisher'
 * @param {number} seq - Số thứ tự hiện tại
 * @returns {string} Mã nghiệp vụ đã được format
 */
const formatCode = (name, seq) => {
  const config = CODE_CONFIG[name];
  if (!config) {
    throw new Error(`Loại mã không hợp lệ: "${name}". Các loại hỗ trợ: ${Object.keys(CODE_CONFIG).join(', ')}`);
  }
  return `${config.prefix}${String(seq).padStart(config.digits, '0')}`;
};

/**
 * Sinh mã tự tăng tiếp theo cho đối tượng nghiệp vụ
 * Sử dụng findOneAndUpdate với $inc nguyên tử và hỗ trợ session MongoDB transaction
 * 
 * @param {string} name - Tên đối tượng: 'user' | 'loan' | 'book' | 'publisher'
 * @param {object|import('mongoose').ClientSession} [options] - Đối tượng tùy chọn hoặc ClientSession
 * @returns {Promise<string>} Mã tiếp theo (VD: DG000001, PM000001, S000001, NXB001)
 */
const nextCode = async (name, options = null) => {
  if (!CODE_CONFIG[name]) {
    throw new Error(`Loại mã không hợp lệ: "${name}". Các loại hỗ trợ: ${Object.keys(CODE_CONFIG).join(', ')}`);
  }

  let session = null;
  if (options) {
    if (options.session) {
      session = options.session;
    } else if (typeof options.startTransaction === 'function') {
      session = options;
    }
  }

  const queryOptions = {
    new: true,
    returnDocument: 'after',
    upsert: true,
    setDefaultsOnInsert: true,
  };

  if (session) {
    queryOptions.session = session;
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    queryOptions
  );

  return formatCode(name, counter.seq);
};

module.exports = {
  CODE_CONFIG,
  formatCode,
  nextCode,
};
