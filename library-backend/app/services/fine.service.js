const { Fine } = require('../models');

/** Tạo một khoản phạt; caller chịu trách nhiệm truyền session khi ở transaction. */
async function createFine(data, options = {}) {
  const [fine] = await Fine.create([data], options);
  return fine;
}

module.exports = { createFine };
