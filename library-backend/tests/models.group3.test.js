const mongoose = require('mongoose');
const {
  Notification,
  NotificationRead,
  ForumCategory,
  ForumThread,
  ForumPost,
  ForumReport,
  Setting,
  AuditLog,
  RefreshToken,
} = require('../app/models');
const settingsService = require('../app/services/settings.service');
const auditService = require('../app/services/audit.service');

describe('Models Group 3 & Services - Unit Tests', () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeCategoryId = new mongoose.Types.ObjectId();
  const fakeThreadId = new mongoose.Types.ObjectId();
  const fakePostId = new mongoose.Types.ObjectId();
  const fakeNotificationId = new mongoose.Types.ObjectId();

  describe('Notification Model', () => {
    it('should validate a valid notification and remove __v on toJSON', async () => {
      const notif = new Notification({
        recipient: fakeUserId,
        audience: 'user',
        type: 'loan',
        title: 'Mượn sách thành công',
        content: 'Yêu cầu mượn PM000001 đã được duyệt',
        link: '/my/loans/PM000001',
      });

      await expect(notif.validate()).resolves.toBeUndefined();
      const json = notif.toJSON();
      expect(json.recipient).toEqual(fakeUserId);
      expect(json.audience).toBe('user');
      expect(json.type).toBe('loan');
      expect(json.__v).toBeUndefined();
    });

    it('should require type, title, and content', async () => {
      const notif = new Notification({});
      let error;
      try {
        await notif.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
      expect(error.errors.title).toBeDefined();
      expect(error.errors.content).toBeDefined();
    });

    it('should reject invalid audience or type enum', async () => {
      const notif = new Notification({
        title: 'Test',
        content: 'Test content',
        audience: 'invalid_audience',
        type: 'invalid_type',
      });
      let error;
      try {
        await notif.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.audience).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should configure compound indexes for recipient and audience', () => {
      const indexes = Notification.schema.indexes();
      const hasRecipientIndex = indexes.some(
        ([idx]) => idx.recipient === 1 && idx.createdAt === -1
      );
      const hasAudienceIndex = indexes.some(
        ([idx]) => idx.audience === 1 && idx.createdAt === -1
      );
      expect(hasRecipientIndex).toBe(true);
      expect(hasAudienceIndex).toBe(true);
    });
  });

  describe('NotificationRead Model', () => {
    it('should validate a valid notificationRead', async () => {
      const read = new NotificationRead({
        user: fakeUserId,
        notification: fakeNotificationId,
      });

      await expect(read.validate()).resolves.toBeUndefined();
      expect(read.readAt).toBeInstanceOf(Date);
    });

    it('should require user and notification', async () => {
      const read = new NotificationRead({});
      let error;
      try {
        await read.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.user).toBeDefined();
      expect(error.errors.notification).toBeDefined();
    });

    it('should configure unique compound index on user and notification', () => {
      const indexes = NotificationRead.schema.indexes();
      const uniqueIndex = indexes.find(
        ([idx, options]) => idx.user === 1 && idx.notification === 1 && options?.unique === true
      );
      expect(uniqueIndex).toBeDefined();
    });
  });

  describe('ForumCategory Model', () => {
    it('should validate a valid forum category', async () => {
      const cat = new ForumCategory({
        name: 'Góp ý - Thảo luận',
        slug: 'gop-y-thao-luan',
        description: 'Chuyên mục trao đổi chung',
        order: 1,
      });

      await expect(cat.validate()).resolves.toBeUndefined();
    });

    it('should require name and slug', async () => {
      const cat = new ForumCategory({});
      let error;
      try {
        await cat.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });

    it('should configure unique on slug', () => {
      expect(ForumCategory.schema.path('slug').options.unique).toBe(true);
    });
  });

  describe('ForumThread Model', () => {
    it('should validate a valid forum thread', async () => {
      const thread = new ForumThread({
        category: fakeCategoryId,
        author: fakeUserId,
        title: 'Hỏi về quy định mượn sách',
        slug: 'hoi-ve-quy-dinh-muon-sach',
        content: 'Mỗi độc giả được mượn tối đa bao nhiêu quyển sách?',
        tags: ['quy định', 'mượn sách'],
      });

      await expect(thread.validate()).resolves.toBeUndefined();
      expect(thread.status).toBe('active');
      expect(thread.pinned).toBe(false);
      expect(thread.locked).toBe(false);
      expect(thread.replyCount).toBe(0);
      expect(thread.likeCount).toBe(0);
    });

    it('should require category, author, title, slug, content', async () => {
      const thread = new ForumThread({});
      let error;
      try {
        await thread.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.author).toBeDefined();
      expect(error.errors.title).toBeDefined();
      expect(error.errors.slug).toBeDefined();
      expect(error.errors.content).toBeDefined();
    });

    it('should configure compound index and text index', () => {
      const indexes = ForumThread.schema.indexes();
      const hasCategoryPinnedIndex = indexes.some(
        ([idx]) => idx.category === 1 && idx.pinned === -1 && idx.lastReplyAt === -1
      );
      const hasTextIndex = indexes.some(
        ([idx, opt]) =>
          idx.title === 'text' && idx.content === 'text' && opt?.default_language === 'none'
      );
      expect(hasCategoryPinnedIndex).toBe(true);
      expect(hasTextIndex).toBe(true);
    });
  });

  describe('ForumPost Model', () => {
    it('should validate a valid forum post', async () => {
      const post = new ForumPost({
        thread: fakeThreadId,
        author: fakeUserId,
        content: 'Tối đa 5 quyển sách bạn nhé!',
      });

      await expect(post.validate()).resolves.toBeUndefined();
      expect(post.parent).toBeNull();
      expect(post.likeCount).toBe(0);
      expect(post.status).toBe('active');
    });

    it('should require thread, author, and content', async () => {
      const post = new ForumPost({});
      let error;
      try {
        await post.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.thread).toBeDefined();
      expect(error.errors.author).toBeDefined();
      expect(error.errors.content).toBeDefined();
    });

    it('should configure thread and createdAt index', () => {
      const indexes = ForumPost.schema.indexes();
      const hasThreadIndex = indexes.some(([idx]) => idx.thread === 1 && idx.createdAt === 1);
      expect(hasThreadIndex).toBe(true);
    });
  });

  describe('ForumReport Model', () => {
    it('should validate a valid forum report and resolve virtual targetModel', async () => {
      const reportThread = new ForumReport({
        targetType: 'thread',
        targetId: fakeThreadId,
        reporter: fakeUserId,
        reason: 'Nội dung spam quảng cáo',
      });

      await expect(reportThread.validate()).resolves.toBeUndefined();
      expect(reportThread.targetModel).toBe('ForumThread');

      const reportPost = new ForumReport({
        targetType: 'post',
        targetId: fakePostId,
        reporter: fakeUserId,
        reason: 'Ngôn từ xúc phạm',
      });
      expect(reportPost.targetModel).toBe('ForumPost');
    });

    it('should require targetType, targetId, reporter, reason', async () => {
      const report = new ForumReport({});
      let error;
      try {
        await report.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.targetType).toBeDefined();
      expect(error.errors.targetId).toBeDefined();
      expect(error.errors.reporter).toBeDefined();
      expect(error.errors.reason).toBeDefined();
    });
  });

  describe('Setting Model', () => {
    it('should initialize with standard default values according to digest §D1', () => {
      const setting = new Setting();
      expect(setting.maxBooksPerLoan).toBe(5);
      expect(setting.loanDays).toBe(14);
      expect(setting.maxRenewals).toBe(2);
      expect(setting.renewDays).toBe(7);
      expect(setting.pickupHoldDays).toBe(3);
      expect(setting.reservationHoldDays).toBe(3);
      expect(setting.lateFeePerDay).toBe(2000);
      expect(setting.lostBookFeeRate).toBe(1.0);
      expect(setting.lostBookProcessingFee).toBe(20000);
    });
  });

  describe('AuditLog Model', () => {
    it('should validate a valid audit log', async () => {
      const log = new AuditLog({
        actor: fakeUserId,
        action: 'book.update',
        targetType: 'Book',
        targetId: new mongoose.Types.ObjectId(),
        detail: { field: 'price', oldValue: 50000, newValue: 60000 },
        ip: '127.0.0.1',
      });

      await expect(log.validate()).resolves.toBeUndefined();
      expect(log.detail.field).toBe('price');
    });

    it('should require action', async () => {
      const log = new AuditLog({});
      let error;
      try {
        await log.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.action).toBeDefined();
    });

    it('should configure indexes for createdAt and targetType/targetId', () => {
      const indexes = AuditLog.schema.indexes();
      const hasCreatedAtIndex = indexes.some(([idx]) => idx.createdAt === -1);
      const hasTargetIndex = indexes.some(([idx]) => idx.targetType === 1 && idx.targetId === 1);
      expect(hasCreatedAtIndex).toBe(true);
      expect(hasTargetIndex).toBe(true);
    });
  });

  describe('RefreshToken Model', () => {
    it('should validate a valid refreshToken', async () => {
      const token = new RefreshToken({
        user: fakeUserId,
        tokenHash: 'hashed_sample_token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'Mozilla/5.0 Chrome',
      });

      await expect(token.validate()).resolves.toBeUndefined();
    });

    it('should require user, tokenHash, and expiresAt', async () => {
      const token = new RefreshToken({});
      let error;
      try {
        await token.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.user).toBeDefined();
      expect(error.errors.tokenHash).toBeDefined();
      expect(error.errors.expiresAt).toBeDefined();
    });

    it('should configure TTL index on expiresAt with expireAfterSeconds: 0', () => {
      const indexes = RefreshToken.schema.indexes();
      const ttlIndex = indexes.find(
        ([idx, opt]) => idx.expiresAt === 1 && opt?.expireAfterSeconds === 0
      );
      expect(ttlIndex).toBeDefined();
    });
  });

  describe('Services Unit Tests', () => {
    describe('settings.service.js', () => {
      afterEach(() => {
        settingsService.invalidate();
        jest.restoreAllMocks();
      });

      it('should create default settings document if none exists', async () => {
        const fakeSettingDoc = new Setting();
        jest.spyOn(Setting, 'findOne').mockResolvedValue(null);
        jest.spyOn(Setting, 'create').mockResolvedValue(fakeSettingDoc);

        const result = await settingsService.getSettings();
        expect(Setting.findOne).toHaveBeenCalledTimes(1);
        expect(Setting.create).toHaveBeenCalledWith({});
        expect(result.maxBooksPerLoan).toBe(5);
      });

      it('should return cached settings on second call without querying DB again', async () => {
        const fakeSettingDoc = new Setting();
        jest.spyOn(Setting, 'findOne').mockResolvedValue(fakeSettingDoc);
        const createSpy = jest.spyOn(Setting, 'create');

        const first = await settingsService.getSettings();
        const second = await settingsService.getSettings();

        expect(first).toBe(fakeSettingDoc);
        expect(second).toBe(fakeSettingDoc);
        expect(Setting.findOne).toHaveBeenCalledTimes(1);
        expect(createSpy).not.toHaveBeenCalled();
      });

      it('should query DB again after invalidate() is called', async () => {
        const fakeSettingDoc = new Setting();
        jest.spyOn(Setting, 'findOne').mockResolvedValue(fakeSettingDoc);

        await settingsService.getSettings();
        settingsService.invalidate();
        await settingsService.getSettings();

        expect(Setting.findOne).toHaveBeenCalledTimes(2);
      });
    });

    describe('audit.service.js', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should log audit record successfully', async () => {
        const fakeAuditDoc = new AuditLog({
          actor: fakeUserId,
          action: 'user.login',
          ip: '127.0.0.1',
        });
        const createSpy = jest.spyOn(AuditLog, 'create').mockResolvedValue(fakeAuditDoc);

        const result = await auditService.log({
          actor: fakeUserId,
          action: 'user.login',
          ip: '127.0.0.1',
        });

        expect(createSpy).toHaveBeenCalledWith({
          actor: fakeUserId,
          action: 'user.login',
          targetType: null,
          targetId: null,
          detail: {},
          ip: '127.0.0.1',
        });
        expect(result).toBe(fakeAuditDoc);
      });

      it('should catch error and return null without throwing', async () => {
        jest.spyOn(AuditLog, 'create').mockRejectedValue(new Error('DB error'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const result = await auditService.log({
          action: 'user.login',
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();
      });
    });
  });
});

