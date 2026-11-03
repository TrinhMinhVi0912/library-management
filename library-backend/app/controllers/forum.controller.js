const { ok, asyncHandler } = require('../middlewares');
const forumService = require('../services/forum.service');

const listCategories = asyncHandler(async (_req, res) => ok(res, await forumService.listCategories()));
const createCategory = asyncHandler(async (req, res) => ok(res, await forumService.createCategory(req.body, req.user), null, 201));
const updateCategory = asyncHandler(async (req, res) => ok(res, await forumService.updateCategory(req.params.id, req.body, req.user)));
const deleteCategory = asyncHandler(async (req, res) => ok(res, await forumService.deleteCategory(req.params.id, req.user)));
const listThreads = asyncHandler(async (req, res) => {
  const result = await forumService.listThreads(req.query);
  return ok(res, result.items, result.meta);
});
const getThread = asyncHandler(async (req, res) => ok(res, await forumService.getThread(req.params.idOrSlug)));
const createThread = asyncHandler(async (req, res) => ok(res, await forumService.createThread(req.user, req.body), null, 201));
const updateThread = asyncHandler(async (req, res) => ok(res, await forumService.updateThread(req.params.id, req.user, req.body)));
const deleteThread = asyncHandler(async (req, res) => ok(res, await forumService.deleteThread(req.params.id, req.user)));
const listPosts = asyncHandler(async (req, res) => {
  const result = await forumService.listPosts(req.params.id, req.query);
  return ok(res, result.items, result.meta);
});
const createPost = asyncHandler(async (req, res) => ok(res, await forumService.createPost(req.params.id, req.user, req.body), null, 201));
const updatePost = asyncHandler(async (req, res) => ok(res, await forumService.updatePost(req.params.id, req.user, req.body)));
const deletePost = asyncHandler(async (req, res) => ok(res, await forumService.deletePost(req.params.id, req.user)));
const toggleThreadLike = asyncHandler(async (req, res) => ok(res, await forumService.toggleThreadLike(req.params.id, req.user._id)));
const togglePostLike = asyncHandler(async (req, res) => ok(res, await forumService.togglePostLike(req.params.id, req.user._id)));

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listThreads, getThread, createThread, updateThread, deleteThread,
  listPosts, createPost, updatePost, deletePost, toggleThreadLike, togglePostLike,
};
