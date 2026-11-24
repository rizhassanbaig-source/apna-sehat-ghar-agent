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
function doctorsListText(){
  let t = "Hamare Doctors: 👨‍⚕️\n\n";
  DOCTORS.forEach((d,i)=>{ t += (i+1)+". "+d.name+" - "+d.timing+" - Fees "+d.fees+"\n"; });
  t += "\nKis Doctor se milna hai? Naam ya Number (1-5) likhein.";
  return t;
}
function findDoctor(text){
  const low = text.toLowerCase();
  let n = parseInt(low.replace(/[^0-9]/g,''));
  if(n>=1 && n<=5) return DOCTORS[n-1];
  for(let d of DOCTORS){
    let first = d.name.toLowerCase().split(" ")[1];
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
async function saveToSheet(user, from, isCancel=false) {
  try {
    const formUrl = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
    const params = new URLSearchParams();
    params.append("entry.1811277503", convertDateInputToDate(user.day || "aaj"));
    params.append("entry.1364007535", convertTimeToFormTime(user.time || "5"));
    params.append("entry.2046298723", user.name || from);
    params.append("entry.1419912836", from);
    params.append("entry.913984501", isCancel ? "CANCELLED - " + (user.problem||"") : user.problem);
    params.append("entry.829447129", user.doctor ? user.doctor.name : "Dr. Usman
