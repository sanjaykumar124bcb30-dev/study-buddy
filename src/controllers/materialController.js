const fs = require("fs");
const asyncHandler = require("express-async-handler");
const Material = require("../models/Material");
const { askGemini } = require("../utils/gemini");

// Helper: read uploaded file text
const readFileText = (filePath) => fs.readFileSync(filePath, "utf-8");

// Helper: safely parse JSON returned by Gemini
const parseAIResponse = (rawText) => {
  try {
    const clean = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    throw new Error("Failed to parse AI output into valid JSON");
  }
};

// @desc    Upload new study material
// @route   POST /api/materials/upload
// @access  Private
const uploadMaterial = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const { title } = req.body;
  const content = readFileText(req.file.path);

  const material = await Material.create({
    user: req.user.userId,
    title: title || req.file.originalname,
    content,
    filename: req.file.originalname,
  });

  // Clean up file from disk after reading
  if (fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }

  res.status(201).json({ message: "Material uploaded", material });
});

// @desc    Get all materials
// @route   GET /api/materials
// @access  Private
const getMaterials = asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user.userId };
  const materials = await Material.find(filter)
    .select("-content -flashcards -quiz -studyPlan")
    .sort("-createdAt");
  res.json(materials);
});

// @desc    Get single material by ID
// @route   GET /api/materials/:id
// @access  Private
const getMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    res.status(403);
    throw new Error("Access denied");
  }

  res.json(material);
});

// @desc    Delete material
// @route   DELETE /api/materials/:id
// @access  Private
const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    res.status(403);
    throw new Error("Access denied");
  }

  await material.deleteOne();
  res.json({ message: "Material deleted successfully" });
});

// @desc    Generate summary for material
// @route   POST /api/materials/:id/summarize
// @access  Private
const summarize = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  const prompt = `Summarize the following study material clearly and concisely in bullet points:\n\n${material.content}`;
  const summary = await askGemini(prompt);

  material.summary = summary;
  await material.save();

  res.json({ summary });
});

// @desc    Generate flashcards from material
// @route   POST /api/materials/:id/flashcards
// @access  Private
const generateFlashcards = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  const count = req.body.count || 5;

  const prompt = `
Create ${count} flashcards from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "answer": "..."}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const flashcards = parseAIResponse(raw);

  material.flashcards = flashcards;
  await material.save();

  res.json({ flashcards });
});

// @desc    Generate multiple choice quiz
// @route   POST /api/materials/:id/quiz
// @access  Private
const generateQuiz = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  const count = req.body.count || 5;

  const prompt = `
Create ${count} multiple choice quiz questions from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const quiz = parseAIResponse(raw);

  material.quiz = quiz;
  await material.save();

  res.json({ quiz });
});

// @desc    Generate personalized study plan
// @route   POST /api/materials/:id/study-plan
// @access  Private
const generateStudyPlan = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error("Material not found");
  }

  const { goal, hoursPerDay, days } = req.body;

  const prompt = `
You are a study planner. Based on the study material below, create a personalized ${days || 7}-day study plan.
Student's goal: ${goal || "Understand and retain the material"}
Available study time: ${hoursPerDay || 2} hours per day.

Return a clear day-by-day schedule with topics and activities.

Study material:
${material.content}
`;

  const studyPlan = await askGemini(prompt);

  material.studyPlan = studyPlan;
  await material.save();

  res.json({ studyPlan });
});

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterial,
  deleteMaterial,
  summarize,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
};