const VERIFY_TOKEN = "clinic123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Doctor - Dr. Usman Iqbal
const DOCTOR_NUMBER = "923364776344";

const users = {};

function isGreeting(low) {
  return low.includes("hi") || low.includes("hello") || low.includes("salam") || low.includes("aoa") || low.includes("assalam") || low.includes("hey");
}
function isAppointment(low) {
  return low.includes("appoint") || low.includes("apoint") || low.includes("apoit") || low.includes("book") || low.includes("milna") || low.includes("check") || low.includes("dikhana");
}
function isFees(low) {
  return low.includes("fee") || low.includes("fees") || low.includes("paisa") || low.includes("pese") || low.includes("charges") || low.includes("kitne");
}
function isTiming(low) {
  return low.includes("timing") || low.includes("time") || low.includes("kab") || low.includes("khulta") || low.includes("open") || low.includes("baje");
}
function isDoctor(low) {
  return low.includes("doctor") || low.includes("dr") || low.includes("hakim") || low.includes("kon");
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

      if (isCancel(low) && user.step !== "start") {
        user.step = "menu";
        reply = "Theek hai, cancel kar diya. 👍\n\nDobara chahiye to batayein:\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
      }
      else if (isFees(low) && user.step !== "ask_name" && user.step !== "ask_day") {
        reply = "Fees 500 Rupay hai. 💰\n\nAap batayein, Appointment book karni hai?\n1. Haan, Book Karni Hai\n2. Timing Pochni Hai";
        if (user.step === "start" || user.step === "menu") user.step = "menu";
      }
      else if (isTiming(low) && user.step !== "ask_day" && user.step !== "ask_time") {
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
        if (user.step === "ask_name" || user.step === "ask_day" || user.step === "ask_time" || user.step === "ask_problem") {
          reply = "Walaikum Assalam! 😊 Acha batayein, hum kahan thay? Apna Naam batayein?";
          if (user.step === "ask_day") reply = "Walaikum Assalam! 😊 Kis din ana hai?";
          if (user.step === "ask_time") reply = "Walaikum Assalam! 😊 Kis time ana hai?";
          if (user.step === "ask_problem") reply = "Walaikum Assalam! 😊 Kya takleef hai?";
        } else {
          reply = "Assalam-o-Alaikum! Main Clinic Assistant hon. 😊\n\nKya madad karun?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai\n4. Doctor Ka Naam Pochna Hai\n\nBas likh dein, jese: 'Appointment chahiye'";
          user.step = "menu";
        }
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
        
        user.step = "menu";
        user.day = ""; user.time = ""; user.problem = "";
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
