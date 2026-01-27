const User = require("../models/User");
const aiService = require("../services/CVAiService");

// @desc    Generate AI-enhanced professional summary
// @route   POST /api/v1/ai/enhance-summary
// @access  Private
const enhanceSummary = async (req, res, next) => {
  try {
    const { fullName, summary, skills, experience, education } = req.body;

    // Get profile data if not provided
    let profileData = { fullName, summary, skills, experience, education };

    if (!fullName || !experience) {
      const user = await User.findById(req.user.id);
      if (user && user.profile) {
        profileData = {
          fullName: fullName || user.profile.fullName || user.name,
          summary: summary || user.profile.summary,
          skills: skills || user.profile.skills,
          experience: experience || user.profile.experience,
          education: education || user.profile.education,
        };
      }
    }

    // Generate AI summary
    const aiSummary = await aiService.enhanceSummary(profileData);

    // Optionally save to profile
    const user = await User.findById(req.user.id);
    if (user) {
      user.profile.aiSummary = aiSummary;
      await user.save();
    }

    res.status(200).json({
      message: "AI summary generated successfully",
      aiSummary,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Optimize job description with AI
// @route   POST /api/v1/ai/optimize-description/:experienceId
// @access  Private
const optimizeDescription = async (req, res, next) => {
  try {
    const { experienceId } = req.params;
    const { targetRole } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const experience = user.profile.experience.id(experienceId);

    if (!experience) {
      return res.status(404).json({
        message: "Experience not found",
      });
    }

    // Optimize description with AI
    const optimizedDescription = await aiService.optimizeDescription(
      experience,
      targetRole,
    );

    // Update experience description
    experience.description = optimizedDescription;
    await user.save();

    res.status(200).json({
      message: "Description optimized successfully",
      optimizedDescription,
      experience,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI skill suggestions
// @route   GET /api/v1/ai/suggest-skills
// @access  Private
const suggestSkills = async (req, res, next) => {
  try {
    const { targetRole } = req.query;

    const user = await User.findById(req.user.id);
    const currentSkills =
      user && user.profile && user.profile.skills
        ? user.profile.skills.map((s) => s.name || s)
        : [];

    const suggestedSkills = await aiService.suggestSkills(
      targetRole || "Software Developer",
      currentSkills,
    );

    res.status(200).json({
      message: "Skills suggested successfully",
      suggestedSkills,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate AI headline
// @route   POST /api/v1/ai/generate-headline
// @access  Private
const generateHeadline = async (req, res, next) => {
  try {
    const { updateProfile } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please create a profile first.",
      });
    }

    const profileData = {
      fullName: user.profile.fullName || user.name,
      skills: user.profile.skills,
      experience: user.profile.experience,
      education: user.profile.education,
    };

    const headline = await aiService.generateHeadline(profileData);

    // Update profile if requested
    if (updateProfile) {
      user.profile.title = headline;
      await user.save();
    }

    res.status(200).json({
      message: "Headline generated successfully",
      headline,
      profile: updateProfile ? user.profile : undefined,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enhanceSummary,
  optimizeDescription,
  suggestSkills,
  generateHeadline,
};
