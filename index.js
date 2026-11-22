const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Agent ki Yaaddaasht - Har number ke liye alag
const users = {};

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
        const text = msg.text.body.trim();
        const low = text.toLowerCase();

        if (!users[from]) users[from] = { step: 'start', data: {} };
        const user = users[from];
        let reply = "";

        // --- AGENT LOGIC ---

        // 1. Agar pehli baar ya Salam
        if (user.step === 'start') {
          reply = "Assalam-o-Alaikum, Shafa Clinic me Khushamdeed! Mera naam Shafa Assistant hai.\n\nBatayein kya karna hai?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
          user.step = 'menu';
        }
        // 2. Menu se select
        else if (user.step === 'menu') {
          if (low.includes('1') || low.includes('appointment') || low.includes('book')) {
            reply = "Zaroor! Appointment book karte hain.\n\nApka Naam kya hai?";
            user.step = 'ask_name';
          } else if (low.includes('2') || low.includes('timing') || low.includes('time') || low.includes('kab')) {
            reply = "Dr. Usman Iqbal ki Timing:\nSham 5 se Raat 10 baje tak\nPeer se Hafta, Itwaar Chutti hai.\n\nAppointment book karni hai? To 'Appointment' likhein.";
            user.step = 'menu';
          } else if (low.includes('3') || low.includes('fees') || low.includes('fees') || low.includes('paisa')) {
            reply = "Fees 1000 Rs hai.\n\nAppointment book karni hai? To 'Appointment' likhein.";
            user.step = 'menu';
          } else {
            } else if (low.includes('hi') || low.includes('hello') || low.includes('salam') || low.includes('aoa')) {
  reply = "Walaikum Assalam! Kaisay hain aap? \n\nBatayein kya karna hai?\n1. Appointment Book Karni Hai\n2. Timing Pochni Hai\n3. Fees Maloom Karni Hai";
            reply = "Samajh nahi aya. Please likhein:\n1. Appointment\n2. Timing\n3. Fees";
          }
        }
        // 3. Naam pucha
        else if (user.step === 'ask_name') {
          user.data.name = text;
          reply = `Shukriya ${text} Sahab! Aap kis din ana chahte hain? (Jaise Peer, Mangal, Budh)`;
          user.step = 'ask_day';
        }
        // 4. Din pucha
        else if (user.step === 'ask_day') {
          if (low.includes('itwaar') || low.includes('sunday')) {
            reply = "Itwaar ko Clinic band hoti hai. Koi aur din batayein, Peer se Hafta tak.";
          } else {
            user.data.day = text;
            reply = `${user.data.day} ko kis time ayenge? (Jaise Sham 6 baje)`;
            user.step = 'ask_time';
          }
        }
        // 5. Time pucha
        else if (user.step === 'ask_time') {
          user.data.time = text;
          reply = "Aakhri sawal, Kya takleef hai apko? (Jaise Bukhar, Khansi)";
          user.step = 'ask_problem';
        }
        // 6. Takleef puchi - BOOKING DONE
        else if (user.step === 'ask_problem') {
          user.data.problem = text;
          reply = `Mubarak ho ${user.data.name} Sahab! ✅\n\nApki Appointment Book ho gayi hai:\n\nNaam: ${user.data.name}\nDin: ${user.data.day}\nTime: ${user.data.time}\nTakleef: ${user.data.problem}\nDoctor: Dr. Usman Iqbal\nFees: 1000 Rs\n\nWaqt par aa jaiyega. Shukriya!`;
          user.step = 'menu';
          user.data = {};
        }

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
