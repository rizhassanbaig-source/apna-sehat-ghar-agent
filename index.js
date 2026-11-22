const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (msg && msg.type === 'text') {
        const from = msg.from;
        const text = msg.text.body;

        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          let reply = "";
for (let i = 0; i < 3; i++) {
  const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const gemData = await gemRes.json();
  reply = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (reply) break;
  await new Promise(r => setTimeout(r, 2000));
}
if (!reply) reply = "GEMINI ERROR: Model busy hai, 1 min baad phir Hi bhejen";
        await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: reply } })
        });
      }
      return res.status(200).send('OK');
    } catch (e) {
      console.log('Error:', e.message);
      return res.status(200).send('OK');
    }
  }
  return res.status(200).send('OK');
};
