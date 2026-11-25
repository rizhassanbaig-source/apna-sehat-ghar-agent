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

function findDoctor(text) {
  if (!text) return null;
  const low = text.toLowerCase();
  let n = parseInt(low.replace(/[^0-9]/g, ''));
  if (n >= 1 && n <= DOCTORS.length) return DOCTORS[n - 1];
  for (let d of DOCTORS) {
    let first = d.name.toLowerCase().replace("dr.", "").trim().split(" ")[0];
    if (low.includes(first)) return d;
  }
  return null;
}

function convertDateInputToDate(dateText) {
  const low = (dateText || "").toLowerCase().trim();
  const today = new Date();
  if (low.includes("aaj")) return today.toISOString().split('T')[0];
  if (low.includes("kal")) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
  }
  const numMatch = low.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (numMatch) {
    let d = parseInt(numMatch[1]);
    let m = parseInt(numMatch[2]) - 1;
    let y = numMatch[3] ? parseInt(numMatch[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    return dt.toISOString().split('T')[0];
  }
  const months = { "jan": 0, "january": 0, "feb": 1, "february": 1, "mar": 2, "march": 2, "apr": 3, "april": 3, "may": 4, "jun": 5, "june": 5, "jul": 6, "july": 6, "aug": 7, "august": 7, "sep": 8, "september": 8, "oct": 9, "october": 9, "nov": 10, "november": 10, "dec": 11, "december": 11 };
  for (let key in months) {
    if (low.includes(key)) {
      const dayNum = parseInt(low.replace(/[^0-9]/g, '')) || today.getDate();
      const dt = new Date(today.getFullYear(), months[key], dayNum);
      if (dt < today) dt.setFullYear(dt.getFullYear() + 1);
      return dt.toISOString().split('T')[0];
    }
  }
  const onlyDay = parseInt(low.replace(/[^0-9]/g, ''));
  if (onlyDay >= 1 && onlyDay <= 31) {
    const dt = new Date(today.getFullYear(), today.getMonth(), onlyDay);
    if (dt < today) dt.setMonth(dt.getMonth() + 1);
    return dt.toISOString().split('T')[0];
  }
  const days = { "itwaar": 0, "sunday": 0, "peer": 1, "monday": 1, "mangal": 2, "tuesday": 2, "budh": 3, "wednesday": 3, "jumerat": 4, "thursday": 4, "juma": 5, "friday": 5, "hafta": 6, "saturday": 6 };
  for (let key in days) {
    if (low.includes(key)) {
      const target = days[key];
      const d = new Date();
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }
  return today.toISOString().split('T')[0];
}

function convertTimeToFormTime(timeText) {
  const low = (timeText || "").toLowerCase().trim();
  if (low.includes(":")) return low.split(" ")[0];
  let num = parseInt(low.replace(/[^0-9]/g, '')) || 5;
  let hour = num;
  if (low.includes("sham") || low.includes("shaam") || low.includes("raat") || low.includes("pm") || (num >= 1 && num <= 9)) {
    if (num < 12) hour = num + 12;
  }
  if (hour === 24) hour = 12;
  return String(hour).padStart(2, '0') + ":00";
}

async function saveToSheet(user, from, isCancel = false) {
  try {
    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const params = new URLSearchParams();
    params.append("entry.1811277503", convertDateInputToDate(user.day || "aaj"));
    params.append("entry.1364007535", convertTimeToFormTime(user.time || "5"));
    params.append("entry.2046298723", user.name || from);
    params.append("entry.1419912836", from);
    params.append("entry.913984501", isCancel ? "CANCELLED - " + (user.problem || "") : (user.problem || ""));

    let docName = "Dr. Usman Iqbal";
    if (user.doctor && user.doctor.name) docName = user.doctor.name;
    else if (typeof user.doctor === 'string' && user.doctor) docName = user.doctor;
    params.append("entry.829447129", docName);

    await fetch(formUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
  } catch (e) {
    console.log("Sheet Error:", e);
  }
}

async function sendWhatsApp(to, bodyText) {
  await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: bodyText }
    })
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============ AI AGENT BRAIN ============
async function runAgent(user, userMessage) {
  if (!GEMINI_API_KEY) return { data: null, error: "GEMINI_API_KEY missing in environment variables" };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const doctorsInfo = DOCTORS.map((d, i) => `${i + 1}. ${d.name} | Timing: ${d.timing} | Fees: ${d.fees}`).join("\n");
  const historyText = user.history.slice(-8).join("\n");

  const prompt = `Tum ek Clinic ke Smart AI Receptionist Agent ho. Tumhara naam "Clinic Assistant" hai.
Tum Roman Urdu me bilkul natural, dostana aur insanon jese baat karte ho (robot ki tarah numbered menus mat do jab tak doctors ki list na poochi jaye).

Aaj ki tareekh (YYYY-MM-DD): ${todayStr}
Clinic Timing: Peer se Hafta Subah 10 se Raat 10 baje tak (Itwaar band).
Address: Main Boulevard, Lahore.

DOCTORS KI LIST:
${doctorsInfo}

TUMHARI ZIMMEDARIYAN:
1. User ke message ko samjho: kya wo appointment book karna chahta hai, timing/fees/doctors/address pooch raha hai, ya appointment cancel karna chahta hai?
2. Appointment book karne ke liye ye 5 maloomat zaroori hain:
   - doctor (Doctors list me se koi ek)
   - name (Patient ka naam)
   - day (Appointment ki tareekh - guzri hui ya ghalat date jese 32 Nov accept mat karna)
   - time (Kis waqt aana hai - Doctor ki timing ke andar hona chahiye)
   - problem (Kya takleef ya bimari hai)
3. Agar user ek hi message me 2, 3 ya saari cheezein bata de (jese: "Main Ali hoon, kal sham 7 baje Dr Ali Raza ko bukhar dikhana hai"), to saari maloomat ek hi baar me nikal lo aur jo cheez reh gayi ho sirf wahi pyar se poocho.
4. Agar saari 5 maloomat mil jayein to "action" ko "book" kar do.
5. Agar user cancel karne ko kahe to "action" ko "cancel" kar do.

PICHLI GUFTAGU:
${historyText}

ABHI TAK SAVE MALOOMAT:
- doctor: ${user.doctor ? user.doctor.name : "null"}
- name: ${user.name || "null"}
- day: ${user.day || "null"}
- time: ${user.time || "null"}
- problem: ${user.problem || "null"}

USER KA NAYA MESSAGE: "${userMessage}"

Sirf JSON format me jawab do:
{
  "reply": "User ko bhejne wala jawab Roman Urdu me",
  "doctor": "Doctor ka poora naam ya null",
  "name": "Patient ka naam ya null",
  "day": "Date ya null",
  "time": "Time ya null",
  "problem": "Takleef ya null",
  "action": "none | book | cancel"
}`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastError = "No response from Gemini";

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json"
            }
          })
        });

        const data = await res.json();
        if (!res.ok) {
          lastError = `${model}: ${data?.error?.message || res.status}`;
          if (res.status === 429 || res.status === 503) {
            await sleep(800);
            continue;
          }
          break;
        }

        let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        return { data: JSON.parse(raw), error: null };
      } catch (e) {
        lastError = `${model}: ${e.message || String(e)}`;
        await sleep(500);
      }
    }
  }
  return { data: null, error: lastError };
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(200).send("Clinic AI Agent Active");
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg || msg.type !== "text") return res.status(200).send("OK");

      const from = msg.from;
      const text = msg.text?.body || "";

      if (!users[from]) {
        users[from] = { name: "", day: "", time: "", problem: "", doctor: null, lastBooked: null, history: [] };
      }

      const user = users[from];
      user.history.push(`User: ${text}`);
      if (user.history.length > 10) user.history = user.history.slice(-10);

      const agentRes = await runAgent(user, text);
      const ai = agentRes?.data;

      if (!ai) {
        await sendWhatsApp(from, "Abhi system par thora zyada rush hai, barah-e-karam 1 minute baad dobara message bhejein. 😊🙏");
        return res.status(200).send("OK");
      }

      if (ai.doctor && ai.doctor !== "null") {
        const matched = findDoctor(ai.doctor);
        if (matched) user.doctor = matched;
      }
      if (ai.name && ai.name !== "null") user.name = ai.name;
      if (ai.day && ai.day !== "null") user.day = ai.day;
      if (ai.time && ai.time !== "null") user.time = ai.time;
      if (ai.problem && ai.problem !== "null") user.problem = ai.problem;

      let reply = ai.reply || "Ji batayein, main aapki kya madad kar sakta hoon? 😊";
      let doctorMsg = "";

      if (ai.action === "book" && user.name && user.day && user.time && user.problem) {
        const doc = user.doctor || DOCTORS[0];
        user.lastBooked = { name: user.name, day: user.day, time: user.time, problem: user.problem, doctor: doc };

        reply = `✅ *Appointment Book Ho Gayi!*\n\n👤 *Naam:* ${user.name}\n📅 *Date:* ${user.day}\n⏰ *Time:* ${user.time}\n🤒 *Takleef:* ${user.problem}\n👨‍⚕️ *Doctor:* ${doc.name}\n💰 *Fees:* ${doc.fees}\n\nShukriya! Allah Shifa de. 🤲\nCancel karni ho to 'Cancel' likh dein.`;

        doctorMsg = `🔔 *NAYI APPOINTMENT!* 🔔\n\n👤 *Patient:* ${user.name}\n📱 *Number:* ${from}\n📅 *Date:* ${user.day}\n⏰ *Time:* ${user.time}\n🤒 *Takleef:* ${user.problem}\n👨‍⚕️ *Doctor:* ${doc.name}`;

        await saveToSheet(user.lastBooked, from);
        user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
      }

      if (ai.action === "cancel") {
        if (user.lastBooked) {
          await saveToSheet(user.lastBooked, from, true);
        }
        reply = "Theek hai, aapki Appointment *CANCELLED* kar di hai. ❌\nSheet me bhi CANCELLED update kar diya hai. Dobara zaroorat ho to bata dein. 😊";
        user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
      }

      user.history.push(`Agent: ${reply}`);
      await sendWhatsApp(from, reply);
      if (doctorMsg !== "") await sendWhatsApp(DOCTOR_NUMBER, doctorMsg);

      return res.status(200).send("OK");
    } catch (e) {
      console.log("Error:", e);
      return res.status(200).send("OK");
    }
  }
};
