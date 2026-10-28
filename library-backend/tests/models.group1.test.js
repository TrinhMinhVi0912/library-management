const {
  User,
  Publisher,
  Author,
  Category,
  Book,
} = require('../app/models');

describe('Models Group 1 - Unit Tests', () => {
  describe('User Model', () => {
    it('should validate valid user and omit passwordHash & __v on toJSON', async () => {
      const userData = {
        code: 'DG000001',
        email: 'reader1@example.com',
        passwordHash: 'hashed_secret_password',
        firstName: 'Nguyen',
        lastName: 'An',
        role: 'reader',
        gender: 'male',
        status: 'active',
      };

      const user = new User(userData);
      await expect(user.validate()).resolves.toBeUndefined();

      const json = user.toJSON();
      expect(json.email).toBe('reader1@example.com');
      expect(json.passwordHash).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });

    it('should require code, email, passwordHash, firstName, lastName', async () => {
      const user = new User({});
      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.code).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.passwordHash).toBeDefined();
      expect(error.errors.firstName).toBeDefined();
      expect(error.errors.lastName).toBeDefined();
    });

    it('should validate role and status enum values', async () => {
      const user = new User({
        code: 'DG000002',
        email: 'invalid@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        role: 'superadmin', // Invalid role
        status: 'archived', // Invalid status
      });

      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('should configure correct indexes on schema', () => {
      const indexes = User.schema.indexes();

      // Verify compound index { role: 1, status: 1 }
      const hasRoleStatusIndex = indexes.some(
        (item) => item[0].role === 1 && item[0].status === 1
      );
      expect(hasRoleStatusIndex).toBe(true);

      // Verify text index
      const textIndex = indexes.find(
        (item) => item[1] && item[1].default_language === 'none'
      );
      expect(textIndex).toBeDefined();
      expect(textIndex[0]).toEqual({
        firstName: 'text',
        lastName: 'text',
        email: 'text',
        code: 'text',
      });

      // Verify email and code uniqueness on schema paths
      expect(User.schema.path('email').options.unique).toBe(true);
      expect(User.schema.path('code').options.unique).toBe(true);
      expect(User.schema.path('passwordHash').options.select).toBe(false);
    });
  });

  describe('Publisher Model', () => {
    it('should validate valid publisher', async () => {
      const pub = new Publisher({
        code: 'NXB001',
        name: 'NXB Kim Đồng',
        address: 'Hà Nội',
      });
      await expect(pub.validate()).resolves.toBeUndefined();
      expect(pub.toJSON().__v).toBeUndefined();
    });

    it('should require code and name', async () => {
      const pub = new Publisher({});
      let error;
      try {
        await pub.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.code).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    it('should configure indexes on code and name', () => {
      expect(Publisher.schema.path('code').options.unique).toBe(true);
      expect(Publisher.schema.path('name').options.index).toBe(true);
    });
  });

  describe('Author Model', () => {
    it('should validate valid author', async () => {
      const author = new Author({
        name: 'Nguyễn Nhật Ánh',
        bio: 'Nhà văn thiếu nhi nổi tiếng',
      });
      await expect(author.validate()).resolves.toBeUndefined();
      expect(author.toJSON().__v).toBeUndefined();
    });

    it('should require name', async () => {
      const author = new Author({});
      let error;
      try {
        await author.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    it('should configure text index on name with default_language none', () => {
      const indexes = Author.schema.indexes();
      const textIndex = indexes.find(
        (item) => item[1] && item[1].default_language === 'none'
      );
      expect(textIndex).toBeDefined();
      expect(textIndex[0]).toEqual({ name: 'text' });
    });
  });

  describe('Category Model', () => {
    it('should validate valid category', async () => {
      const cat = new Category({
        name: 'Công nghệ thông tin',
        slug: 'cong-nghe-thong-tin',
        description: 'Sách về CNTT',
      });
      await expect(cat.validate()).resolves.toBeUndefined();
      expect(cat.toJSON().__v).toBeUndefined();
    });

    it('should require name and slug', async () => {
      const cat = new Category({});
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

    it('should enforce slug unique index', () => {
      expect(Category.schema.path('slug').options.unique).toBe(true);
    });
  });

  describe('Book Model', () => {
    it('should validate valid book', async () => {
      const book = new Book({
        code: 'S000001',
        title: 'Lập trình Node.js thực chiến',
        slug: 'lap-trinh-node-js-thuc-chien',
        price: 120000,
        totalCopies: 10,
        availableCopies: 8,
      });

      await expect(book.validate()).resolves.toBeUndefined();
      expect(book.toJSON().__v).toBeUndefined();
    });

    it('should require code, title, and slug', async () => {
      const book = new Book({});
      let error;
      try {
        await book.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.code).toBeDefined();
      expect(error.errors.title).toBeDefined();
      expect(error.errors.slug).toBeDefined();
    });

    it('should invalidate if availableCopies > totalCopies', async () => {
      const book = new Book({
        code: 'S000002',
        title: 'Sách kiểm thử',
        slug: 'sach-kiem-thu',
        totalCopies: 5,
        availableCopies: 10, // Invalid!
      });

      let error;
      try {
        await book.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.availableCopies).toBeDefined();
    });

    it('should invalidate if availableCopies is negative', async () => {
      const book = new Book({
        code: 'S000003',
        title: 'Sách kiểm thử 2',
        slug: 'sach-kiem-thu-2',
        totalCopies: 5,
        availableCopies: -1, // Invalid!
      });

      let error;
      try {
        await book.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.availableCopies).toBeDefined();
    });

    it('should configure required indexes on Book schema', () => {
      const indexes = Book.schema.indexes();

      // Text index on { title: 'text', authorText: 'text' }
      const textIndex = indexes.find(
        (item) => item[1] && item[1].default_language === 'none'
      );
      expect(textIndex).toBeDefined();
      expect(textIndex[0]).toEqual({
        title: 'text',
        authorText: 'text',
      });

      // Categories and authors
      const hasCategoriesIndex = indexes.some((item) => item[0].categories === 1);
      const hasAuthorsIndex = indexes.some((item) => item[0].authors === 1);
      const hasBorrowCountIndex = indexes.some((item) => item[0].borrowCount === -1);
      const hasCreatedAtIndex = indexes.some((item) => item[0].createdAt === -1);

      expect(hasCategoriesIndex).toBe(true);
      expect(hasAuthorsIndex).toBe(true);
      expect(hasBorrowCountIndex).toBe(true);
      expect(hasCreatedAtIndex).toBe(true);

      // code and slug uniqueness
      expect(Book.schema.path('code').options.unique).toBe(true);
      expect(Book.schema.path('slug').options.unique).toBe(true);
    });
  });
});
