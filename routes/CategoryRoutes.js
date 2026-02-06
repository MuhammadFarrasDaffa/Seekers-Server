const express = require("express");
const router = express.Router();
const CategoryController = require("../controllers/CategoryController");
const authentication = require("../middleware/Authentication");

// Public route for getting published categories (for client)
router.get("/published", CategoryController.getCategories);

// All other routes require authentication (admin only)
router.use(authentication);

router.post("/", CategoryController.createCategory);
router.get("/", CategoryController.getCategories);
router.get("/:id", CategoryController.getCategoryById);
router.put("/:id", CategoryController.updateCategory);
router.delete("/:id", CategoryController.deleteCategory);

module.exports = router;