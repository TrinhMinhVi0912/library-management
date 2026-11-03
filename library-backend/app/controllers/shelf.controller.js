const { ok, asyncHandler } = require('../middlewares');
const shelfService = require('../services/shelf.service');

const getMyShelves = asyncHandler(async (req, res) => ok(res, await shelfService.getMyShelves(req.user._id)));
const createShelf = asyncHandler(async (req, res) => ok(res, await shelfService.createShelf(req.user._id, req.body.name), null, 201));
const updateShelf = asyncHandler(async (req, res) => ok(res, await shelfService.updateShelf(req.user._id, req.params.id, req.body.name)));
const deleteShelf = asyncHandler(async (req, res) => ok(res, await shelfService.deleteShelf(req.user._id, req.params.id)));
const addBook = asyncHandler(async (req, res) => ok(res, await shelfService.addBook(req.user._id, req.params.id, req.params.bookId)));
const removeBook = asyncHandler(async (req, res) => ok(res, await shelfService.removeBook(req.user._id, req.params.id, req.params.bookId)));

module.exports = { getMyShelves, createShelf, updateShelf, deleteShelf, addBook, removeBook };
