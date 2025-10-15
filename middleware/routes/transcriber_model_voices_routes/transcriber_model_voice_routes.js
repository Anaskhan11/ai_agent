const express = require("express");
const transcriber_model_voice_controller = require("../../controller/transcribers_models_voices_controller/transcriber_model_voice_controller");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/transcriber_voice_model",
  authMiddleware,
  transcriber_model_voice_controller.get_transcriber_model_voice
);

module.exports = router;
