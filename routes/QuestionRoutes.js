const express = require('express')
const router = express.Router()

const QuestionController = require('../controllers/QuestionController')
const authentication = require('../middleware/Authentication')

// router.use(authentication)

router.get('/', QuestionController.getAllQuestions)
router.get('/categories', QuestionController.getAllCategories)
router.get('/count', QuestionController.getQuestionCount)

module.exports = router