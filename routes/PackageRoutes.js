// routes/PackageRoutes.js
const express = require('express');
const router = express.Router();

const PackageController = require('../controllers/PackageController');
const authentication = require('../middleware/Authentication');

// Public routes
router.get('/', PackageController.getAllPackages);
router.get('/type/:type', PackageController.getPackageByType);
router.get('/:id', PackageController.getPackageById);

// Protected routes (require authentication)
router.post('/', authentication, PackageController.createPackage);
router.put('/:id', authentication, PackageController.updatePackage);
router.delete('/:id', authentication, PackageController.deletePackage);

module.exports = router;
