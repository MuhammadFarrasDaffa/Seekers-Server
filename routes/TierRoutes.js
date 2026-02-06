// routes/TierRoutes.js
const express = require('express');
const router = express.Router();

const TierController = require('../controllers/TierController');
const authentication = require('../middleware/Authentication');

// Public routes
router.get('/', TierController.getAllTiers);
router.get('/:id', TierController.getTierById);

// Protected routes (require authentication)
router.post('/', authentication, TierController.createTier);
router.put('/:id', authentication, TierController.updateTier);
router.delete('/:id', authentication, TierController.deleteTier);

module.exports = router;
