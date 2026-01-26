const Profile = require("../models/User");

// const Profile = require("../models/Profile");

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
            const profile = await Profile.findOne({ userId: req.user._id });
            if (profile) {
                profileData = {
                    fullName: fullName || profile.fullName || req.user.name,
                    summary: summary || profile.summary,
                    skills: skills || profile.skills,
                    experience: experience || profile.experience,
                    education: education || profile.education,
                };
            }
        }

        // Generate AI summary
        const aiSummary = await aiService.enhanceSummary(profileData);

        // Optionally save to profile
        const profile = await Profile.findOne({ userId: req.user._id });
        if (profile) {
            profile.aiSummary = aiSummary;
            await profile.save();
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

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        const experience = profile.experience.id(experienceId);

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
        await profile.save();

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

        const profile = await Profile.findOne({ userId: req.user._id });
        const currentSkills = profile ? profile.skills.map((s) => s.name) : [];

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

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found. Please create a profile first.",
            });
        }

        const profileData = {
            fullName: profile.fullName || req.user.name,
            skills: profile.skills,
            experience: profile.experience,
            education: profile.education,
        };

        const headline = await aiService.generateHeadline(profileData);

        // Update profile if requested
        if (updateProfile) {
            profile.headline = headline;
            await profile.save();
        }

        res.status(200).json({
            message: "Headline generated successfully",
            headline,
            profile: updateProfile ? profile : undefined,
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
