const express = require('express')
const router = express.Router()

const QuestionController = require('../controllers/QuestionController')
const authentication = require('../middleware/Authentication')

router.use(authentication)

// Existing routes
router.get('/', QuestionController.getAllQuestions)
router.get('/count', QuestionController.getQuestionCount)

// New CRUD routes
router.post('/', QuestionController.createQuestion)
router.get('/:id', QuestionController.getQuestionById)
router.put('/:id', QuestionController.updateQuestion)
router.delete('/:id', QuestionController.deleteQuestion)

// Bulk operations
router.post('/bulk', QuestionController.createBulkQuestions)
router.post('/insert-bulk', QuestionController.insertBulkQuestions)

// Voice generation
router.post('/generate-voice', QuestionController.generateVoice)

module.exports = router