const express = require("express");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// --- ENV VARIABLES ---
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "aiman123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- 1. WEBHOOK VERIFY (Meta ke liye) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- 2. SEND MESSAGE FUNCTION (Yehi missing tha) ---
async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Reply sent to:", to);
  } catch (err) {
    console.error("Send Error:", err.response?.data || err.message);
  }
}

// --- 3. WEBHOOK RECEIVE ---
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return;

    const msg = value.messages[0];
    const from = msg.from;
    const userText = msg.text?.body;

    if (!userText) return;

    console.log("User:", from, "Msg:", userText);

    const prompt = `Tum Aiman ho, Sehat Ghar ki AI health assistant. Tum Urdu / Roman Urdu me baat karti ho. Tum patient ki madad karti ho, unki sehat ke masail sunti ho, aur simple, pyar bhare andaz me jawab deti ho. Tum doctor nahi ho, is liye serious masle me doctor se milne ka mashwara deti ho. User ka message: ${userText}`;

    const result = await model.generateContent(prompt);
    const aiReply = result.response.text();

    console.log("AI Reply:", aiReply);

    await sendWhatsAppMessage(from, aiReply);

  } catch (err) {
    console.error("Webhook Error:", err.message);
  }
});

// --- 4. HOME CHECK ---
app.get("/", (req, res) => {
  res.send("Aiman AI is Running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
