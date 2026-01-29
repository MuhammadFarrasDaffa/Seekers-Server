const puppeteer = require("puppeteer");

class PDFService {
  constructor() {
    this.browser = null;
  }

  async initializeBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Helper function to format date ranges
  formatDateRange(startDate, endDate) {
    const toYearMonth = (value) => {
      if (!value) return "";
      // Handle literal Present
      if (value === "Present" || value === "present") return "Present";

      // If Date instance
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
      }

      // If timestamp number
      if (typeof value === "number") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          return `${y}-${m}`;
        }
        return String(value);
      }

      // If string, try to normalize
      if (typeof value === "string") {
        const s = value.trim();
        // Already YYYY-MM format
        if (/^\d{4}-\d{2}$/.test(s)) return s;
        // If full date like YYYY-MM-DD, reduce to YYYY-MM
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
        // Try to parse generic date string
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          return `${y}-${m}`;
        }
        // Fallback: keep as-is (e.g., custom labels)
        return s;
      }

      // Fallback for objects with toISOString
      if (value && typeof value.toISOString === "function") {
        const d = new Date(value.toISOString());
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          return `${y}-${m}`;
        }
      }

      return String(value);
    };

    const start = toYearMonth(startDate);
    const endNormalized = toYearMonth(endDate);
    const end = endNormalized || "Present";
    if (!start && !end) return "";
    return `${start} – ${end}`;
  }

  // Helper function to escape HTML
  escapeHtml(text) {
    if (!text) return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Helper to check if skill is a soft skill
  isSoftSkill(skillName) {
    if (!skillName) return false;
    const softSkillPatterns =
      /\b(communication|problem.?solving|critical.?thinking|creative.?thinking|leadership|teamwork|collaboration|collaborative|adaptable|adaptive|flexible|time.?management|organization|organized|interpersonal|emotional.?intelligence|conflict.?resolution|decision.?making|negotiation|presentation|public.?speaking|mentoring|coaching|empathy|patience|motivation|initiative|self.?motivated|detail.?oriented|analytical|fast.?learner|quick.?learner|multitasking|stress.?management|work.?ethic|positive.?attitude|open.?minded|receptive|proactive|reliable|dependable|accountable|trustworthy|honest|integrity|respectful|professional|punctual|diligent|perseverance|resilience|curious|creativity|innovation|strategic.?thinking|planning|prioritization)\b/i;
    return softSkillPatterns.test(skillName);
  }

  // Helper to check if skill is a tool
  isTool(skillName) {
    if (!skillName) return false;
    const toolPatterns =
      /\b(figma|adobe|photoshop|illustrator|xd|sketch|miro|trello|jira|asana|notion|slack|git|github|gitlab|vscode|vs code|postman|docker|kubernetes|aws|azure|gcp|excel|word|powerpoint|canva|invision|zeplin|abstract|principle|framer|webflow|wordpress|shopify|firebase|mongodb|mysql|postgresql|redis|jenkins|terraform|ansible|linux|windows|macos)\b/i;
    return toolPatterns.test(skillName);
  }

  generateCVHTML(profile, user, style = "modern") {
    const {
      fullName,
      title,
      email,
      phone,
      location,
      summary,
      experience,
      education,
      skills,
      certifications,
      aiSummary,
      linkedIn,
      github,
      portfolio,
    } = profile;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fullName || "CV"}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            @page {
                size: A4;
                margin: 1.5cm 1cm;
            }
            
            body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 10pt;
                line-height: 1.3;
                color: #000;
                background: white;
            }
            
            .cv-container {
                max-width: 21cm;
                margin: 0 auto;
                background: white;
                padding: 15px 20px;
            }
            
            .header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            
            .name {
                font-size: 18pt;
                font-weight: bold;
                color: #000;
                margin-bottom: 2px;
                letter-spacing: 0.5px;
            }
            
            .headline {
                font-size: 14pt;
                font-style: italic;
                margin-bottom: 6px;
                color: #333;
            }
            
            .contact-info {
                font-size: 10pt;
                line-height: 1.4;
                color: #444;
            }
            
            .section {
                margin-bottom: 12px;
                page-break-inside: avoid;
            }
            
            .section-title {
                font-size: 11pt;
                font-weight: bold;
                text-transform: uppercase;
                border-bottom: 1.5px solid #000;
                padding-bottom: 2px;
                margin-bottom: 6px;
                letter-spacing: 0.5px;
            }
            
            .summary-text {
                text-align: justify;
                line-height: 1.35;
                margin-bottom: 10px;
                font-size: 10pt;
            }
            
            .experience-item, .education-item, .cert-item {
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 2px;
            }
            
            .item-title {
                font-weight: bold;
                font-style: italic;
                font-size: 10pt;
            }
            
            .item-company {
                font-weight: bold;
                font-size: 10pt;
            }
            
            .item-date {
                font-style: italic;
                text-align: right;
                font-size: 9pt;
                white-space: nowrap;
                color: #555;
            }
            
            .item-description {
                margin-top: 3px;
                padding-left: 18px;
                margin-bottom: 5px;
            }
            
            .item-description li {
                margin-bottom: 2px;
                text-align: justify;
                line-height: 1.3;
                font-size: 9.5pt;
            }
            
            .skills-list {
                line-height: 1.5;
                font-size: 10pt;
                margin-bottom: 4px;
            }
            
            .skills-list strong {
                font-weight: bold;
            }

            .cert-details {
                font-style: italic;
                font-size: 9pt;
                color: #555;
            }
            
            a {
                color: #000;
                text-decoration: underline;
            }
            
            /* Prevent orphan headers */
            .section-title {
                page-break-after: avoid;
            }
            
            /* Ensure items stay together */
            .experience-item,
            .education-item,
            .cert-item {
                page-break-inside: avoid;
            }
            
            /* Allow page breaks between items when needed */
            .experience-item::after,
            .education-item::after,
            .cert-item::after {
                content: "";
                display: block;
                page-break-after: auto;
            }
            
            @media print {
                body {
                    margin: 0;
                    padding: 0;
                }
                
                .cv-container {
                    padding: 0;
                }
                
                /* Force page breaks when needed */
                .page-break {
                    page-break-before: always;
                }
            }
        </style>
    </head>
    <body>
        <div class="cv-container">
            <!-- Header -->
            <div class="header">
                <div class="name">${this.escapeHtml(fullName || user?.name || "Full Name")}</div>
                ${title ? `<div class="headline">${this.escapeHtml(title)}</div>` : ""}
                <div class="contact-info">
                    ${location ? `${this.escapeHtml(location)} | ` : ""}
                    ${email || user?.email ? `${email || user?.email}` : ""} ${phone ? ` | ${phone}` : ""}
                    ${linkedIn || github || portfolio ? "<br/>" : ""}
                    ${linkedIn ? `<a href="${linkedIn}">LinkedIn</a>` : ""}
                    ${linkedIn && github ? " | " : ""}
                    ${github ? `<a href="${github}">GitHub</a>` : ""}
                    ${(linkedIn || github) && portfolio ? " | " : ""}
                    ${portfolio ? `<a href="${portfolio}">Portfolio</a>` : ""}
                </div>
            </div>

            <!-- Summary -->
            ${
              aiSummary
                ? `
            <div class="section">
                <div class="section-title">SUMMARY</div>
                <div class="summary-text">${this.escapeHtml(aiSummary || summary)}</div>
            </div>
            `
                : ""
            }

            <!-- Education -->
            ${
              education && education.length > 0
                ? `
            <div class="section">
                <div class="section-title">EDUCATION</div>
                ${education
                  .map(
                    (edu) => `
                    <div class="education-item">
                        <div class="item-header">
                            <div style="flex: 1;">
                                <div class="item-company">${this.escapeHtml(edu.institution || "")}</div>
                                <div class="item-title">${this.escapeHtml(edu.degree || "")}${edu.fieldOfStudy ? ` in ${this.escapeHtml(edu.fieldOfStudy)}` : ""}</div>
                            </div>
                            <div class="item-date" style="margin-left: 10px;">
                                ${this.formatDateRange(edu.startDate, edu.endDate)}
                            </div>
                        </div>
                        ${edu.grade ? `<div style="font-size: 9pt; color: #555;">GPA / Score : ${edu.grade}</div>` : ""}
                        ${edu.description ? `<div style="font-size: 9pt; color: #555; margin-top: 2px;">${this.escapeHtml(edu.description)}</div>` : ""}
                    </div>
                `,
                  )
                  .join("")}
            </div>
            `
                : ""
            }

            <!-- Work Experience -->
            ${
              experience && experience.length > 0
                ? `
            <div class="section">
                <div class="section-title">WORK EXPERIENCE</div>
                ${experience
                  .map(
                    (exp) => `
                    <div class="experience-item">
                        <div class="item-header">
                            <div style="flex: 1;">
                                <div class="item-company">${exp.company || ""}</div>
                            </div>
                            <div class="item-date" style="margin-left: 10px;">
                                ${this.formatDateRange(exp.startDate, exp.endDate)}
                            </div>
                        </div>
                        <div class="item-title">${exp.position || ""}</div>
                        ${
                          exp.description && exp.description.length > 0
                            ? `
                        <ul class="item-description">
                            ${exp.description
                              .filter((d) => d && d.trim())
                              .map(
                                (desc) => `<li>${this.escapeHtml(desc)}</li>`,
                              )
                              .join("")}
                        </ul>
                        `
                            : ""
                        }
                    </div>
                `,
                  )
                  .join("")}
            </div>
            `
                : ""
            }

            <!-- Skills -->
            ${
              skills && skills.length > 0
                ? `
            <div class="section">
                <div class="section-title">SKILLS</div>
                ${(() => {
                  // Categorize skills
                  const hardSkills = skills.filter((s) => {
                    const skill = typeof s === "string" ? { name: s } : s;
                    return (
                      skill.category === "hardSkill" ||
                      (!skill.category &&
                        !this.isSoftSkill(skill.name) &&
                        !this.isTool(skill.name))
                    );
                  });
                  const softSkills = skills.filter((s) => {
                    const skill = typeof s === "string" ? { name: s } : s;
                    return (
                      skill.category === "softSkill" ||
                      (!skill.category && this.isSoftSkill(skill.name))
                    );
                  });
                  const tools = skills.filter((s) => {
                    const skill = typeof s === "string" ? { name: s } : s;
                    return (
                      skill.category === "tool" ||
                      (!skill.category && this.isTool(skill.name))
                    );
                  });

                  const formatSkillList = (label, skillArray) => {
                    if (!skillArray || skillArray.length === 0) return "";
                    const skillNames = skillArray
                      .filter(
                        (s) =>
                          (typeof s === "string" && s.trim()) ||
                          (s.name && s.name.trim()),
                      )
                      .map((s) =>
                        this.escapeHtml(typeof s === "string" ? s : s.name),
                      )
                      .join(", ");
                    return skillNames
                      ? `<div class="skills-list"><strong>${label}:</strong> ${skillNames}</div>`
                      : "";
                  };

                  return (
                    formatSkillList("Technical Skills", hardSkills) +
                    formatSkillList("Soft Skills", softSkills) +
                    formatSkillList("Tools", tools)
                  );
                })()}
            </div>
            `
                : ""
            }

            <!-- Certifications -->
            ${
              certifications && certifications.length > 0
                ? `
            <div class="section">
                <div class="section-title">CERTIFICATIONS</div>
                ${certifications
                  .map(
                    (cert) => `
                    <div class="cert-item">
                        <div style="font-weight: bold; font-size: 10pt;">${this.escapeHtml(cert.name || "")}</div>
                        ${
                          cert.issuer || cert.year
                            ? `
                        <div class="cert-details">
                            ${cert.issuer ? this.escapeHtml(cert.issuer) : ""}
                            ${cert.issuer && cert.year ? " | " : ""}
                            ${cert.year || ""}
                        </div>
                        `
                            : ""
                        }
                    </div>
                `,
                  )
                  .join("")}
            </div>
            `
                : ""
            }
        </div>
    </body>
    </html>
    `;
  }

  async generatePDF(profile, user, options = {}) {
    try {
      await this.initializeBrowser();

      const page = await this.browser.newPage();

      // Set viewport for A4 size with proper scaling
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 1.5,
      });

      const htmlContent = this.generateCVHTML(profile, user, options.style);
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfOptions = {
        format: "A4",
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margin: {
          top: "1.5cm",
          right: "1cm",
          bottom: "1.5cm",
          left: "1cm",
        },
        ...options.pdfOptions,
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      await page.close();

      return pdfBuffer;
    } catch (error) {
      console.error("PDF Generation Error:", error);
      throw new Error("Failed to generate PDF");
    }
  }

  async generatePreviewHTML(profile, user, style = "modern") {
    try {
      return this.generateCVHTML(profile, user, style);
    } catch (error) {
      console.error("HTML Preview Generation Error:", error);
      throw new Error("Failed to generate HTML preview");
    }
  }
}

module.exports = new PDFService();
