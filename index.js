const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERIFY_TOKEN = "aiman123";
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Webhook Verify
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// AI Reply with Gemini
async function getAIReply(userMsg) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Tum Aiman ho, Sehat Ghar ki AI health assistant. Tum Urdu + Roman Urdu + English mix me baat karti ho, pyar se, dost jese. Tum doctor nahi ho, sirf general health info deti ho. Agar serious bimari lage to doctor ke paas bhejo. User ka sawal: ${userMsg}`
          }]
        }]
      })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    return "Sorry, abhi thora masla ho gaya. Dobara try karein.";
  }
}

// Webhook Receive Message
app.post('/webhook', async (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));
  const entry = req.body.entry?.[0]?.changes?.[0]?.value;
  const msg = entry?.messages?.[0];
  if (msg && msg.type === 'text') {
    const from = msg.from;
    const userText = msg.text.body;
    const aiReply = await getAIReply(userText);
    console.log("AI Reply for", from, ":", aiReply);
    // Note: Reply WhatsApp Cloud API se bhejna hai, token yahan add karein
  }
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Aiman AI is Running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on ' + PORT));
