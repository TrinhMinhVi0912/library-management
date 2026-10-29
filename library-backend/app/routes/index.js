const express = require('express');
const authRouter = require('./auth.route');
const meRouter = require('./me.route');
const uploadRouter = require('./upload.route');
const catalogRouter = require('./catalog.route');
const adminRouter = require('./admin.route');
const bookRouter = require('./book.route');
const cartRouter = require('./cart.route');
const loanRouter = require('./loan.route');

const router = express.Router();

// Router gốc /api/v1 - các module route sẽ được mount tại đây ở các task sau
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Library Management API v1',
  });
});

// Mount các module routes
router.use('/auth', authRouter);
router.use('/me', meRouter);
router.use('/admin/uploads', uploadRouter);
router.use('/admin', adminRouter);
router.use('/books', bookRouter);
router.use('/cart', cartRouter);
router.use('/loans', loanRouter);
router.use('/', catalogRouter);

module.exports = router;
