const express = require('express');
const { requireRole, validate } = require('../middlewares');
const shelfController = require('../controllers/shelf.controller');
const { shelfIdParamsSchema, shelfBookParamsSchema, shelfNameSchema } = require('../validators/shelf.validator');

const router = express.Router();
router.use(requireRole('reader'));

router.route('/')
  .get(shelfController.getMyShelves)
  .post(validate(shelfNameSchema), shelfController.createShelf);

router.route('/:id')
  .patch(validate({ params: shelfIdParamsSchema, body: shelfNameSchema }), shelfController.updateShelf)
  .delete(validate(shelfIdParamsSchema, 'params'), shelfController.deleteShelf);

router.post('/:id/books/:bookId', validate(shelfBookParamsSchema, 'params'), shelfController.addBook);
router.delete('/:id/books/:bookId', validate(shelfBookParamsSchema, 'params'), shelfController.removeBook);

module.exports = router;
