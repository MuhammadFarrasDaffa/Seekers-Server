// routes/PackageRoutes.js
const express = require('express');
const router = express.Router();

const PackageController = require('../controllers/PackageController');
const authentication = require('../middleware/Authentication');

router.use(authentication);

router.get('/', PackageController.getAllPackages);
router.get('/type/:type', PackageController.getPackageByType);
router.get('/:id', PackageController.getPackageById);

module.exports = router;
