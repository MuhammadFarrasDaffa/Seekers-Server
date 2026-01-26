const express = require("express");
const router = express.Router();
const {
    getProfile,
    createOrUpdateProfile,
    addExperience,
    updateExperience,
    deleteExperience,
    addEducation,
    updateEducation,
    deleteEducation,
    addSkill,
    deleteSkill,
} = require("../controllers/ProfileController");

const authentication = require("../middleware/Authentication");

// All routes are protected
// router.use(authentication);

// Main profile routes
router.route("/").get(getProfile).post(createOrUpdateProfile);

// Experience routes
router.post("/experience", addExperience);
router
    .route("/experience/:experienceId")
    .put(updateExperience)
    .delete(deleteExperience);

// Education routes
router.post("/education", addEducation);
router
    .route("/education/:educationId")
    .put(updateEducation)
    .delete(deleteEducation);

// Skills routes
router.post("/skills", addSkill);
router.delete("/skills/:skillId", deleteSkill);

module.exports = router;
