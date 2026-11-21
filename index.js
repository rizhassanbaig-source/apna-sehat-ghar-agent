const express = require('express');
const SYSTEM_PROMPT = require('./prompt.js');
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Aiman Rizwan - APNA Sehat Ghar - Online Hai!');
});

app.post('/webhook', async (req, res) => {
  try {
    const msg = req.body.message || req.body.text || "Assalam-o-Alaikum";
    console.log("Patient:", msg);

    // Abhi ke liye simple jawab - Baad me AI lagayenge
    const reply = "Assalam-o-Alaikum! Main Aiman Rizwan hon, APNA Sehat Ghar se. Aap ka Naam, Umar aur Takleef batayein, me Appointment book kar deti hon. Fees 1000 Rs hai, Timing Sham 5 se Raat 10.";

    res.json({ reply: reply, prompt_used: SYSTEM_PROMPT.substring(0, 50) });
  } catch (e) {
    res.json({ reply: "Maazrat, thora masla ho gaya. Dobara batayein." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server Chal Raha Hai Port ' + PORT));
