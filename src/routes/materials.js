const router = require("express").Router();
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  uploadMaterial,
  getMaterials,
  getMaterial,
  deleteMaterial,
  summarize,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
} = require("../controllers/materialController");

// Require authentication for all routes
router.use(protect);

// Material routes
router.post("/upload", upload.single("file"), uploadMaterial);
router.get("/", getMaterials);
router.get("/:id", getMaterial);
router.delete("/:id", deleteMaterial);

// AI processing routes
router.post("/:id/summarize", summarize);
router.post("/:id/flashcards", generateFlashcards);
router.post("/:id/quiz", generateQuiz);
router.post("/:id/study-plan", generateStudyPlan);

module.exports = router;