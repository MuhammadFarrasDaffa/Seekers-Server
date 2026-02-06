// models/Question.js
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    level: { type: String, required: true },
    type: { type: String, enum: ["intro", "core", "closing"], required: true },
    content: { type: String, required: true, maxlength: 1000 },
    followUp: { type: Boolean, default: false },
    audioUrl: { type: String, default: "" },
}, {
    timestamps: true
});

module.exports = mongoose.model("Question", questionSchema);
