const express = require('express');
const router = express.Router();
const items = require('../services/items');
const { stripItemClaims } = require('../services/sanitize');
const { sendError } = require('./handle');

// Item create/update are owner-only, so the response never carries claim
// data. The service's quantity warning mentions claim counts, so it's
// dropped too.
function ownerItem(item) {
  const { warning, ...rest } = stripItemClaims(item);
  return rest;
}

// Create item
router.post('/', async (req, res) => {
  try {
    const { list: listId, ...data } = req.body;
    const item = await items.createItem({ userId: req.user._id, listId, data });
    res.status(201).json(ownerItem(item));
  } catch (error) {
    sendError(res, error, { status: 400 });
  }
});

// Update item (quantity mode transitions and cash rules live in the service)
router.put('/:id', async (req, res) => {
  try {
    const item = await items.updateItem({ userId: req.user._id, itemId: req.params.id, data: req.body });
    res.json(ownerItem(item));
  } catch (error) {
    sendError(res, error, { status: 400, log: 'Error updating item:' });
  }
});

// Delete item
router.delete('/:id', async (req, res) => {
  try {
    res.json(await items.deleteItem({ userId: req.user._id, itemId: req.params.id }));
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
