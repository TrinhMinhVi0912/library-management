const mongoose = require('mongoose');
const {
  Cart,
  Loan,
  RenewalRequest,
  Fine,
  Reservation,
  Review,
  Shelf,
} = require('../app/models');

describe('Models Group 2 - Unit Tests', () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeBookId = new mongoose.Types.ObjectId();
  const fakeLoanId = new mongoose.Types.ObjectId();
  const fakeStaffId = new mongoose.Types.ObjectId();

  describe('Cart Model', () => {
    it('should validate a valid cart and remove __v on toJSON', async () => {
      const cart = new Cart({
        user: fakeUserId,
        items: [
          {
            book: fakeBookId,
            addedAt: new Date(),
          },
        ],
      });

      await expect(cart.validate()).resolves.toBeUndefined();
      const json = cart.toJSON();
      expect(json.user).toEqual(fakeUserId);
      expect(json.items).toHaveLength(1);
      expect(json.items[0].book).toEqual(fakeBookId);
      expect(json.__v).toBeUndefined();
    });

    it('should require user field', async () => {
      const cart = new Cart({ items: [] });
      let error;
      try {
        await cart.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.user).toBeDefined();
    });

    it('should configure unique index on user', () => {
      expect(Cart.schema.path('user').options.unique).toBe(true);
    });
  });

  describe('Loan Model', () => {
    it('should validate a valid loan with nested items and renewals', async () => {
      const loan = new Loan({
        code: 'PM000001',
        reader: fakeUserId,
        status: 'borrowing',
        items: [
          {
            book: fakeBookId,
            titleSnapshot: 'Lập trình Node.js thực chiến',
            priceSnapshot: 150000,
            status: 'borrowing',
            borrowDate: new Date(),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            renewCount: 1,
            renewals: [
              {
                at: new Date(),
                oldDue: new Date(),
                newDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                approvedBy: fakeStaffId,
              },
            ],
            condition: 'good',
          },
        ],
        requestNote: 'Xin nhận vào buổi chiều',
        expectedPickupDate: new Date(),
        pickupDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        approvedBy: fakeStaffId,
        approvedAt: new Date(),
      });

      await expect(loan.validate()).resolves.toBeUndefined();
      const json = loan.toJSON();
      expect(json.code).toBe('PM000001');
      expect(json.status).toBe('borrowing');
      expect(json.items).toHaveLength(1);
      expect(json.items[0].renewals).toHaveLength(1);
      expect(json.__v).toBeUndefined();
    });

    it('should require code, reader, and at least 1 item', async () => {
      const loan = new Loan({ items: [] });
      let error;
      try {
        await loan.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.code).toBeDefined();
      expect(error.errors.reader).toBeDefined();
      expect(error.errors.items).toBeDefined();
    });

    it('should validate status and item enum values', async () => {
      const loan = new Loan({
        code: 'PM000002',
        reader: fakeUserId,
        status: 'invalid_status',
        items: [
          {
            book: fakeBookId,
            titleSnapshot: 'Test Book',
            status: 'invalid_item_status',
            condition: 'invalid_condition',
          },
        ],
      });

      let error;
      try {
        await loan.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
      expect(error.errors['items.0.status']).toBeDefined();
      expect(error.errors['items.0.condition']).toBeDefined();
    });

    it('should configure required indexes on Loan schema', () => {
      const indexes = Loan.schema.indexes();

      const hasReaderStatus = indexes.some(
        (idx) => idx[0].reader === 1 && idx[0].status === 1
      );
      const hasStatusCreatedAt = indexes.some(
        (idx) => idx[0].status === 1 && idx[0].createdAt === -1
      );
      const hasDueDateStatus = indexes.some(
        (idx) => idx[0]['items.dueDate'] === 1 && idx[0].status === 1
      );

      expect(hasReaderStatus).toBe(true);
      expect(hasStatusCreatedAt).toBe(true);
      expect(hasDueDateStatus).toBe(true);
      expect(Loan.schema.path('code').options.unique).toBe(true);
      expect(Loan.schema.path('pickupDeadline').options.index).toBe(true);
    });
  });

  describe('RenewalRequest Model', () => {
    it('should validate a valid renewal request', async () => {
      const req = new RenewalRequest({
        loan: fakeLoanId,
        book: fakeBookId,
        reader: fakeUserId,
        currentDueDate: new Date(),
        requestedDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        reason: 'Cần thêm thời gian nghiên cứu',
        status: 'pending',
      });

      await expect(req.validate()).resolves.toBeUndefined();
      const json = req.toJSON();
      expect(json.status).toBe('pending');
      expect(json.reason).toBe('Cần thêm thời gian nghiên cứu');
      expect(json.__v).toBeUndefined();
    });

    it('should validate status enum values', async () => {
      const req = new RenewalRequest({
        loan: fakeLoanId,
        book: fakeBookId,
        reader: fakeUserId,
        currentDueDate: new Date(),
        requestedDueDate: new Date(),
        status: 'invalid_enum',
      });

      let error;
      try {
        await req.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('should configure partial unique index on { loan: 1, book: 1 } for pending status', () => {
      const indexes = RenewalRequest.schema.indexes();

      const partialIndex = indexes.find(
        (idx) =>
          idx[0].loan === 1 &&
          idx[0].book === 1 &&
          idx[1] &&
          idx[1].unique === true
      );
      expect(partialIndex).toBeDefined();
      expect(partialIndex[1].partialFilterExpression).toEqual({
        status: 'pending',
      });

      const hasStatusCreatedAt = indexes.some(
        (idx) => idx[0].status === 1 && idx[0].createdAt === -1
      );
      const hasReaderCreatedAt = indexes.some(
        (idx) => idx[0].reader === 1 && idx[0].createdAt === -1
      );
      expect(hasStatusCreatedAt).toBe(true);
      expect(hasReaderCreatedAt).toBe(true);
    });
  });

  describe('Fine Model', () => {
    it('should validate a valid fine record', async () => {
      const fine = new Fine({
        reader: fakeUserId,
        loan: fakeLoanId,
        book: fakeBookId,
        type: 'late',
        daysLate: 3,
        amount: 6000,
        reason: 'Quá hạn 3 ngày',
        status: 'unpaid',
      });

      await expect(fine.validate()).resolves.toBeUndefined();
      const json = fine.toJSON();
      expect(json.amount).toBe(6000);
      expect(json.daysLate).toBe(3);
      expect(json.status).toBe('unpaid');
      expect(json.__v).toBeUndefined();
    });

    it('should validate type and status enum values, and positive amount', async () => {
      const fine = new Fine({
        reader: fakeUserId,
        type: 'unknown_type',
        status: 'unknown_status',
        amount: -5000,
      });

      let error;
      try {
        await fine.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
      expect(error.errors.status).toBeDefined();
      expect(error.errors.amount).toBeDefined();
    });

    it('should configure required indexes on Fine schema', () => {
      const indexes = Fine.schema.indexes();

      const hasReaderStatus = indexes.some(
        (idx) => idx[0].reader === 1 && idx[0].status === 1
      );
      const hasLoan = indexes.some((idx) => idx[0].loan === 1);

      expect(hasReaderStatus).toBe(true);
      expect(hasLoan).toBe(true);
    });
  });

  describe('Reservation Model', () => {
    it('should validate a valid reservation', async () => {
      const reservation = new Reservation({
        reader: fakeUserId,
        book: fakeBookId,
        status: 'waiting',
      });

      await expect(reservation.validate()).resolves.toBeUndefined();
      const json = reservation.toJSON();
      expect(json.status).toBe('waiting');
      expect(json.__v).toBeUndefined();
    });

    it('should validate status enum values', async () => {
      const reservation = new Reservation({
        reader: fakeUserId,
        book: fakeBookId,
        status: 'done_not_valid',
      });

      let error;
      try {
        await reservation.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('should configure FIFO queue index and partial unique index on { reader: 1, book: 1 }', () => {
      const indexes = Reservation.schema.indexes();

      const fifoIndex = indexes.find(
        (idx) =>
          idx[0].book === 1 && idx[0].status === 1 && idx[0].createdAt === 1
      );
      expect(fifoIndex).toBeDefined();

      const partialIndex = indexes.find(
        (idx) =>
          idx[0].reader === 1 &&
          idx[0].book === 1 &&
          idx[1] &&
          idx[1].unique === true
      );
      expect(partialIndex).toBeDefined();
      expect(partialIndex[1].partialFilterExpression).toEqual({
        status: { $in: ['waiting', 'available'] },
      });
    });
  });

  describe('Review Model', () => {
    it('should validate a valid review', async () => {
      const review = new Review({
        book: fakeBookId,
        reader: fakeUserId,
        rating: 5,
        comment: 'Sách rất hay và bổ ích!',
        hidden: false,
      });

      await expect(review.validate()).resolves.toBeUndefined();
      const json = review.toJSON();
      expect(json.rating).toBe(5);
      expect(json.comment).toBe('Sách rất hay và bổ ích!');
      expect(json.__v).toBeUndefined();
    });

    it('should validate rating bounds (1 to 5)', async () => {
      const reviewTooHigh = new Review({
        book: fakeBookId,
        reader: fakeUserId,
        rating: 6,
      });

      let errHigh;
      try {
        await reviewTooHigh.validate();
      } catch (err) {
        errHigh = err;
      }
      expect(errHigh).toBeDefined();
      expect(errHigh.errors.rating).toBeDefined();

      const reviewTooLow = new Review({
        book: fakeBookId,
        reader: fakeUserId,
        rating: 0,
      });

      let errLow;
      try {
        await reviewTooLow.validate();
      } catch (err) {
        errLow = err;
      }
      expect(errLow).toBeDefined();
      expect(errLow.errors.rating).toBeDefined();
    });

    it('should configure unique { book: 1, reader: 1 } and { book: 1, createdAt: -1 }', () => {
      const indexes = Review.schema.indexes();

      const uniqueBookReader = indexes.find(
        (idx) =>
          idx[0].book === 1 &&
          idx[0].reader === 1 &&
          idx[1] &&
          idx[1].unique === true
      );
      expect(uniqueBookReader).toBeDefined();

      const bookCreatedAt = indexes.find(
        (idx) => idx[0].book === 1 && idx[0].createdAt === -1
      );
      expect(bookCreatedAt).toBeDefined();
    });
  });

  describe('Shelf Model', () => {
    it('should validate a valid shelf with items', async () => {
      const shelf = new Shelf({
        user: fakeUserId,
        name: 'Sách yêu thích',
        type: 'custom',
        items: [
          {
            book: fakeBookId,
            addedAt: new Date(),
          },
        ],
      });

      await expect(shelf.validate()).resolves.toBeUndefined();
      const json = shelf.toJSON();
      expect(json.name).toBe('Sách yêu thích');
      expect(json.type).toBe('custom');
      expect(json.items).toHaveLength(1);
      expect(json.__v).toBeUndefined();
    });

    it('should validate type enum values', async () => {
      const shelf = new Shelf({
        user: fakeUserId,
        name: 'My Shelf',
        type: 'invalid_shelf_type',
      });

      let error;
      try {
        await shelf.validate();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should configure unique index on { user: 1, name: 1 }', () => {
      const indexes = Shelf.schema.indexes();

      const uniqueUserName = indexes.find(
        (idx) =>
          idx[0].user === 1 &&
          idx[0].name === 1 &&
          idx[1] &&
          idx[1].unique === true
      );
      expect(uniqueUserName).toBeDefined();
    });
  });
});

