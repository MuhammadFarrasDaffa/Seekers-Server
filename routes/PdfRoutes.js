const express = require("express");
const router = express.Router();
const { previewCV, generatePDF } = require("../controllers/PdfController");
const authentication = require("../middleware/Authentication");

// All PDF routes are protected
router.use(authentication);

router.get("/preview", previewCV);
router.post("/generate", generatePDF);

module.exports = router;
