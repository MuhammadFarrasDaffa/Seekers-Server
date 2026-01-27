const User = require("../models/User");

const getProfile = async (req, res, next) => {
  try {
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      profile: user.profile,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        token: user.token,
      },
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
      title,
      email,
      phone,
      location,
      summary,
      linkedIn,
      github,
      portfolio,
      experience,
      education,
      skills,
      certifications,
      aiSummary,
    } = req.body;

    // Find existing user
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Update profile fields
    if (fullName !== undefined) user.profile.fullName = fullName;
    if (title !== undefined) user.profile.title = title;
    if (email !== undefined) user.profile.email = email;
    if (phone !== undefined) user.profile.phone = phone;
    if (location !== undefined) user.profile.location = location;
    if (summary !== undefined) user.profile.summary = summary;
    if (linkedIn !== undefined) user.profile.linkedIn = linkedIn;
    if (github !== undefined) user.profile.github = github;
    if (portfolio !== undefined) user.profile.portfolio = portfolio;
    if (aiSummary !== undefined) user.profile.aiSummary = aiSummary;

    // Update arrays if provided
    if (experience !== undefined) user.profile.experience = experience;
    if (education !== undefined) user.profile.education = education;
    if (skills !== undefined) user.profile.skills = skills;
    if (certifications !== undefined)
      user.profile.certifications = certifications;

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: user.profile,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add experience
// @route   POST /api/v1/profile/experience
// @access  Private
const addExperience = async (req, res, next) => {
  try {
    const { company, position, startDate, endDate, description, isCurrent } =
      req.body;

    // Validate required fields
    if (!company || !position || !startDate) {
      return res.status(400).json({
        message: "Please provide company, position, and start date",
      });
    }

    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.experience.push({
      company,
      position,
      startDate,
      endDate,
      isCurrent: isCurrent || false,
      description: description || [],
    });

    await user.save();

    res.status(201).json({
      message: "Experience added successfully",
      profile: user.profile,
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

    // Update fields
    Object.keys(updateData).forEach((key) => {
      experience[key] = updateData[key];
    });

    await user.save();

    res.status(200).json({
      message: "Experience updated successfully",
      profile: user.profile,
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

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.experience.pull(experienceId);
    await user.save();

    res.status(200).json({
      message: "Experience deleted successfully",
      profile: user.profile,
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
    const {
      institution,
      degree,
      fieldOfStudy,
      grade,
      startDate,
      endDate,
      description,
    } = req.body;

    // Validate required fields
    if (!institution || !degree) {
      return res.status(400).json({
        message: "Please provide institution and degree",
      });
    }

    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.education.push({
      institution,
      degree,
      fieldOfStudy,
      grade,
      startDate,
      endDate,
      description,
    });

    await user.save();

    res.status(201).json({
      message: "Education added successfully",
      profile: user.profile,
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

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const education = user.profile.education.id(educationId);

    if (!education) {
      return res.status(404).json({
        message: "Education not found",
      });
    }

    Object.keys(updateData).forEach((key) => {
      education[key] = updateData[key];
    });

    await user.save();

    res.status(200).json({
      message: "Education updated successfully",
      profile: user.profile,
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

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.education.pull(educationId);
    await user.save();

    res.status(200).json({
      message: "Education deleted successfully",
      profile: user.profile,
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

    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.skills.push({ name, level });
    await user.save();

    res.status(201).json({
      message: "Skill added successfully",
      profile: user.profile,
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

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profile.skills.pull(skillId);
    await user.save();

    res.status(200).json({
      message: "Skill deleted successfully",
      profile: user.profile,
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
