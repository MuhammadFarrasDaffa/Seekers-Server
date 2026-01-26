//! SEKARANG AMBIL PROFILE DARI MODEL USER HARUSNYA  - FARRAS
const Profile = require("../models/User");

// const Profile = require("../models/Profile"); (HAPUS INI)

const getProfile = async (req, res, next) => {
    try {
        let profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        res.status(200).json({
            message: "Profile retrieved successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create or update main profile
// @route   POST /api/v1/profile
// @access  Private
const createOrUpdateProfile = async (req, res, next) => {
    try {
        const {
            fullName,
            headline,
            email,
            phone,
            address,
            summary,
            linkedin,
            github,
            portfolio,
            experience,
            education,
            skills,
            certifications,
        } = req.body;

        // Find existing profile or create new
        let profile = await Profile.findOne({ userId: req.user._id });

        if (profile) {
            // Update existing profile
            profile.fullName = fullName || profile.fullName;
            profile.headline = headline || profile.headline;
            profile.email = email || profile.email;
            profile.phone = phone || profile.phone;
            profile.address = address || profile.address;
            profile.summary = summary || profile.summary;
            profile.linkedin = linkedin || profile.linkedin;
            profile.github = github || profile.github;
            profile.portfolio = portfolio || profile.portfolio;

            // Update arrays if provided
            if (experience) profile.experience = experience;
            if (education) profile.education = education;
            if (skills) profile.skills = skills;
            if (certifications) profile.certifications = certifications;

            await profile.save();

            return res.status(200).json({
                message: "Profile updated successfully",
                profile,
            });
        } else {
            // Create new profile
            profile = await Profile.create({
                userId: req.user._id,
                fullName: fullName || req.user.name,
                email: email || req.user.email,
                headline,
                phone,
                address,
                summary,
                linkedin,
                github,
                portfolio,
                experience: experience || [],
                education: education || [],
                skills: skills || [],
                certifications: certifications || [],
            });

            return res.status(201).json({
                message: "Profile created successfully",
                profile,
            });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Add experience
// @route   POST /api/v1/profile/experience
// @access  Private
const addExperience = async (req, res, next) => {
    try {
        const { company, position, startDate, endDate, description } = req.body;

        // Validate required fields
        if (!company || !position || !startDate) {
            return res.status(400).json({
                message: "Please provide company, position, and start date",
            });
        }

        let profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            // Create profile if doesn't exist
            profile = await Profile.create({
                userId: req.user._id,
                fullName: req.user.name,
                email: req.user.email,
            });
        }

        profile.experience.push({
            company,
            position,
            startDate,
            endDate,
            description: description || [],
        });

        await profile.save();

        res.status(201).json({
            message: "Experience added successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update experience
// @route   PUT /api/v1/profile/experience/:experienceId
// @access  Private
const updateExperience = async (req, res, next) => {
    try {
        const { experienceId } = req.params;
        const updateData = req.body;

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

        // Update fields
        Object.keys(updateData).forEach((key) => {
            experience[key] = updateData[key];
        });

        await profile.save();

        res.status(200).json({
            message: "Experience updated successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete experience
// @route   DELETE /api/v1/profile/experience/:experienceId
// @access  Private
const deleteExperience = async (req, res, next) => {
    try {
        const { experienceId } = req.params;

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        profile.experience.pull(experienceId);
        await profile.save();

        res.status(200).json({
            message: "Experience deleted successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add education
// @route   POST /api/v1/profile/education
// @access  Private
const addEducation = async (req, res, next) => {
    try {
        const { institution, degree, field, graduationYear, grade } = req.body;

        // Validate required fields
        if (!institution || !degree || !graduationYear) {
            return res.status(400).json({
                message: "Please provide institution, degree, and graduation year",
            });
        }

        let profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            profile = await Profile.create({
                userId: req.user._id,
                fullName: req.user.name,
                email: req.user.email,
            });
        }

        profile.education.push({
            institution,
            degree,
            field,
            graduationYear,
            grade,
        });

        await profile.save();

        res.status(201).json({
            message: "Education added successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update education
// @route   PUT /api/v1/profile/education/:educationId
// @access  Private
const updateEducation = async (req, res, next) => {
    try {
        const { educationId } = req.params;
        const updateData = req.body;

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        const education = profile.education.id(educationId);

        if (!education) {
            return res.status(404).json({
                message: "Education not found",
            });
        }

        Object.keys(updateData).forEach((key) => {
            education[key] = updateData[key];
        });

        await profile.save();

        res.status(200).json({
            message: "Education updated successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete education
// @route   DELETE /api/v1/profile/education/:educationId
// @access  Private
const deleteEducation = async (req, res, next) => {
    try {
        const { educationId } = req.params;

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        profile.education.pull(educationId);
        await profile.save();

        res.status(200).json({
            message: "Education deleted successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add skill
// @route   POST /api/v1/profile/skills
// @access  Private
const addSkill = async (req, res, next) => {
    try {
        const { name, level } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Please provide skill name",
            });
        }

        let profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            profile = await Profile.create({
                userId: req.user._id,
                fullName: req.user.name,
                email: req.user.email,
            });
        }

        profile.skills.push({ name, level });
        await profile.save();

        res.status(201).json({
            message: "Skill added successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete skill
// @route   DELETE /api/v1/profile/skills/:skillId
// @access  Private
const deleteSkill = async (req, res, next) => {
    try {
        const { skillId } = req.params;

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found",
            });
        }

        profile.skills.pull(skillId);
        await profile.save();

        res.status(200).json({
            message: "Skill deleted successfully",
            profile,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
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
};
