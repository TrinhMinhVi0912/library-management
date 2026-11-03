const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const ApiError = require('../api-error');
const { asyncHandler, ok } = require('../middlewares');
const { runJob, jobs } = require('../jobs');

const router = express.Router();

function verifyJobsSecret(req, _res, next) {
  const expected = config.jobs.secret;
  const provided = req.get('x-jobs-secret') || '';
  if (!expected || !provided) return next(ApiError.unauthorized('Jobs secret không hợp lệ'));
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return next(ApiError.unauthorized('Jobs secret không hợp lệ'));
  }
  return next();
}

router.post('/:name', verifyJobsSecret, asyncHandler(async (req, res) => {
  if (!jobs[req.params.name]) throw ApiError.notFound('Job không tồn tại');
  const result = await runJob(req.params.name);
  return ok(res, { name: req.params.name, result });
}));

module.exports = router;
