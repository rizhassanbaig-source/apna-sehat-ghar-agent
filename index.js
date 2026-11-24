const VERIFY_TOKEN = "clinic123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Doctor - Dr. Usman Iqbal
const DOCTOR_NUMBER = "923364776344";

const users = {};

// --- GOOGLE FORM / SHEET WALA HISSA ---
const FORM_ID = "1FAIpQLScIb7q0BfmGFk-cSLmqFYUi4RTVOosxgiltDrvJ-66DPLq9bQ";

function convertDayToDate(dayText) {
  const low = dayText.toLowerCase().trim();
  const today = new Date();
  if (low.includes("aaj")) return today.toISOString().split('T')[0];
  if (low.includes("kal")) {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return t.toISOString().split('T')[0];
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
  const low = timeText.toLowerCase().trim();
  if (low.includes(":")) return low.split(" ")[0];
  let num = parseInt(low.replace(/[^0-9]/g, '')) || 5;
  let hour = num;
  if (low.includes("sham") || low.includes("raat") || low.includes("pm") || (num >= 1 && num <= 9)) {
    if (num < 12) hour = num + 12;
  }
  if (hour === 24) hour = 12;
  return String(hour).padStart(2, '0') + ":00";
}

async function saveToSheet(user, from) {
  try {
    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const params = new URLSearchParams();
    params.append("entry.1811277503", convertDayToDate(user.day));
    params.append("entry.1364007535", convertTimeToFormTime(user.time));
    params.append("entry.2046298723", user.name);
    params.append("entry.1419912836", from);
    params.append("entry.913984501", user.problem);
    params.append("entry.829447129", "Dr. Usman Iqbal");
    await fetch(formUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
  } catch (e) { console.log("Sheet Error:", e); }
}
// --- KHATAM ---

// --- FIXED: Ab poora lafz check hoga, andar wala hissa nahi ---
function hasWord(low, words) {
  const allWords = low.split(/[\s,!.?]+/);
  return words.some(w => allWords.includes(w));
}
function isGreeting(low) {
  return hasWord(low, ["hi", "hello", "salam", "aoa", "assalam", "hey", "hii"]);
}
function isAppointment(low) {
  return low.includes("appoint") || low.includes("apoint") || low.includes("apoit") || low.includes("book") || low.includes("milna") || low.includes("check") || low.includes("dikhana");
}
function isFees(low) {
  return hasWord(low, ["fee", "fees", "paisa", "pese", "charges", "kitne"]);
}
function isTiming(low) {
  return hasWord(low, ["timing", "time", "kab", "khulta", "open", "baje"]);
}
function isDoctor(low) {
  return hasWord(low, ["doctor", "dr", "hakim", "kon"]);
}
function isAddress(low) {
  return low.includes("kahan") || low.includes("address") || low.includes("location") || low.includes("kidhar") || low.includes("jaga");
}
function isCancel(low) {
  return low.includes("cancel") || low.includes("rehne") || low.includes("chor") || low.includes("nahi chahiye") || low.includes("band");
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return res.status(200).send("OK");

      const from = msg.from;
      const text = msg.text?.body || "";
      const low = text.toLowerCase().trim();

      if (!users[from]) {
        users[from] = { step: "start", name: "", day: "", time: "", problem: "" };
      }
      const user = users[from];
      let reply = "";
      let doctorMsg = "";

      // --- FIXED: Pehle Step wale jawab, phir baaki cheezein ---
      // Agar user Naam / Din / Time / Takleef bata raha hai, to usko pehle lo

      if (isCancel(low) && user.step !== "start") {
        user.step = "menu";
        reply = "Theek hai, cancel kar diya. 👍\n\nDobara chahiye to batayein:\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
      }
      else if (user.step === "ask_name") {
        user.name = text;
        reply = "Shukriya " + user.name + "! ❤️\nKis din ana hai? (Jese: Peer, Mangal, Budh, Kal, Aaj)";
        user.step = "ask_day";
      }
      else if (user.step === "ask_day") {
        user.day = text;
        reply = "Theek hai, " + user.day + " ko kis time ana hai? (Jese: 5 baje, 7 baje, Sham ko)";
        user.step = "ask_time";
      }
      else if (user.step === "ask_time") {
        user.time = text;
        reply = "Aakhri sawal: Kya takleef hai? (Jese: Bukhar, Pait me dard, Nazla)";
        user.step = "ask_problem";
      }
      else if (user.step === "ask_problem") {
        user.problem = text;
        reply = "✅ Appointment Book Ho Gayi!\n\n👤 Naam: " + user.name + "\n📅 Din: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: Dr. Usman Iqbal\n💰 Fees: 500 Rs\n\nShukriya! Allah Shifa de. 🤲\n\nKuch aur poochna hai to 'Hi' likhein.";
        
        doctorMsg = "🔔 NAYI APPOINTMENT! 🔔\n\n👤 Patient: " + user.name + "\n📱 Number: " + from + "\n📅 Din: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: Dr. Usman Iqbal\n\nPlease time pe ready rahein.";

        await saveToSheet(user, from);
        
        user.step = "menu";
        user.day = ""; user.time = ""; user.problem = "";
      }
      else if (isFees(low)) {
        reply = "Fees 500 Rupay hai. 💰\n\nAap batayein, Appointment book karni hai?\n1. Haan, Book Karni Hai\n2. Timing Pochni Hai";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isTiming(low)) {
        reply = "Clinic Timing: ⏰\nPeer - Hafta: Subah 10 - Raat 9 baje\nItwaar: Band hai.\n\nAppointment book karni hai? (Haan likhein)";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isDoctor(low)) {
        reply = "Hamare Doctor: Dr. Usman Iqbal hain. 👨‍⚕️\nBohat tajurba kaar hain.\n\nAppointment book karni hai? (Haan likhein)";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isAddress(low)) {
        reply = "Clinic Address: Main Boulevard, Lahore. 📍\n\nAppointment book karni hai? (Haan likhein)";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (user.step === "start" || isGreeting(low)) {
        reply = "Assalam-o-Alaikum! Main Clinic Assistant hon. 😊\n\nKya madad karun?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai\n4. Doctor Ka Naam Pochna Hai\n\nBas likh dein, jese: 'Appointment chahiye'";
        user.step = "menu";
      }
      else if (user.step === "menu") {
        if (isAppointment(low) || low.includes("1") || low.includes("haan") || low.includes("han") || low.includes("yes") || low.includes("krni")) {
          reply = "Zaroor! 😊\nApna poora Naam batayein?";
          user.step = "ask_name";
        } else if (low.includes("2")) {
          reply = "Clinic Timing: ⏰\nPeer - Hafta: Subah 10 - Raat 9 baje\nItwaar: Band hai.\n\nAppointment book karni hai? (Haan likhein)";
        } else if (low.includes("3")) {
          reply = "Fees 500 Rupay hai. 💰\n\nAppointment book karni hai? (Haan likhein)";
        } else if (low.includes("4")) {
          reply = "Hamare Doctor: Dr. Usman Iqbal hain. 👨‍⚕️\n\nAppointment book karni hai? (Haan likhein)";
        } else {
          if (low.length > 3) {
            user.problem = text;
            reply = "Allah Shifa de! 🤲 Lagta hai aapko " + text + " hai.\n\nAppointment book kar dun? Apna Naam batayein?";
            user.step = "ask_name";
          } else {
            reply = "Samajh nahi aya. 🤔\nPlease likhein:\n1. Appointment\n2. Timing\n3. Fees\n4. Doctor";
          }
        }
      }

      await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", {
        method: "POST",
        headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: reply } })
      });

      if (doctorMsg !== "") {
        await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", {
          method: "POST",
          headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: DOCTOR_NUMBER, type: "text", text: { body: doctorMsg } })
        });
      }

      return res.status(200).send("OK");
    } catch (e) {
      console.log(e);
      return res.status(200).send("OK");
    }
  }
};
