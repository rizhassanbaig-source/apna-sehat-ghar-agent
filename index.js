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

function doctorsListText() {
  let t = "Hamare Doctors: 👨‍⚕️\n\n";
  DOCTORS.forEach((d, i) => {
    t += `${i + 1}. ${d.name} - ${d.timing} - Fees ${d.fees}\n`;
  });
  return t;
}

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

function extractNameSmart(text) {
  const clean = (text || "").trim();
  const low = clean.toLowerCase();

  // Agar sawal lag raha ho ya bohot lamba jumla ho
  if (low.includes("kiya ") || low.includes("kya ") || low.includes("?") || clean.split(/\s+/).length > 5) {
    const match = clean.match(/(?:mera\s+naam|naam|name)\s+(?:hai\s+)?([a-zA-Z\u0600-\u06FF]+(?:\s+[a-zA-Z\u0600-\u06FF]+)?)/i);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const badWords = ["ali hai", "kya", "kiya", "appointment", "book", "doctor"];
      if (!badWords.includes(candidate.toLowerCase())) return candidate;
    }
    return null;
  }

  const match = clean.match(/(?:mera\s+naam|naam|name)\s+(?:hai\s+)?(.+)/i);
  if (match && match[1]) return match[1].trim();

  if (/^[a-zA-Z\u0600-\u06FF\s]{2,35}$/.test(clean) && !/\d/.test(clean)) {
    return clean;
  }
  return null;
}

function validateAndFormatDate(dateText) {
  const raw = (dateText || "").trim();
  const low = raw.toLowerCase();
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }));

  if (low.includes("aaj") || low.includes("today")) {
    return { valid: true, formatted: "Aaj", iso: today.toISOString().split('T')[0] };
  }
  if (low.includes("kal") || low.includes("tomorrow")) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return { valid: true, formatted: "Kal", iso: t.toISOString().split('T')[0] };
  }

  // Check explicit day number like "32 date ko", "31", "28 ko"
  const dayMatch = low.match(/\b(\d{1,2})\b/);
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    if (dayNum < 1 || dayNum > 31) {
      return { valid: false, reason: `${dayNum} koi valid date nahi hoti. Mehine ki date 1 se 30/31 ke darmiyan hoti hai.` };
    }
    // November has 30 days
    if (today.getMonth() === 10 && !low.includes("dec") && !low.includes("jan") && dayNum > 30) {
      return { valid: false, reason: `November me sirf 30 din hote hain, ${dayNum} November nahi hoti.` };
    }
    const dt = new Date(today.getFullYear(), today.getMonth(), dayNum);
    if (dt < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      dt.setMonth(dt.getMonth() + 1);
    }
    return { valid: true, formatted: raw, iso: dt.toISOString().split('T')[0] };
  }

  const days = { "itwaar": 0, "sunday": 0, "peer": 1, "monday": 1, "mangal": 2, "tuesday": 2, "budh": 3, "wednesday": 3, "jumerat": 4, "thursday": 4, "juma": 5, "friday": 5, "hafta": 6, "saturday": 6 };
  for (let key in days) {
    if (low.includes(key)) {
      const target = days[key];
      const d = new Date(today);
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return { valid: true, formatted: raw, iso: d.toISOString().split('T')[0] };
    }
  }

  return { valid: false, reason: "Barah-e-karam clear date batayein, jese: Aaj, Kal, 26, ya 28 November." };
}

function validateAndFormatTime(timeText) {
  const raw = (timeText || "").trim();
  const low = raw.toLowerCase();

  const numMatch = low.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
  if (!numMatch) {
    return { valid: false, reason: "Time clear nahi hai. Meherbani kar ke time batayein, jese: 6 baje, shaam 7 baje, ya subah 11 baje." };
  }

  let hour = parseInt(numMatch[1], 10);
  const mins = numMatch[2] ? parseInt(numMatch[2], 10) : 0;

  if (hour === 0 || hour > 24 || mins > 59) {
    return { valid: false, reason: `"${raw}" valid time nahi hai. Barah-e-karam 1 se 12 ke darmiyan time batayein (jese: 6 baje ya 7 baje).` };
  }

  // Agar user "13 bajey" likhe to samjhayein
  if (hour > 12 && !low.includes(":")) {
    return { valid: false, reason: `Ghari me 13 bajey nahi hote 😊. Agar dopahar/shaam ka 1 bajta hai to "1 baje dopahar" likhein, warna apna pasandida time (jese 6 baje) batayein.` };
  }

  let finalHour = hour;
  if (low.includes("sham") || low.includes("shaam") || low.includes("raat") || low.includes("pm")) {
    if (hour < 12) finalHour = hour + 12;
  } else if (!low.includes("subah") && !low.includes("am") && !low.includes("dopahar") && hour >= 1 && hour <= 9) {
    finalHour = hour + 12;
  }

  if (finalHour === 24) finalHour = 12;
  const formTime = String(finalHour).padStart(2, '0') + ":" + String(mins).padStart(2, '0');

  return { valid: true, formatted: raw, formTime };
}

function convertDateInputToDate(dateText) {
  const res = validateAndFormatDate(dateText);
  if (res.valid) return res.iso;
  return new Date().toISOString().split('T')[0];
}

function convertTimeToFormTime(timeText) {
  const res = validateAndFormatTime(timeText);
  if (res.valid) return res.formTime;
  return "17:00";
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

// ============ AI AGENT BRAIN ============
async function runAgent(user, userMessage) {
  if (!GEMINI_API_KEY) return null;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const doctorsInfo = DOCTORS.map((d, i) => `${i + 1}. ${d.name} | Timing: ${d.timing} | Fees: ${d.fees}`).join("\n");
  const historyText = user.history.slice(-8).join("\n");

  const prompt = `Tum ek Clinic ke Smart AI Receptionist Agent ho. Tumhara naam "Clinic Assistant" hai.
Tum Roman Urdu me bilkul natural, dostana aur insanon jese baat karte ho.

Aaj ki tareekh (YYYY-MM-DD): ${todayStr}
Clinic Timing: Peer se Hafta Subah 10 se Raat 10 baje tak (Itwaar band).
Address: Main Boulevard, Lahore.

DOCTORS KI LIST:
${doctorsInfo}

TUMHARI ZIMMEDARIYAN:
1. User ke message ko samjho: kya wo appointment book karna chahta hai, timing/fees/doctors/address/rule pooch raha hai, ya appointment cancel karna chahta hai?
2. Appointment book karne ke liye ye 5 maloomat zaroori hain: doctor, name, day, time, problem.
3. Agar user ghalat tareekh (jese 32 Nov) ya ghalat waqt (jese 13 bajey) ya doctor ki timing ke bahar ka waqt bataye to pyar se durust tareekh/waqt poochho.
4. Agar user saari 5 maloomat de de to "action" ko "book" kar do.
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

  const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

  for (const model of models) {
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
      if (!res.ok) continue;

      let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(raw);
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ============ SMART BACKUP FLOW ============
function handleInstantBackup(user, text) {
  const low = text.toLowerCase().trim();
  const matchedDoc = findDoctor(text);
  if (matchedDoc) user.doctor = matchedDoc;

  if (!user.step) user.step = "ask_name";

  if (low === "cancel" || low.includes("cancel appointment")) {
    user.step = "ask_name";
    return { type: "cancel", reply: "Theek hai, aapki Appointment *CANCELLED* kar di hai. ❌\nDobara zaroorat ho to bata dein. 😊" };
  }

  if (low === "reset" || low === "menu") {
    user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null; user.step = "ask_name";
    return {
      type: "none",
      reply: `Assalam-o-Alaikum! Main Clinic Assistant hoon. 😊\n\n${doctorsListText()}\nAppointment book karne ke liye pehle apna naam bata dein?`
    };
  }

  if (user.step === "ask_name") {
    const parsedName = extractNameSmart(text);
    if (!parsedName) {
      return {
        type: "none",
        reply: "Meherbani kar ke apna sirf naam bata dein (jese: Ali Ahmed), taake main aapki appointment aage barha sakoon. 😊"
      };
    }
    user.name = parsedName;
    user.step = "ask_day";
    return { type: "none", reply: `Shukriya ${user.name}! 😊 Kis date ko aana hai? (Jese: Aaj, Kal, 26, ya 28 November)` };
  }

  if (user.step === "ask_day") {
    const dateCheck = validateAndFormatDate(text);
    if (!dateCheck.valid) {
      return { type: "none", reply: `${dateCheck.reason} 😊` };
    }
    user.day = dateCheck.formatted;
    user.step = "ask_time";
    return { type: "none", reply: `Theek hai, ${user.day} ko kis time aana chahein ge? (Jese: 6 baje, 7 baje shaam)` };
  }

  if (user.step === "ask_time") {
    const timeCheck = validateAndFormatTime(text);
    if (!timeCheck.valid) {
      return { type: "none", reply: `${timeCheck.reason}` };
    }
    user.time = timeCheck.formatted;
    user.step = "ask_problem";
    return { type: "none", reply: "Aakhri baat: kya takleef ya checkup karwana hai? (Jese: Bukhar, Pait dard)" };
  }

  if (user.step === "ask_problem") {
    user.problem = text;
    user.step = "ask_name";
    return { type: "book", reply: "" };
  }

  return {
    type: "none",
    reply: `Assalam-o-Alaikum! Main Clinic Assistant hoon. 😊\n\n${doctorsListText()}\nAppointment book karne ke liye apna naam bata dein?`
  };
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
        users[from] = { step: "ask_name", name: "", day: "", time: "", problem: "", doctor: null, lastBooked: null, history: [] };
      }

      const user = users[from];
      user.history.push(`User: ${text}`);
      if (user.history.length > 10) user.history = user.history.slice(-10);

      const ai = await runAgent(user, text);

      let reply = "";
      let doctorMsg = "";

      if (!ai) {
        const backup = handleInstantBackup(user, text);

        if (backup.type === "book") {
          const doc = user.doctor || DOCTORS[0];
          user.lastBooked = { name: user.name || from, day: user.day || "Aaj", time: user.time || "6 baje", problem: user.problem || "Checkup", doctor: doc };
          reply = `✅ *Appointment Book Ho Gayi!*\n\n👤 *Naam:* ${user.lastBooked.name}\n📅 *Date:* ${user.lastBooked.day}\n⏰ *Time:* ${user.lastBooked.time}\n🤒 *Takleef:* ${user.lastBooked.problem}\n👨‍⚕️ *Doctor:* ${doc.name}\n💰 *Fees:* ${doc.fees}\n\nShukriya! Allah Shifa de. 🤲`;
          doctorMsg = `🔔 *NAYI APPOINTMENT!* 🔔\n\n👤 *Patient:* ${user.lastBooked.name}\n📱 *Number:* ${from}\n📅 *Date:* ${user.lastBooked.day}\n⏰ *Time:* ${user.lastBooked.time}\n🤒 *Takleef:* ${user.lastBooked.problem}\n👨‍⚕️ *Doctor:* ${doc.name}`;
          await saveToSheet(user.lastBooked, from);
          user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
        } else if (backup.type === "cancel") {
          if (user.lastBooked) await saveToSheet(user.lastBooked, from, true);
          reply = backup.reply;
          user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
        } else {
          reply = backup.reply;
        }
      } else {
        if (ai.doctor && ai.doctor !== "null") {
          const matched = findDoctor(ai.doctor);
          if (matched) user.doctor = matched;
        }
        if (ai.name && ai.name !== "null") user.name = ai.name;
        if (ai.day && ai.day !== "null") user.day = ai.day;
        if (ai.time && ai.time !== "null") user.time = ai.time;
        if (ai.problem && ai.problem !== "null") user.problem = ai.problem;

        reply = ai.reply || "Ji batayein, main aapki kya madad kar sakta hoon? 😊";

        if (ai.action === "book" && user.name && user.day && user.time && user.problem) {
          const doc = user.doctor || DOCTORS[0];
          user.lastBooked = { name: user.name, day: user.day, time: user.time, problem: user.problem, doctor: doc };
          reply = `✅ *Appointment Book Ho Gayi!*\n\n👤 *Naam:* ${user.name}\n📅 *Date:* ${user.day}\n⏰ *Time:* ${user.time}\n🤒 *Takleef:* ${user.problem}\n👨‍⚕️ *Doctor:* ${doc.name}\n💰 *Fees:* ${doc.fees}\n\nShukriya! Allah Shifa de. 🤲\nCancel karni ho to 'Cancel' likh dein.`;
          doctorMsg = `🔔 *NAYI APPOINTMENT!* 🔔\n\n👤 *Patient:* ${user.name}\n📱 *Number:* ${from}\n📅 *Date:* ${user.day}\n⏰ *Time:* ${user.time}\n🤒 *Takleef:* ${user.problem}\n👨‍⚕️ *Doctor:* ${doc.name}`;
          await saveToSheet(user.lastBooked, from);
          user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
        }

        if (ai.action === "cancel") {
          if (user.lastBooked) await saveToSheet(user.lastBooked, from, true);
          reply = "Theek hai, aapki Appointment *CANCELLED* kar di hai. ❌\nSheet me bhi CANCELLED update kar diya hai. Dobara zaroorat ho to bata dein. 😊";
          user.name = ""; user.day = ""; user.time = ""; user.problem = ""; user.doctor = null;
        }
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
