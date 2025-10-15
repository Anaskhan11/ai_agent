const transcriber_model_voice_model = require("../../model/transcriber_model_voices_model/transcriber_model_voice_model");

const get_transcriber_model_voice = async (req, res) => {
  try {
    const data =
      await transcriber_model_voice_model.get_transcriber_model_voice();
    if (!data) {
      res.status(404).json({ message: "Data Not Found" });
    }
    res.status(200).json({ data: data });
  } catch (error) {
    res.status(500).json(error);
  }
};

module.exports = {
  get_transcriber_model_voice,
};
