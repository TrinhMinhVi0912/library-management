const express = require('express');
const { auth, validate, forumPostLimiter } = require('../middlewares');
const forumController = require('../controllers/forum.controller');
const {
  idParamSchema,
  threadParamSchema,
  createThreadSchema,
  updateThreadSchema,
  createPostSchema,
  updatePostSchema,
  forumListQuerySchema,
  createReportSchema,
} = require('../validators/forum.validator');

const router = express.Router();

router.get('/categories', forumController.listCategories);
router.get('/threads', validate(forumListQuerySchema, 'query'), forumController.listThreads);
router.get('/threads/:idOrSlug', validate(threadParamSchema, 'params'), forumController.getThread);
router.get('/threads/:id/posts', validate(idParamSchema, 'params'), validate(forumListQuerySchema, 'query'), forumController.listPosts);

router.post('/threads', auth, forumPostLimiter, validate(createThreadSchema, 'body'), forumController.createThread);
router.patch('/threads/:id', auth, validate({ params: idParamSchema, body: updateThreadSchema }), forumController.updateThread);
router.delete('/threads/:id', auth, validate(idParamSchema, 'params'), forumController.deleteThread);
router.post('/threads/:id/posts', auth, forumPostLimiter, validate({ params: idParamSchema, body: createPostSchema }), forumController.createPost);
router.patch('/posts/:id', auth, validate({ params: idParamSchema, body: updatePostSchema }), forumController.updatePost);
router.delete('/posts/:id', auth, validate(idParamSchema, 'params'), forumController.deletePost);
router.post('/threads/:id/like', auth, validate(idParamSchema, 'params'), forumController.toggleThreadLike);
router.post('/posts/:id/like', auth, validate(idParamSchema, 'params'), forumController.togglePostLike);
router.post('/reports', auth, validate(createReportSchema, 'body'), forumController.createReport);

module.exports = router;
