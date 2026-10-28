const express = require('express');
const authRouter = require('./auth.route');
const meRouter = require('./me.route');

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

module.exports = router;
