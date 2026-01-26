const Question = require("../models/Question");
const Category = require("../models/Category");

module.exports = class QuestionController {
    // QUESTION SECTION
    static async getAllQuestions(req, res, next) {
        try {
            const questions = await Question.find();
            res.status(200).json(questions);
        } catch (error) {
            next(error);
        }
    }

    // CATEGORY SECTION
    static async getAllCategories(req, res, next) {
        try {
            const categories = await Category.find({ published: true });
            res.status(200).json(categories);
        } catch (error) {
            next(error);
        }
    }

    // QUESTIONS COUNT FOR CATEGORY + LEVEL
    static async getQuestionCount(req, res, next) {
        try {
            const { categoryId, level } = req.query;

            if (!categoryId || !level) {
                return res.status(400).json({ message: "categoryId and level are required" });
            }

            const count = await Question.countDocuments({
                categoryId: categoryId,
                level: String(level)
            });

            res.status(200).json({ count: count });
        } catch (error) {
            next(error);
        }
    }

}