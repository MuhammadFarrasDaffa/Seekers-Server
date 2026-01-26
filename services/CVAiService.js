const { GoogleGenerativeAI } = require("@google/generative-ai");

class AIService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }

    async enhanceSummary(data) {
        try {
            const { fullName, summary, skills, experience, education } = data;

            const prompt = `
As an expert CV writer, create a compelling professional summary for a CV based on this information:

Profile Data:
- Name: ${fullName || "Not provided"}
- User Draft: ${summary || "No draft provided"}
- Skills: ${skills?.map((s) => s.name).join(", ") || "No skills listed"}
- Experience Count: ${experience?.length || 0} positions

Recent Roles:
${experience && experience.length > 0
                    ? experience
                        .slice(0, 2)
                        .map((e) => `- ${e.position} at ${e.company}`)
                        .join("\n")
                    : "No experience provided"
                }

Education:
${education && education.length > 0
                    ? education
                        .map((e) => `- ${e.degree} in ${e.field} from ${e.institution}`)
                        .join("\n")
                    : "No education provided"
                }

Instructions:
1. Create a 2-3 sentence professional summary (Max 150 words).
2. Incorporate the context from the user's draft (About Me).
3. Highlight key skills and achievements.
4. Ensure it is ATS keyword-optimized.
5. Use strong action verbs.
6. Return ONLY the text paragraph, no markdown formatting, no quotes.
      `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiSummary = response.text().trim();

            return aiSummary;
        } catch (error) {
            console.error("AI Summary Generation Error:", error);
            throw new Error("Failed to generate AI summary");
        }
    }

    async optimizeDescription(experienceData, targetRole = "") {
        try {
            const { position, company, description } = experienceData;

            const prompt = `
As an expert CV writer, improve these job description bullet points for a ${position} role at ${company}.
${targetRole ? `The candidate is targeting: ${targetRole}` : ""}

Current description:
${description?.join("\n") || "No description provided"}

Instructions:
1. Rewrite each bullet point using strong action verbs (e.g., "Developed", "Led", "Optimized", "Implemented").
2. Make each point more specific and quantifiable if possible.
3. Keep the meaning but make it more professional and ATS-friendly.
4. Return ONLY the bullet points, one per line, without numbering or markdown.
5. Maximum 5 bullet points.
      `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const optimizedText = response.text().trim();

            // Split by newlines and filter empty lines
            const optimizedDescription = optimizedText
                .split("\n")
                .map((line) => line.replace(/^[-•*]\s*/, "").trim())
                .filter((line) => line.length > 0);

            return optimizedDescription;
        } catch (error) {
            console.error("AI Description Optimization Error:", error);
            throw new Error("Failed to optimize description");
        }
    }

    async suggestSkills(targetRole = "Software Developer", currentSkills = []) {
        try {
            const prompt = `
As a career advisor, suggest 5-10 relevant technical skills for someone targeting the role: "${targetRole}".

Current skills they have: ${currentSkills.join(", ") || "None listed"}

Instructions:
1. Suggest skills that complement their current skillset.
2. Focus on in-demand, industry-relevant skills.
3. Include a mix of technical skills, frameworks, and tools.
4. Return ONLY skill names, comma-separated, no explanations.
      `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const skillsText = response.text().trim();

            // Parse comma-separated skills
            const suggestedSkills = skillsText
                .split(",")
                .map((skill) => skill.trim())
                .filter((skill) => skill.length > 0);

            return suggestedSkills;
        } catch (error) {
            console.error("AI Skill Suggestion Error:", error);
            throw new Error("Failed to suggest skills");
        }
    }

    async generateHeadline(profileData) {
        try {
            const { fullName, skills, experience, education } = profileData;

            const latestExperience =
                experience && experience.length > 0 ? experience[0] : null;
            const topSkills =
                skills && skills.length > 0
                    ? skills.slice(0, 3).map((s) => s.name)
                    : [];

            const prompt = `
Create a compelling LinkedIn/CV headline for:

Name: ${fullName || "Not provided"}
Current/Latest Role: ${latestExperience ? `${latestExperience.position} at ${latestExperience.company}` : "Not provided"}
Top Skills: ${topSkills.join(", ") || "Not provided"}
Education: ${education && education.length > 0
                    ? `${education[0].degree} in ${education[0].field}`
                    : "Not provided"
                }

Instructions:
1. Create a professional headline that stands out (max 100 characters).
2. Use this format: "[Role/Title] | [Key Skills/Specialization] | [Value Proposition]"
3. Make it ATS-friendly and keyword-rich.
4. Return ONLY the headline text, no quotes or formatting.

Example: "Full Stack Developer | MERN Stack Specialist | Building Scalable Web Solutions"
      `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const headline = response
                .text()
                .trim()
                .replace(/^["']|["']$/g, "");

            return headline;
        } catch (error) {
            console.error("AI Headline Generation Error:", error);
            throw new Error("Failed to generate headline");
        }
    }
}

module.exports = new AIService();
