const ApiError = require('../api-error');
const { Shelf, Book } = require('../models');

const DEFAULT_SHELVES = [
  { name: 'Muốn đọc', type: 'want' },
  { name: 'Đang đọc', type: 'reading' },
  { name: 'Đã đọc', type: 'read' },
];

async function ensureDefaultShelves(userId) {
  const existing = await Shelf.find({ user: userId, name: { $in: DEFAULT_SHELVES.map(({ name }) => name) } }).select('name').lean();
  const existingNames = new Set(existing.map((shelf) => shelf.name));
  const missing = DEFAULT_SHELVES.filter(({ name }) => !existingNames.has(name));
  if (missing.length) {
    try {
      await Shelf.bulkWrite(missing.map(({ name, type }) => ({
        updateOne: {
          filter: { user: userId, name },
          update: { $setOnInsert: { user: userId, name, type, items: [] } },
          upsert: true,
        },
      })), { ordered: false });
    } catch (error) {
      const duplicateKey = error.code === 11000 || error.writeErrors?.some((entry) => entry.code === 11000);
      if (!duplicateKey) throw error;
    }
  }
  return Shelf.find({ user: userId }).sort({ createdAt: 1 }).lean();
}

async function getMyShelves(userId) {
  await ensureDefaultShelves(userId);
  return Shelf.find({ user: userId })
    .populate('items.book', 'code title slug cover authors ratingAvg ratingCount')
    .sort({ createdAt: 1 })
    .lean();
}

async function createShelf(userId, name) {
  if (DEFAULT_SHELVES.some((shelf) => shelf.name === name.trim())) throw ApiError.conflict('Tên này dành riêng cho kệ mặc định');
  try {
    return await Shelf.create({ user: userId, name: name.trim(), type: 'custom', items: [] });
  } catch (error) {
    if (error.code === 11000) throw ApiError.conflict('Tên kệ sách đã tồn tại');
    throw error;
  }
}

async function updateShelf(userId, shelfId, name) {
  const shelf = await Shelf.findOne({ _id: shelfId, user: userId });
  if (!shelf) throw ApiError.notFound('Kệ sách không tồn tại');
  if (shelf.type !== 'custom' || DEFAULT_SHELVES.some((entry) => entry.name === shelf.name)) throw ApiError.conflict('Không thể đổi tên kệ mặc định');
  if (DEFAULT_SHELVES.some((entry) => entry.name === name.trim())) throw ApiError.conflict('Tên này dành riêng cho kệ mặc định');
  shelf.name = name.trim();
  try {
    await shelf.save();
  } catch (error) {
    if (error.code === 11000) throw ApiError.conflict('Tên kệ sách đã tồn tại');
    throw error;
  }
  return shelf;
}

async function deleteShelf(userId, shelfId) {
  const shelf = await Shelf.findOne({ _id: shelfId, user: userId });
  if (!shelf) throw ApiError.notFound('Kệ sách không tồn tại');
  if (shelf.type !== 'custom' || DEFAULT_SHELVES.some((entry) => entry.name === shelf.name)) throw ApiError.conflict('Không thể xóa kệ mặc định');
  await Shelf.deleteOne({ _id: shelf._id, user: userId });
  return { deleted: true, shelfId: shelf._id };
}

async function addBook(userId, shelfId, bookId) {
  if (!(await Book.exists({ _id: bookId }))) throw ApiError.notFound('Sách không tồn tại');
  const shelf = await Shelf.findOneAndUpdate(
    { _id: shelfId, user: userId, 'items.book': { $ne: bookId } },
    { $push: { items: { book: bookId } } },
    { new: true, runValidators: true }
  );
  if (shelf) return shelf;
  const existingShelf = await Shelf.findOne({ _id: shelfId, user: userId }).select('_id items.book');
  if (!existingShelf) throw ApiError.notFound('Kệ sách không tồn tại');
  throw ApiError.conflict('Sách đã có trong kệ này');
}

async function removeBook(userId, shelfId, bookId) {
  const shelf = await Shelf.findOneAndUpdate(
    { _id: shelfId, user: userId },
    { $pull: { items: { book: bookId } } },
    { new: true }
  );
  if (!shelf) throw ApiError.notFound('Kệ sách không tồn tại');
  return shelf;
}

module.exports = {
  DEFAULT_SHELVES,
  ensureDefaultShelves,
  getMyShelves,
  createShelf,
  updateShelf,
  deleteShelf,
  addBook,
  removeBook,
};
