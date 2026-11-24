const VERIFY_TOKEN = "clinic123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DOCTOR_NUMBER = "923364776344";
const users = {};

const DOCTORS = [
  { name: "Dr. Usman Iqbal", timing: "Subah 10-2, Shaam 5-9", fees: "500 Rs" },
  { name: "Dr. Ali Raza", timing: "Shaam 6-10", fees: "500 Rs" },
  { name: "Dr. Fatima Khan", timing: "Subah 10-1", fees: "400 Rs" },
  { name: "Dr. Ahmed Sheikh", timing: "Dopahar 2-6", fees: "500 Rs" },
  { name: "Dr. Ayesha Noor", timing: "Shaam 5-9", fees: "400 Rs" }
];

const FORM_ID = "1FAIpQLScIb7q0BfmGFk-cSLmqFYUi4RTVOosxgiltDrvJ-66DPLq9bQ";

function convertDateInputToDate(dateText) {
  const low = (dateText||"").toLowerCase().trim();
  const today = new Date();
  if (low.includes("aaj")) return today.toISOString().split('T')[0];
  if (low.includes("kal")) { const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().split('T')[0]; }
  const numMatch = low.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (numMatch) { let d = parseInt(numMatch[1]); let m = parseInt(numMatch[2]) - 1; let y = numMatch[3] ? parseInt(numMatch[3]) : today.getFullYear(); if (y < 100) y += 2000; const dt = new Date(y, m, d); return dt.toISOString().split('T')[0]; }
  const months = { "jan": 0, "january": 0, "feb": 1, "february": 1, "mar": 2, "march": 2, "apr": 3, "april": 3, "may": 4, "jun": 5, "june": 5, "jul": 6, "july": 6, "aug": 7, "august": 7, "sep": 8, "september": 8, "oct": 9, "october": 9, "nov": 10, "november": 10, "dec": 11, "december": 11 };
  for (let key in months) { if (low.includes(key)) { const dayNum = parseInt(low.replace(/[^0-9]/g, '')) || today.getDate(); const dt = new Date(today.getFullYear(), months[key], dayNum); if (dt < today) dt.setFullYear(dt.getFullYear() + 1); return dt.toISOString().split('T')[0]; } }
  const onlyDay = parseInt(low.replace(/[^0-9]/g, ''));
  if (onlyDay >= 1 && onlyDay <= 31) { const dt = new Date(today.getFullYear(), today.getMonth(), onlyDay); if (dt < today) dt.setMonth(dt.getMonth() + 1); return dt.toISOString().split('T')[0]; }
  const days = { "itwaar": 0, "sunday": 0, "peer": 1, "monday": 1, "mangal": 2, "tuesday": 2, "budh": 3, "wednesday": 3, "jumerat": 4, "thursday": 4, "juma": 5, "friday": 5, "hafta": 6, "saturday": 6 };
  for (let key in days) { if (low.includes(key)) { const target = days[key]; const d = new Date(); let diff = (target - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; } }
  return today.toISOString().split('T')[0];
}

function convertTimeToFormTime(timeText) {
  const low = (timeText||"").toLowerCase().trim();
  if (low.includes(":")) return low.split(" ")[0];
  let num = parseInt(low.replace(/[^0-9]/g, '')) || 5;
  let hour = num;
  if (low.includes("sham") || low.includes("raat") || low.includes("pm") || (num >= 1 && num <= 9)) { if (num < 12) hour = num + 12; }
  if (hour === 24) hour = 12;
  return String(hour).padStart(2, '0') + ":00";
}

async function saveToSheet(user, from, isCancel=false) {
  try {
    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const params = new URLSearchParams();
    params.append("entry.1811277503", convertDateInputToDate(user.day || "aaj"));
    params.append("entry.1364007535", convertTimeToFormTime(user.time || "5"));
    params.append("entry.2046298723", user.name || from);
    params.append("entry.1419912836", from);
    params.append("entry.913984501", isCancel ? "CANCELLED - " + (user.problem||"") : (user.problem||""));
    let docName = "Dr. Usman Iqbal";
    if (user.doctor && user.doctor.name) docName = user.doctor.name;
    else if (typeof user.doctor === 'string' && user.doctor) docName = user.doctor;
    params.append("entry.829447129", docName);
    await fetch(formUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  } catch (e) { console.log("Sheet Error:", e); }
}

async function sendWhatsApp(to, bodyText) {
  await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: bodyText } })
  });
}

// ============ AGENT BRAIN - GEMINI ============
async function askAgent(user, userMessage) {
  const todayStr = new Date().toISOString().split('T')[0];
  const doctorsInfo = DOCTORS.map((d,i)=> (i+1)+". "+d.name+" - Timing: "+d.timing+" - Fees: "+d.fees).join("\n");

  const systemPrompt = `Tum ek Clinic ka Smart AI AGENT ho. Tumhara naam "Clinic Assistant" hai. Tum Roman Urdu me baat karte ho, pyar se, insanon jese.

Aaj ki tareekh: ${todayStr}. Aaj 24 November 2026 hai. Guzri hui date kabhi accept mat karna.

DOCTORS:
${doctorsInfo}
Clinic Timing: Peer-Hafta Subah 10 - Raat 10, Itwaar Band.
Address: Main Boulevard, Lahore.

TUMHARA KAAM:
1. User se dosti se baat karo, robot jese 1-2-3-4 mat do, natural baat karo.
2. User jo bhi kahe, usme se samjho: usko Appointment chahiye? Timing? Fees? Doctor? Cancel?
3. Appointment ke liye ye 5 cheezein chahiye: Doctor, Naam, Date, Time, Takleef.
4. User ek hi message me sab kuch de de to sab ek sath le lo. Jese "Mera naam Ali hai, kal sham 5 baje Dr Usman se bukhar ka check karana hai" - to sab samajh jao, dobara mat poocho.
5. Agar date galat hai jese 32 November, ya guzri hui hai jese 12 November, to pyar se mana karo aur sahi date mango.
6. Agar sab mil jaye to confirmation do.

ABHI TAK KI MALOOMAT (STATE):
Doctor: ${user.doctor ? user.doctor.name : "pata nahi"}
Naam: ${user.name || "pata nahi"}
Date: ${user.day || "pata nahi"}
Time: ${user.time || "pata nahi"}
Takleef: ${user.problem || "pata nahi"}

USER KA NAYA MESSAGE: "${userMessage}"

Sirf JSON me jawab do, koi extra text mat do. Format ye hai:
{
  "reply": "User ko bhejne wala jawab Roman Urdu me, pyar se, emoji ke sath",
  "doctor": "Doctor ka poora naam ya null",
  "name": "User ka naam ya null",
  "day": "Date jese '25 November' ya null",
  "time": "Time jese '5 baje' ya null",
  "problem": "Takleef ya null",
  "action": "none / book / cancel"
}
Rules:
- Jo cheez pehle se pata hai, usko dobara null mat karo, wahi rakho.
- Agar user ne nayi cheez batayi to usko update karo.
- action "book" sirf tab rakho jab 5 cheezein COMPLETE hon.
- action "cancel" sirf tab jab user cancel kahe.
- reply me kabhi JSON ka zikar mat karo.
`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7 } })
    });
    const data = await res.json();
    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.log("Gemini Error:", e);
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] === VERIFY_TOKEN) return res.status(200).send(req.query["hub.challenge"]);
    return res.status(403).send("Forbidden");
  }
  if (req.method === "POST") {
    try {
      const body = req.body;
      const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return res.status(200).send("OK");
      const from = msg.from;
      const text = msg.text?.body || "";
      if (!users[from]) users[from] = { name: "", day: "", time: "", problem: "", doctor: null, lastBooked: null, history: [] };
      const user = users[from];
      user.history.push("User: " + text);
      if (user.history.length > 10) user.history = user.history.slice(-10);

      // AGENT SE POOCHO
      let ai = await askAgent(user, text);

      // Agar Gemini fail ho jaye to simple fallback
      if (!ai) {
        await sendWhatsApp(from, "Assalam-o-Alaikum! Main Clinic Assistant hon. 😊\n\nKya madad karun? Appointment book karni hai, Timing ya Fees poochni hai?\n\nBas apni baat likh dein, jese: 'Mujhe kal sham ko Dr Usman se milna hai'");
        return res.status(200).send("OK");
      }

      // STATE UPDATE KARO - Agent ne jo samjha
      if (ai.doctor) {
        let found = DOCTORS.find(d => d.name.toLowerCase().includes(ai.doctor.toLowerCase().split(" ")[1]) || ai.doctor.toLowerCase().includes(d.name.toLowerCase().split(" ")[1]));
        if (found) user.doctor = found;
      }
      if (ai.name && ai.name !== "pata nahi") user.name = ai.name;
      if (ai.day && ai.day !== "pata nahi") user.day = ai.day;
      if (ai.time && ai.time !== "pata nahi") user.time = ai.time;
      if (ai.problem && ai.problem !== "pata nahi") user.problem = ai.problem;

      let reply = ai.reply || "Batao, kya madad karun? 😊";
      let doctorMsg = "";

      // BOOK HO GAYA?
      if (ai.action === "book") {
        user.lastBooked = { name: user.name, day: user.day, time: user.time, problem: user.problem, doctor: user.doctor };
        reply = "✅ Appointment Book Ho Gayi!\n\n👤 Naam: " + user.name + "\n📅 Date: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: " + (user.doctor ? user.doctor.name : "Dr. Usman Iqbal") + "\n💰 Fees: " + (user.doctor ? user.doctor.fees : "500 Rs") + "\n\nShukriya! Allah Shifa de. 🤲\n\nCancel karni ho to 'Cancel' likh dein.";
        doctorMsg = "🔔 NAYI APPOINTMENT! 🔔\n\n👤 Patient: " + user.name + "\n📱 Number: " + from + "\n📅 Date: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: " + (user.doctor ? user.doctor.name : "Dr. Usman Iqbal");
        await saveToSheet(user, from);
        user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
      }

      // CANCEL?
      if (ai.action === "cancel") {
        if (user.lastBooked) await saveToSheet(user.lastBooked, from, true);
        reply = "Theek hai, aapki Appointment CANCELLED kar di hai. ❌\nSheet me CANCELLED likh diya hai.\n\nDobara chahiye to bas bata dein. 😊";
        user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
      }

      user.history.push("Agent: " + reply);
      await sendWhatsApp(from, reply);
      if (doctorMsg !== "") await sendWhatsApp(DOCTOR_NUMBER, doctorMsg);
      return res.status(200).send("OK");
    } catch (e) { console.log(e); return res.status(200).send("OK"); }
  }
};
