// routes/TierRoutes.js
const express = require('express');
const router = express.Router();

const TierController = require('../controllers/TierController');
const authentication = require('../middleware/Authentication');

router.use(authentication);

router.get('/', TierController.getAllTiers);
router.get('/:id', TierController.getTierById);

module.exports = router;
