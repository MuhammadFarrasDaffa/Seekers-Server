// models/Interview.js
const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    category: { type: String, required: true },
    level: { type: String, required: true },
    tier: { type: String, required: true },
    questions: { type: [String], default: [] },
    answers: { type: [String], default: [] },
    completedAt: { type: Date, default: Date.now },
    evaluated: { type: Boolean, default: false },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
    evaluatedAt: { type: Date },
});

module.exports = mongoose.model("Interview", interviewSchema);
