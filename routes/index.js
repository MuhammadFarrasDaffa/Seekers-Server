const express = require("express");
const router = express.Router();

const authRoutes = require("./AuthRoutes");
const profileRoutes = require("./ProfileRoutes");
const ResumeRoutes = require("./ResumeRoutes");
const JobRoutes = require("./JobRoutes");
const CVAiRoutes = require("./CVAiRoutes");
const PdfRoutes = require("./PdfRoutes");
const InterviewRoutes = require("./InterviewRoutes");
const QuestionRoutes = require("./QuestionRoutes");
const PaymentRoutes = require("./PaymentRoutes");

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/resume", ResumeRoutes);
router.use("/jobs", JobRoutes);
router.use("/cv", CVAiRoutes);
router.use("/pdf", PdfRoutes);
router.use("/interviews", InterviewRoutes);
router.use("/questions", QuestionRoutes);
router.use("/payment", PaymentRoutes);

module.exports = router;
