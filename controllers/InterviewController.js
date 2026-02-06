const { GoogleGenAI } = require("@google/genai");

const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const { ObjectId } = require("mongodb");

const AI_COST_RATES = {
  // Gemini 2.0 Flash pricing (standard < 128k context)
  GEMINI_INPUT_COST_PER_1M: 0.10,
  GEMINI_OUTPUT_COST_PER_1M: 0.40,

  // ElevenLabs pricing (per character)
  // Paket $22 = 100,000 credits, 1 character = 1 credit
  // $22 / 100,000 = $0.00022 per character
  ELEVENLABS_COST_PER_CHAR: 0.00022, // $0.00022 per character

  // Whisper pricing (per second)
  // $0.0015 per minute = $0.0015 / 60 = $0.000025 per second
  WHISPER_COST_PER_SECOND: 0.000025, // $0.000025 per second ($0.0015 per minute)
};

// Global memory storage for token usage buffer (per user session)
const tokenUsageBuffer = new Map();

// Cost calculation utilities
class CostCalculator {
  static calculateGeminiCost(promptTokens, outputTokens) {
    const inputCost = (promptTokens / 1000000) * AI_COST_RATES.GEMINI_INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1000000) * AI_COST_RATES.GEMINI_OUTPUT_COST_PER_1M;
    return inputCost + outputCost;
  }

  static calculateElevenLabsCost(characters) {
    return characters * AI_COST_RATES.ELEVENLABS_COST_PER_CHAR;
  }

  static calculateWhisperCost(durationSeconds) {
    return durationSeconds * AI_COST_RATES.WHISPER_COST_PER_SECOND;
  }

  static getAudioDuration(audioBuffer) {
    // Improved audio duration estimation
    const bufferSizeBytes = audioBuffer.length;

    // More realistic estimation for various audio formats
    // Assume average bitrate of 64kbps (8KB/second) for voice recordings
    // This is more typical for voice audio than 128kbps music
    const estimatedDurationSeconds = bufferSizeBytes / 8192; // 8KB per second
    const roundedDuration = Math.max(3, Math.round(estimatedDurationSeconds)); // Minimum 3 seconds for voice

    console.log(`[AUDIO DURATION] Buffer size: ${bufferSizeBytes} bytes, Estimated: ${estimatedDurationSeconds.toFixed(2)}s, Rounded: ${roundedDuration}s`);

    return roundedDuration;
  }
}

const Question = require("../models/Question");
const Interview = require("../models/Interview");
const User = require("../models/User");
const Tier = require("../models/Tier");
const TokenUsageLog = require("../models/TokenUsageLog");

module.exports = class InterviewController {
  static async getStart(req, res, next) {
    const { categoryId, level, tier, tokenUsage } = req.body;

    // Validasi input
    if (!level || !categoryId || !tier || !tokenUsage) {
      return res.status(400).json({
        message: "Level, categoryId, tier, dan token harus disediakan",
      });
    }

    // check token user
    const userToken = await User.findById(req.user.id).then(
      (user) => user.token,
    );

    if (userToken < tokenUsage) {
      return res.status(403).json({
        message: "Token tidak cukup, silakan top up token Anda.",
      });
    }

    try {
      // Ambil data tier dari database untuk mendapatkan jumlah pertanyaan
      console.log("🔍 Searching tier:", tier);

      // Debug: Lihat semua tier yang ada di database
      const allTiers = await Tier.find({});
      console.log(
        "📋 All tiers in database:",
        allTiers.map((t) => ({ title: t.title, quota: t.quota })),
      );

      const tierData = await Tier.findOne({
        title: new RegExp(tier, "i"),
      });

      console.log("📊 Tier data found:", tierData);

      if (!tierData) {
        return res.status(400).json({
          message: `Tier "${tier}" tidak ditemukan di database`,
        });
      }

      const totalQuestions = tierData.quota;
      console.log("📝 Total questions from quota:", totalQuestions);

      // Hitung jumlah core questions (total - 1 intro - 1 closing)
      const coreQuestionsCount = totalQuestions - 2;

      if (coreQuestionsCount < 0) {
        return res.status(400).json({
          message: "Total pertanyaan tier terlalu kecil (minimum 2)",
        });
      }

      const questions = await Question.find({
        categoryId: new ObjectId(categoryId),
        level: level,
      }).populate("categoryId", "title");

      // console.log(questions)

      // Ambil pertanyaan secara acak: 1 intro + N core + 1 closing
      const data = [
        ...questions
          .filter((q) => q.type === "intro")
          .sort(() => 0.5 - Math.random())
          .slice(0, 1),
        ...questions
          .filter((q) => q.type === "core")
          .sort(() => 0.5 - Math.random())
          .slice(0, coreQuestionsCount),
        ...questions
          .filter((q) => q.type === "closing")
          .sort(() => 0.5 - Math.random())
          .slice(0, 1),
      ];

      // Transform data untuk mengganti categoryId dengan category title
      const transformedData = data.map((q) => ({
        _id: q._id,
        categoryId: q.categoryId._id,
        category: { title: q.categoryId.title },
        level: q.level,
        type: q.type,
        content: q.content,
        followUp: q.followUp,
        audioUrl: q.audioUrl,
      }));

      // update token user
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { token: -tokenUsage },
      });

      res.status(201).json(transformedData);
    } catch (error) {
      next(error);
    }
  }

  static async answerQuestion(req, res, next) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "Tolong upload file audio" });
      }

      // Panggil fungsi transcribe dengan cost tracking
      const transcriptionResult = await InterviewController.transcribeAudio(file, true);
      const transcriptionText = transcriptionResult.text || transcriptionResult; // Handle both old and new format

      // Log Whisper costs if available and add to buffer
      if (transcriptionResult.costMetrics) {
        console.log(`[WHISPER USAGE] Duration: ${transcriptionResult.costMetrics.durationSeconds}s, Cost: $${transcriptionResult.costMetrics.cost.toFixed(6)}`);

        // Add Whisper costs to user's buffer for aggregation
        const userId = req.user?.id;
        if (userId) {
          const userIdStr = userId.toString();
          if (!tokenUsageBuffer.has(userIdStr)) {
            tokenUsageBuffer.set(userIdStr, []);
          }

          // Add a special entry for Whisper transcription
          const whisperDetail = {
            functionName: "transcribeAudio",
            promptTokens: 0,
            candidatesTokens: 0,
            thoughtsTokens: 0,
            totalTokens: 0,
            model: "whisper-v3",
            elevenLabsCharacters: 0,
            elevenLabsCost: 0,
            whisperDurationSeconds: transcriptionResult.costMetrics.durationSeconds,
            whisperCost: transcriptionResult.costMetrics.cost,
            timestamp: new Date(),
          };

          tokenUsageBuffer.get(userIdStr).push(whisperDetail);

          console.log(`[WHISPER BUFFERED] User: ${userIdStr}, Duration: ${whisperDetail.whisperDurationSeconds}s, Cost: $${whisperDetail.whisperCost.toFixed(6)}, Buffer size: ${tokenUsageBuffer.get(userIdStr).length}`);
        }
      }

      res.status(200).json({
        message: "Success transcribe audio",
        transcription: transcriptionText,
        costMetrics: transcriptionResult.costMetrics, // Include cost info in response for debugging
      });
    } catch (error) {
      console.error("Error Transcribe:", error.message);
      next(error);
    }
  }

  static async saveInterview(req, res, next) {
    try {
      const userId = req.user.id;

      const { categoryId, category, level, tier, questions, answers } =
        req.body;

      console.log("Received interview data:", {
        categoryId,
        category,
        level,
        tier,
        questionsCount: questions?.length,
        answersCount: answers?.length,
      });

      // Validasi input
      if (
        !categoryId ||
        !category ||
        !level ||
        !tier ||
        !questions ||
        !answers
      ) {
        console.log("Validation failed:", {
          categoryId: !!categoryId,
          category: !!category,
          level: !!level,
          tier: !!tier,
          questions: !!questions,
          answers: !!answers,
        });
        return res.status(400).json({
          message: "Data interview tidak lengkap",
        });
      }

      // Simpan interview ke database
      const interview = await Interview.create({
        userId,
        categoryId,
        category,
        level,
        tier,
        questions,
        answers,
      });

      console.log("Interview saved successfully:", interview._id);

      res.status(201).json({
        message: "Interview berhasil disimpan",
        interviewId: interview._id,
      });
    } catch (error) {
      console.error("Error saving interview:", error);
      next(error);
    }
  }

  static async getInterviewHistory(req, res, next) {
    try {
      const userId = req.user.id;

      // Get all interviews for the logged-in user, sorted by most recent
      const interviews = await Interview.find({ userId })
        .sort({ completedAt: -1 })
        .select(
          "categoryId category level tier completedAt evaluated evaluation questions answers",
        );

      res.status(200).json({
        success: true,
        interviews,
      });
    } catch (error) {
      console.error("Error getting interview history:", error);
      next(error);
    }
  }

  static async getInterviewById(req, res, next) {
    try {
      const { id } = req.params;

      // Validasi ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid interview ID format",
        });
      }

      const interview = await Interview.findById(id);

      if (!interview) {
        return res.status(404).json({
          message: "Interview tidak ditemukan",
        });
      }

      res.status(200).json(interview);
    } catch (error) {
      console.error("Error getting interview:", error);
      next(error);
    }
  }

  static async evaluateInterviewById(req, res, next) {
    try {
      const { id } = req.params;

      // Get interview data
      const interview = await Interview.findById(id);

      if (!interview) {
        return res.status(404).json({
          message: "Interview tidak ditemukan",
        });
      }

      // Check if already evaluated - return immediately to prevent token waste
      if (interview.evaluated && interview.evaluation) {
        console.log(`[CACHE] Interview ${id} already evaluated, returning cached result`);
        return res.status(200).json({
          success: true,
          evaluation: interview.evaluation,
        });
      }

      // ATOMIC LOCK: Try to acquire lock by setting evaluated to true
      // This prevents race condition where multiple requests evaluate the same interview
      const lockedInterview = await Interview.findOneAndUpdate(
        { _id: id, evaluated: { $ne: true } }, // Only update if not yet evaluated
        { evaluated: true, evaluatedAt: new Date() },
        { new: false } // Return original document
      );

      // If lockedInterview is null, means another request already acquired the lock
      if (!lockedInterview) {
        console.log(`[RACE CONDITION] Interview ${id} is being evaluated by another request, waiting...`);

        // Wait a bit and retry to get the evaluated result
        await new Promise(resolve => setTimeout(resolve, 2000));

        const evaluatedInterview = await Interview.findById(id);
        if (evaluatedInterview?.evaluation) {
          console.log(`[RACE CONDITION] Returning result from concurrent evaluation`);
          return res.status(200).json({
            success: true,
            evaluation: evaluatedInterview.evaluation,
          });
        }

        // If still no result after waiting, return error
        return res.status(409).json({
          message: "Interview sedang dievaluasi oleh proses lain",
        });
      }

      console.log(`[EVALUATING] Starting evaluation for interview ${id}`);

      // Get buffered token usage from memory by userId (responseToAnswer calls)  
      const userId = interview.userId?.toString();
      const userIdStr = userId; // Already string from toString()
      const bufferedTokenUsage = tokenUsageBuffer.get(userIdStr) || [];

      console.log(`[EVALUATE] User ID: ${userIdStr}`);
      console.log(`[EVALUATE] Available buffers:`, Array.from(tokenUsageBuffer.keys()));
      console.log(`[EVALUATE] Found ${bufferedTokenUsage.length} buffered responseToAnswer token entries for user ${userIdStr}`);
      const interviewData = {
        category: interview.category,
        level: interview.level,
        answers: interview.answers.map((a) => ({
          question: a.question,
          answer: a.transcription,
          duration: a.duration || 0,
        })),
      };

      const genAI = new GoogleGenAI({});

      const prompt = `
        Task: Anggap dirimu adalah seorang Interview Expert yang akan mengevaluasi hasil interview kandidat.
        
        Interview Information:
        - Position: ${interviewData.category}
        - Level: ${interviewData.level}
        - Total Questions: ${interviewData.answers.length}
        
        Questions & Answers:
        ${interviewData.answers
          .map(
            (qa, index) => `
        Q${index + 1}: ${qa.question}
        A${index + 1}: ${qa.answer}
        `,
          )
          .join("\n")}
        
        Instructions:
        Berikan evaluasi komprehensif dalam format JSON dengan struktur berikut:
        
        {
          "overallScore": <number 0-100>,
          "overallGrade": "<A+, A, A-, B+, B, B-, C+, C, C-, D, F>",
          "evaluations": [
            {
              "category": "Content Quality",
              "score": <number 0-100>,
              "maxScore": 100,
              "feedback": "<detailed feedback in Indonesian>",
              "strengths": ["<strength 1>", "<strength 2>", ...],
              "improvements": ["<improvement 1>", "<improvement 2>", ...]
            },
            {
              "category": "Communication Skills",
              ...
            },
            {
              "category": "Relevance & Focus",
              ...
            },
            {
              "category": "Problem Solving Approach",
              ...
            },
            {
              "category": "Confidence & Enthusiasm",
              ...
            }
          ],
          "summary": "<overall summary in Indonesian, 2-3 sentences>",
          "recommendations": [
            "<actionable recommendation 1>",
            "<actionable recommendation 2>",
            ...
          ]
        }
        
        Evaluation Criteria:
        
        1. Content Quality (0-100):
           - Kedalaman pemahaman teknis
           - Relevansi dengan pengalaman
           - Kelengkapan jawaban
           - Penggunaan contoh konkret
           - Impact/hasil yang dijelaskan
        
        2. Communication Skills (0-100):
           - Clarity of explanation
           - Structure dan organization
           - Grammar dan vocabulary
           - Professional language usage
           - Filler words (kurangi score jika banyak)
        
        3. Relevance & Focus (0-100):
           - Menjawab pertanyaan yang diajukan
           - Tidak bertele-tele
           - Fokus pada poin penting
           - Time management
        
        4. Problem Solving Approach (0-100):
           - Systematic thinking
           - Analisis masalah
           - Alternatif solusi
           - Decision making process
           - Learning from experience
        
        5. Confidence & Enthusiasm (0-100):
           - Self-confidence
           - Enthusiasm untuk role
           - Passion untuk teknologi
           - Growth mindset
           - Positive attitude
        
        Grading Scale:
        - A+ (95-100): Exceptional
        - A (90-94): Excellent
        - A- (85-89): Very Good
        - B+ (80-84): Good
        - B (75-79): Above Average
        - B- (70-74): Average
        - C+ (65-69): Below Average
        - C (60-64): Needs Improvement
        - C- (55-59): Significant Improvement Needed
        - D (50-54): Poor
        - F (<50): Fail
        
        Rules:
        - Berikan feedback yang constructive dan actionable
        - Minimum 3 strengths dan 2 improvements per kategori
        - Recommendations harus specific dan actionable (min 5)
        - Summary harus highlight key points
        - Gunakan bahasa Indonesia yang profesional
        - Response HARUS dalam format JSON yang valid
        - Tidak boleh ada markdown formatting atau backticks
        
        Output: Return ONLY the JSON object, nothing else.
        `;

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      // Log token usage and create aggregated log with all details
      if (response?.usageMetadata) {
        // Add evaluation token usage to buffered data
        const evaluationTokenDetail = {
          functionName: "evaluateInterviewById",
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
          thoughtsTokens: response.usageMetadata.thoughtsTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
          model: "gemini-2.0-flash",
          timestamp: new Date(),
        };

        // Combine all token usage (responseToAnswer + evaluateInterviewById)
        const allTokenUsageDetails = [...bufferedTokenUsage, evaluationTokenDetail];

        // Create aggregated token usage log
        await InterviewController.logTokenUsage(
          req.user?.id,
          "completeInterview", // Indicates this is aggregated log
          {
            totalTokenCount: allTokenUsageDetails.reduce((sum, detail) => sum + detail.totalTokens, 0),
            promptTokenCount: allTokenUsageDetails.reduce((sum, detail) => sum + detail.promptTokens, 0),
            candidatesTokenCount: allTokenUsageDetails.reduce((sum, detail) => sum + detail.candidatesTokens, 0),
            thoughtsTokenCount: allTokenUsageDetails.reduce((sum, detail) => sum + detail.thoughtsTokens, 0),
          },
          {
            interviewId: id,
            category: interview.category,
            level: interview.level,
            tier: interview.tier,
            details: allTokenUsageDetails // Store individual function details
          }
        );

        // Clear memory buffer for this user since it's now aggregated
        if (bufferedTokenUsage.length > 0) {
          tokenUsageBuffer.delete(userIdStr);
          console.log(`[CLEANUP] Cleared memory buffer for user ${userIdStr} (${bufferedTokenUsage.length} entries)`);
        }

        console.log(`[TOKEN USAGE] Created aggregated log with ${allTokenUsageDetails.length} function calls`);
      } else {
        console.warn('[WARNING] No usageMetadata found in response for evaluateInterviewById');
      }

      let evaluationText = response.text.trim();

      // Remove markdown code blocks if present
      evaluationText = evaluationText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");

      const evaluation = JSON.parse(evaluationText);

      // Calculate additional metrics
      const completionTime = interviewData.answers.reduce(
        (sum, a) => sum + (a.duration || 0),
        0,
      );
      evaluation.totalQuestions = interviewData.answers.length;
      evaluation.completionTime = `${Math.floor(completionTime / 60)} minutes`;

      // Save evaluation to database (evaluated flag already set by atomic lock)
      await Interview.findByIdAndUpdate(id, {
        evaluation: evaluation,
        // evaluated: true, // Already set by atomic lock above
        // evaluatedAt: new Date(), // Already set by atomic lock above
      });

      console.log(`[SUCCESS] Evaluation completed for interview ${id}`);

      res.status(200).json({
        success: true,
        evaluation: evaluation,
      });
    } catch (error) {
      console.error("Error evaluating interview:", error);

      // Rollback the evaluated flag if evaluation failed
      const { id } = req.params;
      if (id) {
        try {
          await Interview.findByIdAndUpdate(id, {
            evaluated: false,
            evaluatedAt: null,
          });
          console.log(`[ROLLBACK] Reset evaluated flag for interview ${id} due to error`);
        } catch (rollbackError) {
          console.error("Error rolling back evaluation flag:", rollbackError);
        }
      }

      next(error);
    }
  }

  static async responseToAnswer(req, res, next) {
    try {
      const genAI = new GoogleGenAI({});

      const { question, answer, needFollowUp } = req.body;

      let prompt;

      if (needFollowUp) {
        // Generate follow-up question berdasarkan jawaban user
        prompt = `
            Task: Anggap dirimu adalah seorang HRD Profesional yang sedang melakukan interview. Berikan 1 pertanyaan follow-up yang relevan berdasarkan jawaban kandidat.

            Question: ${question}
            Answer: ${answer}

            Rules:
            - Buat pertanyaan follow-up yang menggali lebih dalam dari jawaban kandidat.
            - Pertanyaan harus spesifik dan relevan dengan jawaban yang diberikan.
            - Jika jawaban kurang detail atau tidak sesuai konteks, buat pertanyaan yang mengarahkan kandidat untuk memberikan informasi lebih konkret.
            - Gunakan bahasa yang formal dan sopan namun tegas.
            - Panjang pertanyaan maksimal 2 kalimat.
            - Do not return anything except raw text.
            - The response should be in Indonesian.
            - Tidak perlu pakai kata Bapak/Ibu atau Saudara/i di awal kalimat.
            - Jangan berikan response atau acknowledgment, langsung tanyakan pertanyaan follow-up.

            Example Output (Good Answer):
            "Bisa Anda jelaskan lebih detail tentang tantangan teknis yang Anda hadapi dalam proyek tersebut? Bagaimana Anda mengatasinya?"

            Example Output (Vague Answer):
            "Sepertinya jawaban Anda masih cukup umum. Bisakah Anda berikan contoh konkret dari pengalaman kerja Anda yang relevan dengan posisi ini?"

            Output format: 
            "Your follow-up question here."
            `;
      } else {
        // Generate acknowledgment/response biasa
        prompt = `
            Task: Anggap dirimu adalah seorang HRD Profesional yang objektif dan kritis. Berikan response sebanyak 1-2 kalimat terhadap jawaban interview berikut ini berdasarkan pertanyaan yang diajukan.

            Question: ${question}
            Answer: ${answer}

            Rules:
            - Evaluasi kualitas jawaban kandidat secara objektif.
            - Jika jawaban baik, konkret, dan relevan: berikan apresiasi yang profesional.
            - Jika jawaban kurang detail, terlalu umum, atau tidak menjawab pertanyaan: berikan feedback yang konstruktif namun tegas.
            - Jika jawaban tidak relevan atau menghindari pertanyaan: tunjukkan dengan profesional bahwa jawaban kurang sesuai ekspektasi.
            - Gunakan bahasa yang formal, sopan, namun tegas dan objektif.
            - Panjang response maksimal 2 kalimat.
            - Do not return anything except raw text.
            - The response should be in Indonesian.
            - Tidak perlu pakai kata Bapak/Ibu atau Saudara/i di awal kalimat.

            Example Output (Good Answer):
            "Terima kasih atas penjelasan yang detail mengenai pengalaman Anda dalam mengelola proyek pengembangan perangkat lunak. Pendekatan sistematis Anda dalam menyelesaikan tantangan teknis menunjukkan kemampuan problem-solving yang baik."

            Example Output (Mediocre Answer):
            "Saya mencatat jawaban Anda, namun penjelasannya masih cukup umum. Akan lebih baik jika Anda bisa memberikan contoh spesifik dari pengalaman kerja Anda."

            Example Output (Poor/Irrelevant Answer):
            "Sepertinya jawaban Anda belum sepenuhnya menjawab pertanyaan yang diajukan. Mari kita lanjutkan ke pertanyaan berikutnya."

            Output format: 
            "Your response text here."
            `;
      }

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      // Store token usage in memory buffer for later aggregation (NO DATABASE)
      if (response?.usageMetadata) {
        const userId = req.user?.id;

        if (!userId) {
          console.warn('[WARNING] No userId found for responseToAnswer token buffering');
        } else {
          // Prepare for cost tracking
          let aiServiceCosts = {};

          const data = response.text.trim();

          // ELEVENLABS COST SIMULATION - Count characters and calculate cost but don't generate audio
          const characterCount = data.length;
          const elevenLabsCostSimulation = CostCalculator.calculateElevenLabsCost(characterCount);

          // Track simulated ElevenLabs costs
          aiServiceCosts.elevenLabs = {
            characters: characterCount,
            cost: elevenLabsCostSimulation
          };

          console.log(`[ELEVENLABS SIMULATION] Characters: ${characterCount}, Simulated cost: $${elevenLabsCostSimulation.toFixed(6)} (AUDIO NOT GENERATED)`);

          const tokenDetail = {
            functionName: "responseToAnswer",
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
            thoughtsTokens: response.usageMetadata.thoughtsTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0,
            model: "gemini-2.0-flash",
            // ElevenLabs simulation - cost tracking without API call
            elevenLabsCharacters: aiServiceCosts.elevenLabs?.characters || 0,
            elevenLabsCost: aiServiceCosts.elevenLabs?.cost || 0,
            whisperDurationSeconds: 0, // Will be tracked separately in answerQuestion
            whisperCost: 0,
            timestamp: new Date(),
          };

          // Store in memory buffer by userId (NOT database)
          const userIdStr = userId.toString(); // Convert to string for consistent key
          if (!tokenUsageBuffer.has(userIdStr)) {
            tokenUsageBuffer.set(userIdStr, []);
          }
          tokenUsageBuffer.get(userIdStr).push(tokenDetail);

          console.log(
            `[AI COST TRACKING] responseToAnswer (MEMORY BUFFERED) - User: ${userIdStr}, Tokens: ${tokenDetail.totalTokens}, ElevenLabs: $${tokenDetail.elevenLabsCost.toFixed(6)} (SIMULATED), Buffer size: ${tokenUsageBuffer.get(userIdStr).length}`
          );

          // Kirim response balik tanpa audio (ElevenLabs simulation only)
          res.status(201).json({
            text: data,
            audioBase64: "", // Empty audio since ElevenLabs API is not called
            contentType: "audio/mp3",
            isFollowUp: needFollowUp || false,
            audioDisabled: true, // Flag to indicate audio is disabled
            elevenLabsSimulation: { // Include simulation data
              characters: characterCount,
              cost: elevenLabsCostSimulation
            }
          });
        }
      } else {
        console.warn('[WARNING] No usageMetadata found in response for responseToAnswer');

        // ELEVENLABS COST SIMULATION - Even without token metadata
        const data = response.text.trim();
        const characterCount = data.length;
        const elevenLabsCostSimulation = CostCalculator.calculateElevenLabsCost(characterCount);

        console.log(`[ELEVENLABS SIMULATION] Characters: ${characterCount}, Simulated cost: $${elevenLabsCostSimulation.toFixed(6)} (AUDIO NOT GENERATED)`);

        res.status(201).json({
          text: data,
          audioBase64: "", // Empty audio since ElevenLabs API is not called
          contentType: "audio/mp3",
          isFollowUp: needFollowUp || false,
          audioDisabled: true, // Flag to indicate audio is disabled
          elevenLabsSimulation: { // Include simulation data
            characters: characterCount,
            cost: elevenLabsCostSimulation
          }
        });
      }
    } catch (error) {
      console.error("Error Detail:", error);
      next(error);
    }
  }

  static async evaluateInterview(req, res, next) {
    try {
      const genAI = new GoogleGenAI({});
      const { interviewData } = req.body;

      const prompt = `
        Task: Anggap dirimu adalah seorang Interview Expert yang akan mengevaluasi hasil interview kandidat.
        
        Interview Information:
        - Position: ${interviewData.category}
        - Level: ${interviewData.level}
        - Total Questions: ${interviewData.answers.length}
        
        Questions & Answers:
        ${interviewData.answers
          .map(
            (qa, index) => `
        Q${index + 1}: ${qa.question}
        A${index + 1}: ${qa.answer}
        `,
          )
          .join("\n")}
        
        Instructions:
        Berikan evaluasi komprehensif dalam format JSON dengan struktur berikut:
        
        {
          "overallScore": <number 0-100>,
          "overallGrade": "<A+, A, A-, B+, B, B-, C+, C, C-, D, F>",
          "evaluations": [
            {
              "category": "Content Quality",
              "score": <number 0-100>,
              "maxScore": 100,
              "feedback": "<detailed feedback in Indonesian>",
              "strengths": ["<strength 1>", "<strength 2>", ...],
              "improvements": ["<improvement 1>", "<improvement 2>", ...]
            },
            {
              "category": "Communication Skills",
              ...
            },
            {
              "category": "Relevance & Focus",
              ...
            },
            {
              "category": "Problem Solving Approach",
              ...
            },
            {
              "category": "Confidence & Enthusiasm",
              ...
            }
          ],
          "summary": "<overall summary in Indonesian, 2-3 sentences>",
          "recommendations": [
            "<actionable recommendation 1>",
            "<actionable recommendation 2>",
            ...
          ]
        }
        
        Evaluation Criteria:
        
        1. Content Quality (0-100):
           - Kedalaman pemahaman teknis
           - Relevansi dengan pengalaman
           - Kelengkapan jawaban
           - Penggunaan contoh konkret
           - Impact/hasil yang dijelaskan
        
        2. Communication Skills (0-100):
           - Clarity of explanation
           - Structure dan organization
           - Grammar dan vocabulary
           - Professional language usage
           - Filler words (kurangi score jika banyak)
        
        3. Relevance & Focus (0-100):
           - Menjawab pertanyaan yang diajukan
           - Tidak bertele-tele
           - Fokus pada poin penting
           - Time management
        
        4. Problem Solving Approach (0-100):
           - Systematic thinking
           - Analisis masalah
           - Alternatif solusi
           - Decision making process
           - Learning from experience
        
        5. Confidence & Enthusiasm (0-100):
           - Self-confidence
           - Enthusiasm untuk role
           - Passion untuk teknologi
           - Growth mindset
           - Positive attitude
        
        Grading Scale:
        - A+ (95-100): Exceptional
        - A (90-94): Excellent
        - A- (85-89): Very Good
        - B+ (80-84): Good
        - B (75-79): Above Average
        - B- (70-74): Average
        - C+ (65-69): Below Average
        - C (60-64): Needs Improvement
        - C- (55-59): Significant Improvement Needed
        - D (50-54): Poor
        - F (<50): Fail
        
        Rules:
        - Berikan feedback yang constructive dan actionable
        - Minimum 3 strengths dan 2 improvements per kategori
        - Recommendations harus specific dan actionable (min 5)
        - Summary harus highlight key points
        - Gunakan bahasa Indonesia yang profesional
        - Response HARUS dalam format JSON yang valid
        - Tidak boleh ada markdown formatting atau backticks
        
        Output: Return ONLY the JSON object, nothing else.
        `;

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      // Log token usage
      if (response?.usageMetadata) {
        // For evaluateInterview, we need interview context from request body
        const { category, level, tier } = req.body;

        // We don't have specific interviewId here, but we can create a session-based log
        await InterviewController.logTokenUsage(
          req.user?.id,
          "evaluateInterview",
          response.usageMetadata,
          null // Use old method for backward compatibility
        );
      } else {
        console.warn('[WARNING] No usageMetadata found in response for evaluateInterview');
      }

      let evaluationText = response.text.trim();

      // Remove markdown code blocks if present
      evaluationText = evaluationText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");

      const evaluation = JSON.parse(evaluationText);

      // Calculate additional metrics
      const completionTime = interviewData.answers.reduce(
        (sum, a) => sum + (a.duration || 0),
        0,
      );
      evaluation.totalQuestions = interviewData.answers.length;
      evaluation.completionTime = `${Math.floor(completionTime / 60)} minutes`;

      res.status(200).json({
        success: true,
        evaluation: evaluation,
      });
    } catch (error) {
      console.error("Error evaluating interview:", error);
      next(error);
    }
  }

  static async getTokenUsageHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const tokenLogs = await TokenUsageLog.find({ userId })
        .populate('interviewId', 'completedAt')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const totalLogs = await TokenUsageLog.countDocuments({ userId });

      // Calculate total stats
      const totalStats = await TokenUsageLog.aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalTokensAllTime: { $sum: "$totalTokensUsed" },
            totalInterviews: { $sum: 1 },
            avgTokensPerInterview: { $avg: "$totalTokensUsed" }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          logs: tokenLogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalLogs / limit),
            totalItems: totalLogs,
          },
          stats: totalStats[0] || {
            totalTokensAllTime: 0,
            totalInterviews: 0,
            avgTokensPerInterview: 0
          }
        }
      });
    } catch (error) {
      console.error("Error getting token usage history:", error);
      next(error);
    }
  }

  // -------------- Helper Functions -------------- //
  static async finalizeTokenUsageLog(interviewId) {
    try {
      // Find existing interview-based token log
      let tokenLog = await TokenUsageLog.findOne({ interviewId });

      // Get interview data for aggregating responseToAnswer logs
      const interview = await Interview.findById(interviewId);
      if (!interview) {
        console.warn(`[TOKEN LOG] Interview ${interviewId} not found`);
        return;
      }

      // responseToAnswer logging is now disabled, so no need to search for logs
      if (!tokenLog) {
        console.log(`[TOKEN LOG] No token usage found for interview ${interviewId} (responseToAnswer logging disabled)`);
        return;
      }

      // Just mark as completed if not already completed
      if (!tokenLog.completedAt) {
        tokenLog.completedAt = new Date();
        await tokenLog.save();
        console.log(`[TOKEN LOG] Finalized token usage for interview ${interviewId}, total tokens: ${tokenLog.totalTokensUsed}`);
      }

      return tokenLog;
    }
    catch (error) {
      console.error("Error finalizing token usage log:", error);
    }
  }

  static async logTokenUsage(userId, functionName, usageMetadata, interviewData = null, aiServiceCosts = null) {
    try {
      // Debug log untuk melihat struktur usageMetadata
      console.log(`[DEBUG] usageMetadata received for ${functionName}:`, JSON.stringify(usageMetadata, null, 2));

      // Calculate Gemini cost
      const geminiCost = CostCalculator.calculateGeminiCost(
        usageMetadata.promptTokenCount || 0,
        (usageMetadata.candidatesTokenCount || 0) + (usageMetadata.thoughtsTokenCount || 0)
      );

      const tokenDetail = {
        functionName: functionName,
        promptTokens: usageMetadata.promptTokenCount || 0,
        candidatesTokens: usageMetadata.candidatesTokenCount || 0,
        thoughtsTokens: usageMetadata.thoughtsTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
        model: "gemini-2.0-flash",
        // Add AI service cost tracking
        elevenLabsCharacters: aiServiceCosts?.elevenLabs?.characters || 0,
        elevenLabsCost: aiServiceCosts?.elevenLabs?.cost || 0,
        whisperDurationSeconds: aiServiceCosts?.whisper?.durationSeconds || 0,
        whisperCost: aiServiceCosts?.whisper?.cost || 0,
        timestamp: new Date(),
      };

      // Calculate total cost for this function call
      const totalFunctionCost = geminiCost + (tokenDetail.elevenLabsCost || 0) + (tokenDetail.whisperCost || 0);

      // Log to console for monitoring
      console.log(
        `[AI COST TRACKING] ${functionName}:`
      );
      console.log(
        `  Gemini - Prompt: ${tokenDetail.promptTokens}, Candidates: ${tokenDetail.candidatesTokens}, Thoughts: ${tokenDetail.thoughtsTokens}, Total: ${tokenDetail.totalTokens}, Cost: $${geminiCost.toFixed(6)}`
      );
      if (tokenDetail.elevenLabsCharacters > 0) {
        console.log(
          `  ElevenLabs - Characters: ${tokenDetail.elevenLabsCharacters}, Cost: $${tokenDetail.elevenLabsCost.toFixed(6)}`
        );
      }
      if (tokenDetail.whisperDurationSeconds > 0) {
        console.log(
          `  Whisper - Duration: ${tokenDetail.whisperDurationSeconds}s, Cost: $${tokenDetail.whisperCost.toFixed(6)}`
        );
      }
      console.log(`  TOTAL COST: $${totalFunctionCost.toFixed(6)}`);

      if (interviewData) {
        // Per-interview logging (new approach)
        const { interviewId, category, level, tier, details } = interviewData;

        if (details && Array.isArray(details)) {
          // Calculate aggregated costs from details array
          const aggregatedCosts = details.reduce((acc, detail) => {
            acc.totalTokensUsed += detail.totalTokens || 0;
            acc.totalElevenLabsCharacters += detail.elevenLabsCharacters || 0;
            acc.totalElevenLabsCost += detail.elevenLabsCost || 0;
            acc.totalWhisperDurationSeconds += detail.whisperDurationSeconds || 0;
            acc.totalWhisperCost += detail.whisperCost || 0;

            // Calculate Gemini cost for this detail
            const geminiCost = CostCalculator.calculateGeminiCost(
              detail.promptTokens || 0,
              (detail.candidatesTokens || 0) + (detail.thoughtsTokens || 0)
            );
            acc.totalGeminiCost += geminiCost;

            return acc;
          }, {
            totalTokensUsed: 0,
            totalElevenLabsCharacters: 0,
            totalElevenLabsCost: 0,
            totalWhisperDurationSeconds: 0,
            totalWhisperCost: 0,
            totalGeminiCost: 0
          });

          const totalCostUSD = aggregatedCosts.totalGeminiCost + aggregatedCosts.totalElevenLabsCost + aggregatedCosts.totalWhisperCost;

          // If details array is provided, create aggregated log directly
          const tokenLog = await TokenUsageLog.create({
            userId,
            interviewId,
            category,
            level,
            tier,
            totalTokensUsed: aggregatedCosts.totalTokensUsed,
            totalElevenLabsCharacters: aggregatedCosts.totalElevenLabsCharacters,
            totalElevenLabsCost: aggregatedCosts.totalElevenLabsCost,
            totalWhisperDurationSeconds: aggregatedCosts.totalWhisperDurationSeconds,
            totalWhisperCost: aggregatedCosts.totalWhisperCost,
            totalCostUSD: totalCostUSD,
            details: details, // Use the provided details array
            completedAt: new Date(),
          });

          console.log(`[COST SUMMARY] Interview ${interviewId} completed:`);
          console.log(`  Total Tokens: ${aggregatedCosts.totalTokensUsed}`);
          console.log(`  Total ElevenLabs Characters: ${aggregatedCosts.totalElevenLabsCharacters}`);
          console.log(`  Total Whisper Duration: ${aggregatedCosts.totalWhisperDurationSeconds}s`);
          console.log(`  TOTAL COST: $${totalCostUSD.toFixed(6)}`);
          console.log(`[TOKEN LOG] Created aggregated token log for interview ${interviewId} with ${details.length} function calls`);
          return tokenLog;
        } else {
          // Single function logging (old way for backward compatibility)
          // Find or create token usage log for this interview
          let tokenLog = await TokenUsageLog.findOne({ interviewId });

          if (!tokenLog) {
            // Create new log for this interview
            tokenLog = await TokenUsageLog.create({
              userId,
              interviewId,
              category,
              level,
              tier,
              totalTokensUsed: tokenDetail.totalTokens,
              details: [tokenDetail],
            });
            console.log(`[TOKEN LOG] Created new token log for interview ${interviewId}`);
          } else {
            // Update existing log
            tokenLog.totalTokensUsed += tokenDetail.totalTokens;
            tokenLog.details.push(tokenDetail);
            await tokenLog.save();
            console.log(`[TOKEN LOG] Updated token log for interview ${interviewId}, new total: ${tokenLog.totalTokensUsed}`);
          }

          return tokenDetail;
        }
      } else {
        // Fallback to old method for non-interview functions
        const tokenData = {
          userId: userId,
          functionName: functionName,
          promptTokens: tokenDetail.promptTokens,
          candidatesTokens: tokenDetail.candidatesTokens,
          thoughtsTokens: tokenDetail.thoughtsTokens,
          totalTokens: tokenDetail.totalTokens,
          model: tokenDetail.model,
        };

        // Save to database (old structure for backward compatibility)
        await TokenUsageLog.create(tokenData);
        return tokenData;
      }
    } catch (error) {
      console.error("Error logging token usage:", error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  static async transcribeAudio(fileObject, trackCosts = false) {
    // Estimate audio duration from file size (rough approximation)
    const estimatedDuration = CostCalculator.getAudioDuration(fileObject.buffer);
    const whisperCost = trackCosts ? CostCalculator.calculateWhisperCost(estimatedDuration) : 0;

    console.log(`[WHISPER COST] Estimated duration: ${estimatedDuration}s, Estimated cost: $${whisperCost.toFixed(6)}`);

    // Use native FormData and Blob for Node.js 18+
    const formData = new FormData();

    // Create a Blob from the buffer
    const blob = new Blob([fileObject.buffer], { type: fileObject.mimetype });

    // Append file to formData
    formData.append("file", blob, fileObject.originalname);
    formData.append("model", "whisper-v3");

    const response = await fetch(
      "https://audio-prod.api.fireworks.ai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHISPER_API_KEY}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Gagal melakukan transkripsi");
    }

    const result = await response.json();

    // Return both transcription text and cost metrics
    return {
      text: result.text,
      costMetrics: trackCosts ? {
        durationSeconds: estimatedDuration,
        cost: whisperCost
      } : null
    };
  }

  static async generateSpeechBuffer(text, trackCosts = false) {
    const voiceId = "hpp4J3VqNfWAUOO0d1Us";

    // Count characters for cost tracking
    const characterCount = text.length;
    const elevenLabsCost = trackCosts ? CostCalculator.calculateElevenLabsCost(characterCount) : 0;

    console.log(`[ELEVENLABS COST] Characters: ${characterCount}, Estimated cost: $${elevenLabsCost.toFixed(6)}`);

    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    // Return both audio buffer and cost metrics
    return {
      audioBuffer,
      costMetrics: trackCosts ? {
        characters: characterCount,
        cost: elevenLabsCost
      } : null
    };
  }
};
