const express = require('express');
const { auth, requireRole } = require('../middlewares');
const { uploadSingle } = require('../middlewares/upload.middleware');
const uploadController = require('../controllers/upload.controller');

const router = express.Router();

// Tất cả các route upload tài nguyên quản trị đều yêu cầu quyền staff hoặc admin
router.use(auth);
router.use(requireRole('staff', 'admin'));

/**
 * @route   POST /api/v1/admin/uploads
 * @desc    Tải ảnh lên Cloudinary (bìa sách, ảnh tác giả, tài nguyên quản trị)
 * @access  Staff, Admin
 */
router.post('/', uploadSingle('file'), uploadController.uploadImage);

module.exports = router;

