const express = require('express')
const router = express.Router()

const InterviewController = require('../controllers/InterviewController')

const multer = require('multer');
const authentication = require('../middleware/Authentication');
const upload = multer({ storage: multer.memoryStorage() });

router.use(authentication)

router.post('/start', InterviewController.getStart)
router.post('/answer', upload.single('file'), InterviewController.answerQuestion);
router.post('/response', InterviewController.responseToAnswer);
router.post('/evaluate', InterviewController.evaluateInterview);

// New routes for saving and evaluating interviews
router.post('/save', InterviewController.saveInterview);
router.get('/history', InterviewController.getInterviewHistory);
router.get('/token-usage', InterviewController.getTokenUsageHistory);
router.get('/:id', InterviewController.getInterviewById);
router.post('/:id/evaluate', InterviewController.evaluateInterviewById);

module.exports = router