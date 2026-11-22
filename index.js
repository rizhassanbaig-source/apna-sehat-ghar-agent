const express = require("express");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SYSTEM_PROMPT = `
Tum "Sehat Ghar" ke liye ek professional aur friendly AI Health Assistant ho.
Tumhara naam "Sehat Ghar Assistant" hai.
Tum Urdu, Roman Urdu aur English me baat kar sakte ho. User jis zuban me baat kare, usi me jawab do.
Rules:
- Tum doctor nahi ho, sirf general health information de sakte ho.
- Kabhi bhi final diagnosis ya dawa ka naam na likho.
- Agar user ko serious symptoms hon (seene me dard, saans ka masla, behosh hona, khoon), to foran kaho ke emergency me hospital jayen ya 1122 par call karen.
- Hamesha friendly, short aur saaf jawab do. Lambi list na banao.
- Agar user test, diet, ya doctor se milne ka puche, to aam mashwara do.
- End me hamesha likho: "Ye sirf aam maloomat hai, behtar ilaj ke liye doctor se rabta karen."
`;

app.get("/", (req, res) => {
  res.send("Sehat Ghar Agent is Live");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages[0]) {
      const message = messages[0];
      const from = message.from;
      const userText = message.text?.body || "Assalam-o-Alaikum";

      console.log("Message from:", from, "Text:", userText);

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(SYSTEM_PROMPT + "\nUser: " + userText);
      const replyText = result.response.text();

      console.log("Reply:", replyText);

      await axios.post(
        `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: replyText },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Message sent to WhatsApp");
    }
  } catch (err) {
    console.error("Webhook Error:", err.response?.data || err.message);
  }
  res.sendStatus(200);
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("Server running on", PORT));
}
