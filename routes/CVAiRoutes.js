const express = require("express");
const router = express.Router();
const {
  enhanceSummary,
  optimizeDescription,
  suggestSkills,
  generateHeadline,
} = require("../controllers/CVAiController");

const authentication = require("../middleware/Authentication");

// All AI routes are protected
router.use(authentication);

router.post("/enhance-summary", enhanceSummary);
router.post("/optimize-description/:experienceId", optimizeDescription);
router.get("/suggest-skills", suggestSkills);
router.post("/generate-headline", generateHeadline);

module.exports = router;
