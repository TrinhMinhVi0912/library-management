const { ForumCategory, ForumThread, ForumPost, Book } = require('../app/models');
const { User } = require('../app/models');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const config = require('../app/config');
const forumService = require('../app/services/forum.service');
const notifyService = require('../app/services/notify.service');
const auditService = require('../app/services/audit.service');
const {
  createCategorySchema,
  createThreadSchema,
  updateThreadSchema,
  createPostSchema,
  updatePostSchema,
  forumListQuerySchema,
} = require('../app/validators/forum.validator');

const reader = { _id: '507f1f77bcf86cd799439011', role: 'reader', status: 'active' };
const otherReader = { _id: '507f1f77bcf86cd799439012', role: 'reader', status: 'active' };
const staff = { _id: '507f1f77bcf86cd799439013', role: 'staff', status: 'active' };
const categoryId = '507f1f77bcf86cd799439021';
const threadId = '507f1f77bcf86cd799439022';
const postId = '507f1f77bcf86cd799439023';

describe('BE-33: forum', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  describe('validators and content sanitation', () => {
    it('enforces the agreed title and content limits and validates nested reply ids', () => {
      expect(createCategorySchema.validate({ name: 'Trao đổi' }).error).toBeUndefined();
      expect(createThreadSchema.validate({ category: categoryId, title: 'x'.repeat(150), content: 'Nội dung' }).error).toBeUndefined();
      expect(createThreadSchema.validate({ category: categoryId, title: 'x'.repeat(151), content: 'Nội dung' }).error).toBeDefined();
      expect(createThreadSchema.validate({ category: categoryId, title: 'Chủ đề', content: 'x'.repeat(10001) }).error).toBeDefined();
      expect(createPostSchema.validate({ content: 'x'.repeat(5001) }).error).toBeDefined();
      expect(createPostSchema.validate({ content: 'Trả lời', parent: 'invalid' }).error).toBeDefined();
      expect(updatePostSchema.validate({ content: 'Cập nhật' }).error).toBeUndefined();
      expect(updateThreadSchema.validate({}).error).toBeDefined();
      expect(forumListQuerySchema.validate({ sort: 'popular', page: '2' }).error).toBeUndefined();
    });

    it('removes script elements and rejects content that becomes empty', () => {
      expect(forumService.cleanContent('<p>Xin chào</p><script>alert(1)</script>')).toBe('<p>Xin chào</p>');
      expect(() => forumService.cleanContent('<script>alert(1)</script>')).toThrow();
      expect(forumService.cleanContent('<a href="javascript:alert(1)">link</a>')).not.toContain('javascript:');
    });
  });

  describe('category management', () => {
    it('creates a unique slug and writes an audit entry', async () => {
      jest.spyOn(ForumCategory, 'exists').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      jest.spyOn(ForumCategory, 'create').mockImplementation(async (data) => data);
      const result = await forumService.createCategory({ name: 'Sách hay' }, staff);
      expect(result.slug).toBe('sach-hay-1');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'forum.category.create' }));
    });

    it('prevents deleting a category that still has threads', async () => {
      jest.spyOn(ForumCategory, 'findById').mockResolvedValue({ _id: categoryId });
      jest.spyOn(ForumThread, 'exists').mockResolvedValue(true);
      await expect(forumService.deleteCategory(categoryId, staff)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('threads and posts', () => {
    it('creates a slugged thread with sanitized content and optional book validation', async () => {
      jest.spyOn(ForumCategory, 'exists').mockResolvedValue(true);
      jest.spyOn(Book, 'exists').mockResolvedValue(true);
      jest.spyOn(ForumThread, 'exists').mockResolvedValue(false);
      jest.spyOn(ForumThread, 'create').mockImplementation(async (data) => data);
      const result = await forumService.createThread(reader, {
        category: categoryId, book: threadId, title: 'Gợi ý Sách!', content: '<p>Hay</p><script>bad()</script>', tags: ['gợi ý'],
      });
      expect(result.slug).toBe('goi-y-sach');
      expect(result.content).toBe('<p>Hay</p>');
      expect(result.author).toBe(reader._id);
    });

    it('does not allow locked accounts to create threads or replies', async () => {
      const lockedUser = { ...reader, status: 'locked' };
      await expect(forumService.createThread(lockedUser, { category: categoryId, title: 'Topic', content: 'Text' }))
        .rejects.toMatchObject({ statusCode: 403 });
      await expect(forumService.createPost(threadId, lockedUser, { content: 'Reply' }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('denies edits by other readers but lets staff manage the thread', async () => {
      const thread = { _id: threadId, author: reader._id, status: 'active', title: 'Cũ', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(ForumThread, 'findById').mockResolvedValue(thread);
      jest.spyOn(ForumThread, 'exists').mockResolvedValue(false);
      await expect(forumService.updateThread(threadId, otherReader, { title: 'Mới' })).rejects.toMatchObject({ statusCode: 403 });
      await expect(forumService.updateThread(threadId, staff, { title: 'Mới' })).resolves.toBe(thread);
      expect(thread.slug).toBe('moi');
    });

    it('hides a thread and its posts when its owner deletes it', async () => {
      const thread = { _id: threadId, author: reader._id, status: 'active', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(ForumThread, 'findById').mockResolvedValue(thread);
      const hidePosts = jest.spyOn(ForumPost, 'updateMany').mockResolvedValue({ modifiedCount: 2 });
      await expect(forumService.deleteThread(threadId, reader)).resolves.toMatchObject({ deleted: true });
      expect(thread.status).toBe('hidden');
      expect(hidePosts).toHaveBeenCalledWith({ thread: threadId }, { $set: { status: 'hidden' } });
    });

    it('deletes a post only for its owner or staff and updates thread reply metadata', async () => {
      const post = { _id: postId, thread: threadId, author: reader._id, status: 'active', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(ForumPost, 'findById').mockResolvedValue(post);
      await expect(forumService.deletePost(postId, otherReader)).rejects.toMatchObject({ statusCode: 403 });
      const latestQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(ForumPost, 'findOne').mockReturnValue(latestQuery);
      const updateThread = jest.spyOn(ForumThread, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
      await expect(forumService.deletePost(postId, reader)).resolves.toMatchObject({ deleted: true });
      expect(post.status).toBe('hidden');
      expect(updateThread).toHaveBeenCalledWith({ _id: threadId, replyCount: { $gt: 0 } }, expect.objectContaining({ $inc: { replyCount: -1 } }));
    });

    it('increments views when opening a public thread', async () => {
      const thread = { _id: threadId, viewCount: 4 };
      const query = { populate: jest.fn().mockReturnThis() };
      query.populate.mockReturnValueOnce(query).mockReturnValueOnce(query).mockReturnValueOnce(Promise.resolve(thread));
      jest.spyOn(ForumThread, 'findOneAndUpdate').mockReturnValue(query);
      await expect(forumService.getThread('topic-slug')).resolves.toBe(thread);
      expect(ForumThread.findOneAndUpdate).toHaveBeenCalledWith({ slug: 'topic-slug', status: 'active' }, { $inc: { viewCount: 1 } }, { new: true });
    });

    it('rejects replies to locked threads and nested replies beyond one level', async () => {
      jest.spyOn(ForumThread, 'findOne').mockResolvedValueOnce({ locked: true });
      await expect(forumService.createPost(threadId, reader, { content: 'Reply' })).rejects.toMatchObject({ statusCode: 409 });
      jest.spyOn(ForumThread, 'findOne').mockResolvedValueOnce({ locked: false });
      jest.spyOn(ForumPost, 'findOne').mockResolvedValue({ parent: postId });
      await expect(forumService.createPost(threadId, reader, { content: 'Reply', parent: postId })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('updates reply count and notifies the thread author after a reply', async () => {
      jest.spyOn(ForumThread, 'findOne').mockResolvedValue({ _id: threadId, author: otherReader._id, title: 'Topic', slug: 'topic', locked: false });
      jest.spyOn(ForumPost, 'findOne').mockResolvedValue(null);
      jest.spyOn(ForumPost, 'create').mockResolvedValue({ _id: postId, createdAt: new Date() });
      const update = jest.spyOn(ForumThread, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
      await forumService.createPost(threadId, reader, { content: '<p>Trả lời</p>' });
      expect(update).toHaveBeenCalledWith({ _id: threadId }, expect.objectContaining({ $inc: { replyCount: 1 } }));
      expect(notifyService.notifyUser).toHaveBeenCalledWith(otherReader._id, expect.objectContaining({ type: 'forum' }));
    });

    it('toggles likes with a conditional update and preserves the count', async () => {
      jest.spyOn(ForumThread, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue({ status: 'active', likes: [], likeCount: 0 }) });
      jest.spyOn(ForumThread, 'findOneAndUpdate').mockResolvedValue({ likeCount: 1 });
      await expect(forumService.toggleThreadLike(threadId, reader._id)).resolves.toEqual({ liked: true, likeCount: 1 });
      expect(ForumThread.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: threadId, likes: { $ne: reader._id } },
        { $addToSet: { likes: reader._id }, $inc: { likeCount: 1 } },
        { new: true }
      );
    });
  });

  describe('HTTP routes', () => {
    it('serves public categories and restricts category writes to staff/admin', async () => {
      const categoryQuery = { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: categoryId, name: 'Trao đổi' }]) };
      jest.spyOn(ForumCategory, 'find').mockReturnValue(categoryQuery);
      const publicResponse = await request(app).get('/api/v1/forum/categories').expect(200);
      expect(publicResponse.body.data).toHaveLength(1);

      const token = jwt.sign({ id: reader._id }, config.jwt.accessSecret);
      jest.spyOn(User, 'findById').mockResolvedValue(reader);
      await request(app).post('/api/v1/admin/forum/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Mới' }).expect(403);
    });

    it('requires authentication for category administration', async () => {
      await request(app).post('/api/v1/admin/forum/categories').send({ name: 'Mới' }).expect(401);
    });
  });
});
