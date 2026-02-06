const mongoose = require("mongoose");

const tokenUsageDetailSchema = new mongoose.Schema(
    {
        functionName: {
            type: String,
            required: true,
            enum: ["evaluateInterviewById", "evaluateInterview", "responseToAnswer", "completeInterview", "transcribeAudio"],
        },
        promptTokens: {
            type: Number,
            required: true,
        },
        candidatesTokens: {
            type: Number,
            required: true,
        },
        thoughtsTokens: {
            type: Number,
            default: 0,
        },
        totalTokens: {
            type: Number,
            required: true,
        },
        model: {
            type: String,
            default: "gemini-2.0-flash",
        },
        // ElevenLabs cost tracking
        elevenLabsCharacters: {
            type: Number,
            default: 0,
        },
        elevenLabsCost: {
            type: Number,
            default: 0,
        },
        // Whisper cost tracking
        whisperDurationSeconds: {
            type: Number,
            default: 0,
        },
        whisperCost: {
            type: Number,
            default: 0,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    }
);

const tokenUsageLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // New interview-based fields (optional for backward compatibility)
        interviewId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Interview",
        },
        category: {
            type: String,
        },
        level: {
            type: String,
        },
        tier: {
            type: String,
        },
        totalTokensUsed: {
            type: Number,
            default: 0,
        },
        // Aggregated cost tracking
        totalElevenLabsCharacters: {
            type: Number,
            default: 0,
        },
        totalElevenLabsCost: {
            type: Number,
            default: 0,
        },
        totalWhisperDurationSeconds: {
            type: Number,
            default: 0,
        },
        totalWhisperCost: {
            type: Number,
            default: 0,
        },
        totalCostUSD: {
            type: Number,
            default: 0,
        },
        details: [tokenUsageDetailSchema],
        completedAt: {
            type: Date,
        },
        isTemporary: {
            type: Boolean,
            default: false,
        },

        // Old individual fields (for backward compatibility and standalone usage)
        functionName: {
            type: String,
            enum: ["evaluateInterviewById", "evaluateInterview", "responseToAnswer", "completeInterview", "transcribeAudio"],
        },
        promptTokens: {
            type: Number,
        },
        candidatesTokens: {
            type: Number,
        },
        thoughtsTokens: {
            type: Number,
            default: 0,
        },
        totalTokens: {
            type: Number,
        },
        model: {
            type: String,
            default: "gemini-2.0-flash",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("TokenUsageLog", tokenUsageLogSchema);
