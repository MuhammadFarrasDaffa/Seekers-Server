const Category = require("../models/Category");
const Question = require("../models/Question");

module.exports = class CategoryController {
    static async createCategory(req, res, next) {
        try {
            const { title, description, imgUrl, level, published } = req.body;
            
            const category = await Category.create({
                title,
                description,
                imgUrl,
                level: level || { junior: false, middle: false, senior: false },
                published: published ?? false
            });

            res.status(201).json({
                success: true,
                message: `Category '${title}' created successfully!`,
                category
            });
        } catch (error) {
            console.error("Error creating category:", error);
            next(error);
        }
    }

    static async getCategories(req, res, next) {
        try {
            // Check if we want only published categories
            const { published } = req.query;
            const filter = published === 'true' ? { published: true } : {};
            
            const categories = await Category.find(filter).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                categories
            });
        } catch (error) {
            console.error("Error fetching categories:", error);
            next(error);
        }
    }

    static async getCategoryById(req, res, next) {
        try {
            const { id } = req.params;
            const category = await Category.findById(id);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            res.status(200).json({
                success: true,
                category
            });
        } catch (error) {
            console.error("Error fetching category:", error);
            next(error);
        }
    }

    static async updateCategory(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const category = await Category.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Category with ID '${id}' updated successfully!`,
                category
            });
        } catch (error) {
            console.error("Error updating category:", error);
            next(error);
        }
    }

    static async deleteCategory(req, res, next) {
        try {
            const { id } = req.params;

            // Check if category has questions
            const questionCount = await Question.countDocuments({ categoryId: id });
            if (questionCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete category that has questions. Delete questions first."
                });
            }

            const category = await Category.findByIdAndDelete(id);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Category with ID '${id}' deleted successfully!`
            });
        } catch (error) {
            console.error("Error deleting category:", error);
            next(error);
        }
    }

    // Helper method to update category level when questions reach threshold
    static async updateCategoryLevelIfReady(categoryId, level) {
        try {
            const levelKey = level === "mid" ? "middle" : level;
            const count = await Question.countDocuments({ categoryId, level });

            if (count >= 15) {
                const category = await Category.findById(categoryId);
                if (category) {
                    category.level[levelKey] = true;
                    await category.save();
                    console.log(`Category ${categoryId} level ${level} marked as ready (${count} questions found)`);
                }
            }
        } catch (error) {
            console.error(`Error updating category level: ${error.message}`);
        }
    }
};