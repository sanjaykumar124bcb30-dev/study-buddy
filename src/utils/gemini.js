const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const askGemini = async (prompt) => {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const modelName of modelsToTry) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        const is503 = error.status === 503 || (error.message && error.message.includes("503"));
        
        if (is503 && attempt < 2) {
          console.warn(`[${modelName}] Busy (503). Retrying in 1.5s...`);
          await new Promise((res) => setTimeout(res, 1500));
        } else if (is503) {
          console.warn(`[${modelName}] Outage active. Switching to fallback model: ${FALLBACK_MODEL}...`);
          break;
        } else {
          throw error;
        }
      }
    }
  }

  throw new Error("All Gemini models are currently experiencing high demand. Please try again in a few moments.");
};

module.exports = { askGemini };