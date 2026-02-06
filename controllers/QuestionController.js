const Question = require("../models/Question");
const Category = require("../models/Category");
const CategoryController = require("./CategoryController");
const { ObjectId } = require("mongodb");
const { GoogleGenAI } = require("@google/genai");
const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const cloudinary = require("cloudinary").v2;

// Add TokenUsageLog import
const TokenUsageLog = require("../models/TokenUsageLog");

// Add AdminAIUsageLog import
const AdminAIUsageLog = require("../models/AdminAIUsageLog");

// Add cost calculation utilities (same as InterviewController)
const AI_COST_RATES = {
  // Gemini 2.0 Flash pricing (standard < 128k context)
  GEMINI_INPUT_COST_PER_1M: 0.10,
  GEMINI_OUTPUT_COST_PER_1M: 0.40,

  // ElevenLabs pricing (per character)
  // Paket $22 = 100,000 credits, 1 character = 1 credit
  // $22 / 100,000 = $0.00022 per character
  ELEVENLABS_COST_PER_CHAR: 0.00022, // $0.00022 per character
};

// Cost calculation utilities class
class CostCalculator {
  static calculateGeminiCost(promptTokens, outputTokens) {
    const inputCost = (promptTokens / 1000000) * AI_COST_RATES.GEMINI_INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1000000) * AI_COST_RATES.GEMINI_OUTPUT_COST_PER_1M;
    return inputCost + outputCost;
  }

  static calculateElevenLabsCost(characters) {
    return characters * AI_COST_RATES.ELEVENLABS_COST_PER_CHAR;
  }
}

// Configure services
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = class QuestionController {
    // QUESTION SECTION
    static async getAllQuestions(req, res, next) {
        try {
            const questions = await Question.find().populate('categoryId', 'title').sort({ createdAt: -1 });
            res.status(200).json({
                success: true,
                questions
            });
        } catch (error) {
            console.error("Error fetching questions:", error);
            next(error);
        }
    }

    // QUESTIONS COUNT FOR CATEGORY + LEVEL
    static async getQuestionCount(req, res, next) {
        try {
            const { categoryId, level } = req.query;

            if (!categoryId || !level) {
                return res.status(400).json({ message: "categoryId and level are required" });
            }

            const count = await Question.find({
                categoryId: new ObjectId(categoryId),
                level: String(level)
            });

            res.status(200).json({ count: count.length });
        } catch (error) {
            next(error);
        }
    }

    // New CRUD methods
    static async createQuestion(req, res, next) {
        try {
            const { categoryId, level, type, content, followUp, audioUrl } = req.body;

            let finalAudioUrl = audioUrl || "";
            let voiceGenerated = false;
            let elevenLabsCost = 0;

            // Generate voice if content is provided and no audioUrl
            if (content && !audioUrl) {
                try {
                    const voiceResult = await QuestionController.generateVoiceForText(content, true);
                    finalAudioUrl = voiceResult.audioUrl;
                    voiceGenerated = true;
                    
                    // Track ElevenLabs costs
                    if (voiceResult.costMetrics) {
                        elevenLabsCost = voiceResult.costMetrics.cost;
                        
                        // Log admin AI usage
                        await QuestionController.logAdminAIUsage(
                            req.user?.id,
                            "create_single_question",
                            {
                                categoryId: categoryId,
                                level: level,
                                type: type,
                                operation: "createQuestion_generateVoice"
                            },
                            [],
                            0,
                            voiceResult.costMetrics.characters,
                            elevenLabsCost
                        );
                    }
                } catch (voiceError) {
                    console.error("Failed to generate voice for new question:", voiceError);
                    // Continue without voice generation
                }
            }

            const question = await Question.create({
                categoryId,
                level,
                type,
                content,
                followUp: followUp || false,
                audioUrl: finalAudioUrl
            });

            // Update category level if ready
            await CategoryController.updateCategoryLevelIfReady(categoryId, level);

            res.status(201).json({
                success: true,
                message: "Question created successfully!",
                question,
                voiceGenerated,
                elevenLabsCost: voiceGenerated ? elevenLabsCost : 0
            });
        } catch (error) {
            console.error("Error creating question:", error);
            next(error);
        }
    }

    static async getQuestionById(req, res, next) {
        try {
            const { id } = req.params;
            const question = await Question.findById(id).populate('categoryId', 'title');

            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            res.status(200).json({
                success: true,
                question
            });
        } catch (error) {
            console.error("Error fetching question:", error);
            next(error);
        }
    }

    static async updateQuestion(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Get existing question to check if content is being changed
            const existingQuestion = await Question.findById(id);
            if (!existingQuestion) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            // 🔒 PENGAMAN: Check if content actually changed
            const contentChanged = updateData.content && 
                                 updateData.content.trim() !== existingQuestion.content.trim();
            
            let voiceUpdated = false;
            let voiceGenerationMessage = "";
            let elevenLabsCost = 0;

            if (contentChanged) {
                console.log(`🎤 Content changed for question ${id}:`);
                console.log(`   Old: "${existingQuestion.content}"`);
                console.log(`   New: "${updateData.content}"`);
                console.log(`🔄 Generating new voice...`);
                
                try {
                    // Generate new voice for updated content with cost tracking
                    const voiceResult = await QuestionController.generateVoiceForText(updateData.content, true);
                    updateData.audioUrl = voiceResult.audioUrl;
                    voiceUpdated = true;
                    voiceGenerationMessage = " with new voice";
                    console.log(`✅ New voice generated successfully: ${voiceResult.audioUrl}`);
                    
                    // Track ElevenLabs costs
                    if (voiceResult.costMetrics) {
                        elevenLabsCost = voiceResult.costMetrics.cost;
                        
                        // Log admin AI usage
                        await QuestionController.logAdminAIUsage(
                            req.user?.id,
                            "update_question",
                            {
                                questionId: id,
                                categoryId: existingQuestion.categoryId,
                                level: existingQuestion.level,
                                type: existingQuestion.type,
                                operation: "updateQuestion_generateVoice"
                            },
                            [],
                            0,
                            voiceResult.costMetrics.characters,
                            elevenLabsCost
                        );
                    }
                } catch (voiceError) {
                    console.error(`❌ Failed to generate new voice for question ${id}:`, voiceError);
                    voiceGenerationMessage = " (voice generation failed)";
                    console.log(`⚠️ Continuing update without new voice...`);
                }
            } else {
                console.log(`🛡️ No content change detected for question ${id}, skipping voice generation`);
                if (updateData.content) {
                    console.log(`   Content remains: "${existingQuestion.content}"`);
                }
            }

            const question = await Question.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).populate('categoryId', 'title');

            res.status(200).json({
                success: true,
                message: `Question updated successfully${voiceGenerationMessage}!`,
                question,
                voiceUpdated,
                contentChanged,
                elevenLabsCost: voiceUpdated ? elevenLabsCost : 0,
                debugInfo: {
                    originalContent: existingQuestion.content,
                    newContent: updateData.content || existingQuestion.content,
                    contentLengthChanged: existingQuestion.content.length !== (updateData.content || existingQuestion.content).length
                }
            });
        } catch (error) {
            console.error("Error updating question:", error);
            next(error);
        }
    }

    static async deleteQuestion(req, res, next) {
        try {
            const { id } = req.params;

            const question = await Question.findByIdAndDelete(id);

            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Question with ID '${id}' deleted successfully!`
            });
        } catch (error) {
            console.error("Error deleting question:", error);
            next(error);
        }
    }

    // Bulk operations - Generate questions using Gemini AI
    static async createBulkQuestions(req, res, next) {
        try {
            const { categoryId, level, type, count = 10 } = req.body;

            // Validation
            if (!categoryId || !level || !type) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: categoryId, level, type"
                });
            }

            const VALID_LEVELS = ["junior", "middle", "senior"];
            const VALID_TYPES = ["intro", "core", "closing"];

            if (!VALID_LEVELS.includes(level)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid level value. Must be one of: ${VALID_LEVELS.join(", ")}`
                });
            }

            if (!VALID_TYPES.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid type value. Must be one of: ${VALID_TYPES.join(", ")}`
                });
            }

            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({
                    success: false,
                    message: "Gemini API key is not configured."
                });
            }

            // Initialize Gemini AI
            const genAI = new GoogleGenAI({});

            const prompt = `Anda adalah seorang pewawancara ahli yang sedang menyusun pertanyaan wawancara teknis. Buatlah tepat ${count} pertanyaan wawancara yang unik berdasarkan parameter berikut.

Parameter:
- Level: ${level}
- Tipe: ${type}
- Panjang pertanyaan: 100-120 karakter per pertanyaan (WAJIB)

ATURAN PANJANG KARAKTER:
- Setiap pertanyaan HARUS memiliki panjang antara 100-120 karakter
- Jika terlalu pendek, tambahkan detail atau konteks
- Jika terlalu panjang, ringkas tanpa menghilangkan makna
- Hitung karakter termasuk spasi dan tanda baca

Kembalikan HANYA dalam bentuk array JSON yang valid tanpa format markdown, blok kode, atau teks tambahan. Gunakan struktur persis seperti ini:
[
  {
    "content": "teks pertanyaan di sini dengan panjang 100-120 karakter",
    "followUp": true atau false
  }
]

Pastikan setiap pertanyaan:
- Unik dan relevan dengan level dan tipe yang ditentukan
- Sesuai untuk wawancara teknis
- Memiliki panjang TEPAT 100-120 karakter
- Field followUp bernilai true jika pertanyaan dirancang untuk memiliki pertanyaan lanjutan

Hasilkan ${count} pertanyaan sekarang dengan panjang karakter yang TEPAT:`;

            // Call Gemini API
            const response = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt,
            });

            // Log Gemini token usage for bulk generation
            if (response?.usageMetadata) {
                const geminiDetail = {
                    functionName: "createBulkQuestions_generateQuestions",
                    promptTokens: response.usageMetadata.promptTokenCount || 0,
                    candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
                    thoughtsTokens: response.usageMetadata.thoughtsTokenCount || 0,
                    totalTokens: response.usageMetadata.totalTokenCount || 0,
                    model: "gemini-2.0-flash",
                    elevenLabsCharacters: 0,
                    elevenLabsCost: 0,
                    timestamp: new Date(),
                };

                const geminiCost = CostCalculator.calculateGeminiCost(
                    geminiDetail.promptTokens,
                    geminiDetail.candidatesTokens + geminiDetail.thoughtsTokens
                );

                await QuestionController.logAdminAIUsage(
                    req.user?.id,
                    "generate_bulk_questions",
                    {
                        categoryId: categoryId,
                        level: level,
                        type: type,
                        questionCount: count,
                        operation: "createBulkQuestions_generateQuestions"
                    },
                    [geminiDetail],
                    geminiDetail.totalTokens,
                    0,
                    0,
                    geminiCost
                );
            }

            if (!response.text) {
                return res.status(500).json({
                    success: false,
                    message: "No response from Gemini"
                });
            }

            // Parse the response
            let generatedQuestions;
            try {
                // Remove markdown code blocks if present
                const cleanedResponse = response.text
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();

                generatedQuestions = JSON.parse(cleanedResponse);
            } catch (parseError) {
                return res.status(500).json({
                    success: false,
                    message: `Failed to parse Gemini response: ${parseError.message}`
                });
            }

            // Validate character length for each question
            const invalidQuestions = generatedQuestions.filter(q => {
                const length = q.content.length;
                return length < 100 || length > 120;
            });

            if (invalidQuestions.length > 0) {
                console.warn(`Warning: ${invalidQuestions.length} questions don't meet character length requirement (100-120 chars)`);
                // Log the invalid questions for debugging
                invalidQuestions.forEach((q, index) => {
                    console.warn(`Question ${index + 1} length: ${q.content.length} chars - "${q.content}"`);
                });
            }

            // Validate we got the right number of questions
            if (!Array.isArray(generatedQuestions) || generatedQuestions.length !== count) {
                return res.status(500).json({
                    success: false,
                    message: `Expected ${count} questions but got ${generatedQuestions?.length || 0}`
                });
            }

            // Calculate total characters for cost estimation
            const totalCharacters = generatedQuestions.reduce((sum, q) => sum + q.content.length, 0);
            const estimatedElevenLabsCost = CostCalculator.calculateElevenLabsCost(totalCharacters);

            // Return generated questions without inserting to database
            // Questions will be inserted later via insertBulkQuestions endpoint when user submits
            const questionsWithMetadata = generatedQuestions.map(q => ({
                categoryId,
                level,
                type,
                content: q.content,
                followUp: q.followUp,
            }));

            res.status(201).json({
                success: true,
                message: `${count} questions generated successfully!`,
                generated: questionsWithMetadata.length,
                total: count,
                questions: questionsWithMetadata,
                costEstimation: {
                    totalCharacters,
                    estimatedElevenLabsCost: estimatedElevenLabsCost.toFixed(6)
                }
            });

        } catch (error) {
            console.error("Error generating bulk questions:", error);
            next(error);
        }
    }

    // Insert bulk questions with voice generation
    static async insertBulkQuestions(req, res, next) {
        try {
            const { questions } = req.body;

            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Questions array is required and cannot be empty"
                });
            }

            const created = [];
            const errors = [];
            let totalVoiceCharacters = 0;
            let totalElevenLabsCost = 0;
            const voiceDetails = [];

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                try {
                    // Generate voice for each question with cost tracking
                    let audioUrl = "";
                    if (q.content) {
                        try {
                            const voiceResult = await QuestionController.generateVoiceForText(q.content, true);
                            audioUrl = voiceResult.audioUrl;
                            
                            // Track voice generation costs
                            if (voiceResult.costMetrics) {
                                totalVoiceCharacters += voiceResult.costMetrics.characters;
                                totalElevenLabsCost += voiceResult.costMetrics.cost;
                                
                                // Add detail for each voice generation
                                voiceDetails.push({
                                    functionName: "insertBulkQuestions_generateVoices",
                                    promptTokens: 0,
                                    candidatesTokens: 0,
                                    thoughtsTokens: 0,
                                    totalTokens: 0,
                                    model: "eleven_multilingual_v2",
                                    elevenLabsCharacters: voiceResult.costMetrics.characters,
                                    elevenLabsCost: voiceResult.costMetrics.cost,
                                    timestamp: new Date(),
                                });
                            }
                        } catch (voiceError) {
                            console.error(`Failed to generate voice for question ${i}:`, voiceError);
                            // Continue without audio URL if voice generation fails
                        }
                    }

                    // Create question with audio URL
                    const question = await Question.create({
                        categoryId: new ObjectId(q.categoryId),
                        level: q.level,
                        type: q.type,
                        content: q.content,
                        followUp: q.followUp || false,
                        audioUrl: audioUrl
                    });

                    created.push(question);

                    // Update category level if ready
                    await CategoryController.updateCategoryLevelIfReady(q.categoryId, q.level);
                    
                } catch (err) {
                    errors.push({
                        index: i,
                        error: err.message,
                        question: q,
                    });
                }
            }

            // Log aggregated ElevenLabs usage for bulk voice generation
            if (totalVoiceCharacters > 0) {
                await QuestionController.logAdminAIUsage(
                    req.user?.id,
                    "insert_bulk_questions",
                    {
                        questionCount: created.length,
                        categoryId: questions[0]?.categoryId,
                        level: questions[0]?.level,
                        type: questions[0]?.type,
                        operation: "insertBulkQuestions_generateVoices"
                    },
                    voiceDetails,
                    0,
                    totalVoiceCharacters,
                    totalElevenLabsCost
                );
            }

            res.status(errors.length ? 207 : 201).json({
                success: errors.length === 0,
                message: `${created.length} questions inserted successfully!`,
                inserted: created.length,
                total: questions.length,
                questions: created,
                errors: errors.length ? errors : undefined,
                voiceGeneration: {
                    totalCharacters: totalVoiceCharacters,
                    totalCost: totalElevenLabsCost.toFixed(6)
                }
            });

        } catch (error) {
            console.error("Error inserting bulk questions:", error);
            next(error);
        }
    }

    // Generate voice for text using ElevenLabs
    static async generateVoice(req, res, next) {
        try {
            const { text } = req.body;

            if (!text) {
                return res.status(400).json({
                    success: false,
                    message: "Text is required"
                });
            }

            const result = await QuestionController.generateVoiceForText(text, true);

            // Log standalone voice generation
            if (result.costMetrics) {
                await QuestionController.logAdminAIUsage(
                    req.user?.id,
                    "standalone_voice_generation",
                    {
                        operation: "generateVoice_standalone"
                    },
                    [],
                    0,
                    result.costMetrics.characters,
                    result.costMetrics.cost
                );
            }

            res.status(200).json({
                success: true,
                message: "Voice generated successfully!",
                audioUrl: result.audioUrl,
                costMetrics: result.costMetrics
            });

        } catch (error) {
            console.error("Error generating voice:", error);
            next(error);
        }
    }

    // Helper method to generate voice for text
    static async generateVoiceForText(text, trackCosts = false) {
        if (!process.env.ELEVENLABS_API_KEY) {
            throw new Error("ElevenLabs API key is not configured.");
        }

        try {
            // Calculate cost before API call
            const characterCount = text.length;
            const elevenLabsCost = trackCosts ? CostCalculator.calculateElevenLabsCost(characterCount) : 0;

            if (trackCosts) {
                console.log(`[ELEVENLABS COST] Characters: ${characterCount}, Estimated cost: $${elevenLabsCost.toFixed(6)}`);
            }

            // Generate speech using ElevenLabs
            const voiceId = "hpp4J3VqNfWAUOO0d1Us"; // Default voice ID
            const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
                text: text,
                modelId: "eleven_multilingual_v2",
                outputFormat: "mp3_44100_128",
            });

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);

            // Upload to Cloudinary
            const audioUrl = await QuestionController.uploadToCloudinary(audioBuffer);

            // Return with cost metrics if tracking enabled
            return { 
                audioUrl,
                costMetrics: trackCosts ? {
                    characters: characterCount,
                    cost: elevenLabsCost
                } : null
            };

        } catch (error) {
            throw new Error(`Failed to generate voice: ${error.message}`);
        }
    }

    // Helper method to upload buffer to Cloudinary
    static async uploadToCloudinary(buffer) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "video", // mp3 files are uploaded as video type
                    folder: "question-audio",
                    format: "mp3",
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );

            uploadStream.end(buffer);
        });
    }

    // New admin AI usage logging method
    static async logAdminAIUsage(
        userId, 
        operation, 
        questionContext, 
        details = [], 
        totalTokens = 0, 
        totalElevenLabsCharacters = 0, 
        totalElevenLabsCost = 0,
        totalGeminiCost = 0
    ) {
        try {
            const totalCostUSD = totalGeminiCost + totalElevenLabsCost;

            // Log to console for monitoring
            console.log(`[ADMIN AI COST TRACKING] ${operation}:`);
            if (totalTokens > 0) {
                console.log(`  Gemini - Tokens: ${totalTokens}, Cost: $${totalGeminiCost.toFixed(6)}`);
            }
            if (totalElevenLabsCharacters > 0) {
                console.log(`  ElevenLabs - Characters: ${totalElevenLabsCharacters}, Cost: $${totalElevenLabsCost.toFixed(6)}`);
            }
            console.log(`  TOTAL COST: $${totalCostUSD.toFixed(6)}`);

            // Create admin AI usage log
            const adminUsageLog = await AdminAIUsageLog.create({
                userId: userId,
                operation: operation,
                totalTokensUsed: totalTokens,
                totalGeminiCost: totalGeminiCost,
                totalElevenLabsCharacters: totalElevenLabsCharacters,
                totalElevenLabsCost: totalElevenLabsCost,
                totalCostUSD: totalCostUSD,
                questionContext: questionContext,
                details: details,
                completedAt: new Date()
            });

            console.log(`[ADMIN AI LOG] Created usage log for ${operation}, ID: ${adminUsageLog._id}`);
            return adminUsageLog;
        } catch (error) {
            console.error("Error logging admin AI usage:", error);
            // Don't throw error to avoid breaking the main flow
        }
    }
}