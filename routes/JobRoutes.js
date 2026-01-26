const express = require("express");
const router = express.Router();

const JobController = require("../controllers/JobController");

router.get("/", JobController.getAllJobs);

router.get("/:id", JobController.getJobById);

router.post("/:id/match", JobController.analyzeJobMatch);

module.exports = router;