const express = require('express');
const router = express.Router();
const lists = require('../services/lists');
const { sanitizeForOwner } = require('../services/sanitize');
const { sendError } = require('./handle');

// Get all lists for current user
router.get('/', async (req, res) => {
  try {
    const owned = await lists.listLists({ userId: req.user._id });
    res.json(owned.map(list => sanitizeForOwner(list, req.user._id)));
  } catch (error) {
    sendError(res, error);
  }
});

// Create new list
router.post('/', async (req, res) => {
  try {
    const newWishlist = await lists.createList({
      userId: req.user._id,
      name: req.body.name,
      description: req.body.description,
      event_date: req.body.event_date,
      mailingAddress: req.body.mailingAddress
    });
    res.status(201).json(newWishlist);
  } catch (error) {
    sendError(res, error, { status: 400 });
  }
});

// Get list and its items
router.get('/:id', async (req, res) => {
  try {
    const payload = await lists.getList({ userId: req.user._id, listId: req.params.id });
    // Owners never see claim data; shared viewers get it unchanged.
    res.json(sanitizeForOwner(payload, req.user._id));
  } catch (error) {
    sendError(res, error, { log: 'Error loading list:' });
  }
});

// Update list
router.put('/:id', async (req, res) => {
  try {
    const updated = await lists.updateList({
      userId: req.user._id,
      listId: req.params.id,
      name: req.body.name,
      description: req.body.description,
      event_date: req.body.event_date,
      mailingAddress: req.body.mailingAddress
    });
    res.json(sanitizeForOwner(updated, req.user._id));
  } catch (error) {
    sendError(res, error, { status: 400 });
  }
});

// Delete list
router.delete('/:id', async (req, res) => {
  try {
    res.json(await lists.deleteList({ userId: req.user._id, listId: req.params.id }));
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
