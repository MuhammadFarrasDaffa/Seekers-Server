const { Schema, model } = require("mongoose");

const adminAIUsageDetailSchema = new Schema({
  functionName: {
    type: String,
    required: true,
    enum: [
      "createQuestion_generateVoice",
      "updateQuestion_generateVoice", 
      "createBulkQuestions_generateQuestions",
      "insertBulkQuestions_generateVoices",
      "generateVoice_standalone"
    ]
  },
  promptTokens: { type: Number, default: 0 },
  candidatesTokens: { type: Number, default: 0 },
  thoughtsTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  model: { type: String, default: "gemini-2.0-flash" },
  elevenLabsCharacters: { type: Number, default: 0 },
  elevenLabsCost: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const adminAIUsageLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    operation: {
      type: String,
      required: true,
      enum: [
        "create_single_question",
        "update_question", 
        "generate_bulk_questions",
        "insert_bulk_questions",
        "standalone_voice_generation"
      ]
    },
    // Gemini token tracking
    totalTokensUsed: { type: Number, default: 0 },
    totalGeminiCost: { type: Number, default: 0 },
    
    // ElevenLabs tracking
    totalElevenLabsCharacters: { type: Number, default: 0 },
    totalElevenLabsCost: { type: Number, default: 0 },
    
    // Total cost across all AI services
    totalCostUSD: { type: Number, default: 0 },
    
    // Question context
    questionContext: {
      categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
      level: { type: String, enum: ["junior", "middle", "senior"] },
      type: { type: String, enum: ["intro", "core", "closing"] },
      questionId: { type: Schema.Types.ObjectId, ref: "Question" },
      questionCount: { type: Number }, // For bulk operations
      operation: { type: String } // Detailed operation description
    },
    
    // Detailed breakdown of each AI service call
    details: [adminAIUsageDetailSchema],
    
    // Metadata
    completedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
adminAIUsageLogSchema.index({ userId: 1, createdAt: -1 });
adminAIUsageLogSchema.index({ operation: 1 });
adminAIUsageLogSchema.index({ "questionContext.categoryId": 1 });

module.exports = model("AdminAIUsageLog", adminAIUsageLogSchema);
