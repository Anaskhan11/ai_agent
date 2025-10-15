const db = require("../../config/DBConnection");

const get_transcriber_model_voice = async () => {
  const transQuery = "SELECT * FROM transcribers";
  const modelQuery = "SELECT * FROM models";
  const voiceQuery = "SELECT * FROM voices";

  const [transcribersRows] = await db.query(transQuery);
  const [modelsRows] = await db.query(modelQuery);
  const [voicesRows] = await db.query(voiceQuery);

  return {
    transcribers: transcribersRows,
    models: modelsRows,
    voices: voicesRows,
  };
};

module.exports = {
  get_transcriber_model_voice,
};
