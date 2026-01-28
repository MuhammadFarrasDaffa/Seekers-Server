const { GoogleGenAI } = require("@google/genai");

const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const { ObjectId } = require("mongodb");

const Question = require("../models/Question");
const Interview = require("../models/Interview");
const User = require("../models/User");
const Tier = require("../models/Tier");

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

      // Panggil fungsi transcribe dengan mengirimkan objek file dari multer
      const transcriptionText = await InterviewController.transcribeAudio(file);

      res.status(200).json({
        message: "Success transcribe audio",
        transcription: transcriptionText,
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

      // Check if already evaluated
      if (interview.evaluated) {
        return res.status(200).json({
          success: true,
          evaluation: interview.evaluation,
        });
      }

      // Prepare data for evaluation
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
        model: "gemini-2.5-flash",
        contents: prompt,
      });

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

      // Save evaluation to database
      await Interview.findByIdAndUpdate(id, {
        evaluation: evaluation,
        evaluated: true,
        evaluatedAt: new Date(),
      });

      res.status(200).json({
        success: true,
        evaluation: evaluation,
      });
    } catch (error) {
      console.error("Error evaluating interview:", error);
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
            - Gunakan bahasa yang formal dan sopan.
            - Panjang pertanyaan maksimal 2 kalimat.
            - Do not return anything except raw text.
            - The response should be in Indonesian.
            - Tidak perlu pakai kata Bapak/Ibu atau Saudara/i di awal kalimat.
            - Jangan berikan response atau acknowledgment, langsung tanyakan pertanyaan follow-up.

            Example Output:
            "Bisa Anda jelaskan lebih detail tentang tantangan teknis yang Anda hadapi dalam proyek tersebut? Bagaimana Anda mengatasinya?"

            Output format: 
            "Your follow-up question here."
            `;
      } else {
        // Generate acknowledgment/response biasa
        prompt = `
            Task: Anggap dirimu adalah seorang HRD Profesional, berikan response sebanyak 1-2 kalimat terhadap jawaban interview berikut ini berdasarkan pertanyaan yang diajukan.
            
            Question: ${question}
            Answer: ${answer}

            Rules:
            - Berikan response seperti seorang HRD Profesional.
            - Gunakan bahasa yang formal dan sopan.
            - Panjang response maksimal 2 kalimat.
            - Response berisi pengulangan poin penting dari jawaban.
            - Do not return anything except raw text.
            - The response should be in Indonesian.
            - Tidak perlu pakai ada kata Bapak/Ibu atau Saudara/i di awal kalimat.

            Example Output:
            "Terima kasih atas penjelasan Anda yang sangat mendetail mengenai pengalaman Anda dalam mengelola proyek pengembangan perangkat lunak. Kami menghargai pendekatan sistematis Anda dalam menyelesaikan tantangan teknis."

            Output format: 
            "Your response text here."
            `;
      }

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const data = response.text.trim();

      // Generate Audio dari response/follow-up question
      const audioBuffer = await InterviewController.generateSpeechBuffer(data);

      // Kirim response balik
      res.status(201).json({
        text: data,
        audioBase64: audioBuffer.toString("base64"),
        contentType: "audio/mp3",
        isFollowUp: needFollowUp || false,
      });
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
        model: "gemini-2.5-flash",
        contents: prompt,
      });

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

  // -------------- Helper Functions -------------- //
  static async transcribeAudio(fileObject) {
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
    return result.text;
  }

  static async generateSpeechBuffer(text) {
    const voiceId = "hpp4J3VqNfWAUOO0d1Us";

    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }
};
