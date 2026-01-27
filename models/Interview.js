// models/Interview.js
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
    _id: String,
    content: String,
    type: String,
    level: String,
    followUp: Boolean
}, { _id: false });

const answerSchema = new mongoose.Schema({
    questionId: String,
    question: String,
    transcription: String,
    duration: Number,
    isFollowUp: Boolean,
    acknowledgment: String
}, { _id: false });

const interviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    category: { type: String, required: true },
    level: { type: String, required: true },
    tier: { type: String, required: true },
    questions: { type: [questionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },
    completedAt: { type: Date, default: Date.now },
    evaluated: { type: Boolean, default: false },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
    evaluatedAt: { type: Date },
});

module.exports = mongoose.model("Interview", interviewSchema);
