const VERIFY_TOKEN = "clinic123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DOCTOR_NUMBER = "923364776344";
const users = {};

// ===== AGENT - 5 DOCTORS =====
const DOCTORS = [
  { name: "Dr. Usman Iqbal", timing: "Subah 10-2, Shaam 5-9", fees: "500 Rs" },
  { name: "Dr. Ali Raza", timing: "Shaam 6-10", fees: "500 Rs" },
  { name: "Dr. Fatima Khan", timing: "Subah 10-1", fees: "400 Rs" },
  { name: "Dr. Ahmed Sheikh", timing: "Dopahar 2-6", fees: "500 Rs" },
  { name: "Dr. Ayesha Noor", timing: "Shaam 5-9", fees: "400 Rs" }
];
function doctorsListText(){
  let t = "Hamare Doctors: 👨‍⚕️\n\n";
  DOCTORS.forEach((d,i)=>{ t += (i+1)+". "+d.name+" - "+d.timing+" - Fees "+d.fees+"\n"; });
  t += "\nKis Doctor se milna hai? Naam ya Number (1-5) likhein.";
  return t;
}
function findDoctor(text){
  const low = text.toLowerCase();
  // Number se
  let n = parseInt(low.replace(/[^0-9]/g,'')); 
  if(n>=1 && n<=5) return DOCTORS[n-1];
  // Naam se
  for(let d of DOCTORS){ 
    let first = d.name.toLowerCase().split(" ")[1]; // usman, ali...
    if(low.includes(first)) return d;
  }
  return null;
}

const FORM_ID = "1FAIpQLScIb7q0BfmGFk-cSLmqFYUi4RTVOosxgiltDrvJ-66DPLq9bQ";

function convertDateInputToDate(dateText) {
  const low = dateText.toLowerCase().trim();
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
  const low = timeText.toLowerCase().trim();
  if (low.includes(":")) return low.split(" ")[0];
  let num = parseInt(low.replace(/[^0-9]/g, '')) || 5;
  let hour = num;
  if (low.includes("sham") || low.includes("raat") || low.includes("pm") || (num >= 1 && num <= 9)) { if (num < 12) hour = num + 12; }
  if (hour === 24) hour = 12;
  return String(hour).padStart(2, '0') + ":00";
}

// --- AGENT: Sheet me save + Cancel pe CANCELLED likhna ---
async function saveToSheet(user, from, isCancel=false) {
  try {
    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const params = new URLSearchParams();
    params.append("entry.1811277503", convertDateInputToDate(user.day || "aaj"));
    params.append("entry.1364007535", convertTimeToFormTime(user.time || "5"));
    params.append("entry.2046298723", user.name || from);
    params.append("entry.1419912836", from);
    // Cancel ho to Problem ke aage CANCELLED likh dega
    params.append("entry.913984501", isCancel ? "CANCELLED - " + (user.problem||"") : user.problem);
    params.append("entry.829447129", user.doctor ? user.doctor.name : "Dr. Usman Iqbal");
    await fetch(formUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  } catch (e) { console.log("Sheet Error:", e); }
}

function hasWord(low, words) { const allWords = low.split(/[\s,!.?]+/); return words.some(w => allWords.includes(w)); }
function isGreeting(low) { return hasWord(low, ["hi", "hello", "salam", "aoa", "assalam", "hey", "hii"]); }
function isAppointment(low) { return low.includes("appoint") || low.includes("apoint") || low.includes("apoit") || low.includes("book") || low.includes("milna") || low.includes("check") || low.includes("dikhana"); }
function isFees(low) { return hasWord(low, ["fee", "fees", "paisa", "pese", "charges", "kitne"]); }
function isTiming(low) { return hasWord(low, ["timing", "time", "kab", "khulta", "open", "baje"]); }
function isDoctor(low) { return hasWord(low, ["doctor", "dr", "hakim", "kon"]); }
function isAddress(low) { return low.includes("kahan") || low.includes("address") || low.includes("location") || low.includes("kidhar") || low.includes("jaga"); }
function isCancel(low) { return low.includes("cancel") || low.includes("rehne") || low.includes("chor") || low.includes("nahi chahiye") || low.includes("band") || low.includes("mansookh"); }

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
      const low = text.toLowerCase().trim();
      if (!users[from]) users[from] = { step: "start", name: "", day: "", time: "", problem: "", doctor: null, lastBooked: null };
      const user = users[from];
      let reply = ""; let doctorMsg = "";

      // --- AGENT: CANCEL ---
      if (isCancel(low) && user.step !== "start") {
        // Agar pehle book ho chuki thi to Sheet me CANCELLED wali line bhej do
        if (user.lastBooked) { await saveToSheet(user.lastBooked, from, true); }
        user.step = "menu";
        reply = "Theek hai, aapki Appointment CANCELLED kar di hai. ❌\nSheet me uske aage CANCELLED likh diya hai.\n\nDobara chahiye to batayein:\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
      }
      else if (user.step === "ask_doctor") {
        let d = findDoctor(text);
        if (!d) { reply = "Samajh nahi aya. Dobara batayein:\n" + doctorsListText(); }
        else { user.doctor = d; reply = "Great! " + d.name + " select ho gaye. 👨‍⚕️\nTiming: " + d.timing + "\nFees: " + d.fees + "\n\nAb apna poora Naam batayein?"; user.step = "ask_name"; }
      }
      else if (user.step === "ask_name") {
        user.name = text;
        reply = "Shukriya " + user.name + "! ❤️\nKis Date ko ana hai? (Jese: 25 November, 26 November, Kal, Aaj)";
        user.step = "ask_day";
      }
      else if (user.step === "ask_day") {
        user.day = text;
              else if (user.step === "ask_day") {
        // AGENT: Ghalat Date pakro - 32 November jesi
        let testDate = convertDateInputToDate(text);
        let dNum = parseInt(text.replace(/[^0-9]/g, ''));
        if (dNum > 31 || (text.toLowerCase().includes("nov") && dNum > 30)) {
          reply = "Arre! 😅 " + text + " to hota hi nahi!\nNovember me sirf 30 din hote hain.\nDobara sahi Date batayein? (Jese: 25 November, 29 November)";
          // step wahi rahega, dobara date puchega
        } else {
          user.day = text;
          reply = "Theek hai, " + user.day + " ko kis time ana hai? (Jese: 5 baje, 7 baje, Sham ko)";
          user.step = "ask_time";
        }
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
        // Last booking yaad rakho taake Cancel kar sake
        user.lastBooked = { name: user.name, day: user.day, time: user.time, problem: user.problem, doctor: user.doctor };
        reply = "✅ Appointment Book Ho Gayi!\n\n👤 Naam: " + user.name + "\n📅 Date: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: " + (user.doctor?user.doctor.name:"Dr. Usman Iqbal") + "\n💰 Fees: " + (user.doctor?user.doctor.fees:"500 Rs") + "\n\nShukriya! Allah Shifa de. 🤲\n\nCancel karni ho to 'Cancel' likhein. Kuch aur poochna hai to 'Hi' likhein.";
        doctorMsg = "🔔 NAYI APPOINTMENT! 🔔\n\n👤 Patient: " + user.name + "\n📱 Number: " + from + "\n📅 Date: " + user.day + "\n⏰ Time: " + user.time + "\n🤒 Takleef: " + user.problem + "\n👨‍⚕️ Doctor: " + (user.doctor?user.doctor.name:"Dr. Usman Iqbal") + "\n\nPlease time pe ready rahein.";
        await saveToSheet(user, from);
        user.step = "menu"; user.day = ""; user.time = ""; user.problem = "";
      }
      else if (isFees(low)) {
        reply = "Fees: 💰\nDr Usman / Dr Ali / Dr Ahmed - 500 Rs\nDr Fatima / Dr Ayesha - 400 Rs\n\nAppointment book karni hai?\n1. Haan, Book Karni Hai";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isTiming(low)) {
        reply = "Clinic Timing: ⏰\nPeer - Hafta: Subah 10 - Raat 10 baje\nItwaar: Band hai.\n\n" + doctorsListText();
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isDoctor(low)) {
        reply = doctorsListText();
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
          reply = doctorsListText();
          user.step = "ask_doctor";
        } else if (low.includes("2")) {
          reply = "Clinic Timing: ⏰\nPeer - Hafta: Subah 10 - Raat 10 baje\nItwaar: Band hai.\n\nAppointment book karni hai? (Haan likhein)";
        } else if (low.includes("3")) {
          reply = "Fees 400-500 Rupay hai. 💰\n\nAppointment book karni hai? (Haan likhein)";
        } else if (low.includes("4")) {
          reply = doctorsListText();
        } else {
          if (low.length > 3) { user.problem = text; reply = "Allah Shifa de! 🤲 Lagta hai aapko " + text + " hai.\n\nAppointment book kar dun? Pehle Doctor select karein:\n" + doctorsListText(); user.step = "ask_doctor"; }
          else { reply = "Samajh nahi aya. 🤔\nPlease likhein:\n1. Appointment\n2. Timing\n3. Fees\n4. Doctor"; }
        }
      }

      await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", { method: "POST", headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: reply } }) });
      if (doctorMsg !== "") { await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", { method: "POST", headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: DOCTOR_NUMBER, type: "text", text: { body: doctorMsg } }) }); }
      return res.status(200).send("OK");
    } catch (e) { console.log(e); return res.status(200).send("OK"); }
  }
};
