const VERIFY_TOKEN = "clinic123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Agent Memory
const users = {};

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
      const low = text.toLowerCase();

      if (!users[from]) {
        users[from] = { step: "start", name: "", day: "", time: "", problem: "" };
      }
      const user = users[from];
      let reply = "";

      // --- AGENT LOGIC ---

      // 1. START
      if (low.includes("hi") || low.includes("hello") || low.includes("salam") || low.includes("aoa") || user.step === "start") {
        reply = "Assalam-o-Alaikum! Main Clinic Assistant hon. 😊\n\nBatayein kya karna hai?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
        user.step = "menu";
      }
      // 2. MENU
      else if (user.step === "menu") {
        if (low.includes("1") || low.includes("appointment") || low.includes("book")) {
          reply = "Zaroor! Apna Naam batayein?";
          user.step = "ask_name";
        } else if (low.includes("2") || low.includes("timing") || low.includes("time") || low.includes("kab")) {
          reply = "Clinic Timing:\nPeer - Hafta: Subah 10 - Raat 9 baje\nItwaar: Band hai.\n\nWapis janay ke liye 'Hi' likhein.";
          user.step = "start";
        } else if (low.includes("3") || low.includes("fees") || low.includes("fee") || low.includes("paisa")) {
          reply = "Fees 500 Rupay hai.\n\nWapis janay ke liye 'Hi' likhein.";
          user.step = "start";
        } else if (low.includes("hi") || low.includes("hello") || low.includes("salam") || low.includes("aoa")) {
          reply = "Walaikum Assalam! Kaisay hain aap? 😊\n\nBatayein kya karna hai?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
        } else {
          reply = "Samajh nahi aya. Please likhein:\n1. Appointment\n2. Timing\n3. Fees";
        }
      }
      // 3. NAAM
      else if (user.step === "ask_name") {
        user.name = text;
        reply = "Shukriya " + user.name + "! Kis din ana hai? (Jese: Peer, Mangal, Budh)";
        user.step = "ask_day";
      }
      // 4. DIN
      else if (user.step === "ask_day") {
        user.day = text;
        reply = "Theek hai, " + user.day + " ko kis time ana hai? (Jese: 5 baje, 7 baje)";
        user.step = "ask_time";
      }
      // 5. TIME
      else if (user.step === "ask_time") {
        user.time = text;
        reply = "Aakhri sawal: Kya takleef hai? (Jese: Bukhar, Pait me dard)";
        user.step = "ask_problem";
      }
      // 6. PROBLEM - BOOKING DONE
      else if (user.step === "ask_problem") {
        user.problem = text;
        reply = "✅ Appointment Book Ho Gayi!\n\nNaam: " + user.name + "\nDin: " + user.day + "\nTime: " + user.time + "\nTakleef: " + user.problem + "\n\nShukriya! Allah Shifa de.";
        user.step = "start";
      }

      // Send Message to WhatsApp
      await fetch("https://graph.facebook.com/v21.0/" + PHONE_NUMBER_ID + "/messages", {
        method: "POST",
        headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: reply } })
      });

      return res.status(200).send("OK");
    } catch (e) {
      console.log(e);
      return res.status(200).send("OK");
    }
  }
};
