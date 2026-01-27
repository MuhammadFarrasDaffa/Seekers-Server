const express = require("express");
const router = express.Router();
const multer = require("multer");
const ResumeController = require("../controllers/ResumeController");
const authentication = require("../middleware/Authentication");

// Konfigurasi Multer: Simpan file di Memory (RAM) sementara
// Kita tidak perlu simpan di disk karena tujuannya cuma mau diambil teksnya
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// URL: /api/v1/resume/parse
// 'resume' adalah nama field key di form-data nanti
router.post("/parse", upload.single("resume"), ResumeController.parseResume);

// URL: /api/v1/resume/save-to-profile
// Save parsed CV data to user profile
router.post("/save-to-profile", authentication, ResumeController.saveToProfile);

module.exports = router;
