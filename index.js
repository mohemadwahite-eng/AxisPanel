const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Initialize logger
const logger = P({ level: 'debug' });

// Track processed messages to prevent duplicates
const processedMessages = new Set();

// Rate limiting configuration
const rateLimit = new Map();
const RATE_LIMIT_MS = 1000; // 1 second
const MAX_MESSAGES_PER_MINUTE = 10;

// Reconnection configuration
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Bilingual course information (English/Urdu)
const courses = {
  "web development": {
    title: { en: "Web Development", ur: "ویب ڈویلپمنٹ" },
    durations: [
      { en: "6 months (WordPress) - PKR 30,000 total", ur: "6 ماہ (ورڈپریس) - کل 30,000 روپے" },
      { en: "12 months (MERN Stack) - PKR 65,000 total", ur: "12 ماہ (مرن اسٹیک) - کل 65,000 روپے" }
    ],
    fees: [
      { en: "WordPress Course: PKR 30,000 (PKR 5,000 admission + PKR 5,000/month × 5 months)", 
        ur: "ورڈپریس کورس: 30,000 روپے (5,000 داخلہ فیس + 5,000 روپے ماہانہ × 5 ماہ)" },
      { en: "MERN Stack Course: PKR 65,000 (PKR 5,000 admission + PKR 5,000/month × 12 months)", 
        ur: "مرن اسٹیک کورس: 65,000 روپے (5,000 داخلہ فیس + 5,000 روپے ماہانہ × 12 ماہ)" }
    ],
    description: {
      en: "Become a full-stack developer with:\n- WordPress Development (6 months)\n- MERN Stack Development (12 months: HTML, CSS, JavaScript, React, Node.js, MongoDB)",
      ur: "مکمل ویب ڈویلپر بنیں:\n- ورڈپریس ڈویلپمنٹ (6 ماہ)\n- مرن اسٹیک ڈویلپمنٹ (12 ماہ: HTML, CSS, JavaScript, React, Node.js, MongoDB)"
    },
    syllabus: {
      "WordPress": [
        { en: "Theme Development", ur: "تھیم ڈویلپمنٹ" },
        { en: "Plugin Development", ur: "پلگ ان ڈویلپمنٹ" },
        { en: "WooCommerce", ur: "ووکامرس" }
      ],
      "MERN Stack": [
        { en: "HTML5", ur: "ایچ ٹی ایم ایل 5" },
        { en: "CSS3", ur: "سی ایس ایس 3" },
        { en: "JavaScript", ur: "جاوا اسکرپٹ" },
        { en: "React", ur: "ری ایکٹ" },
        { en: "Node.js", ur: "نوڈ جے ایس" },
        { en: "Express", ur: "ایکسپریس" },
        { en: "MongoDB", ur: "مونگو ڈی بی" }
      ]
    }
  },
  "digital marketing": {
    title: { en: "Digital Marketing", ur: "ڈیجیٹل مارکیٹنگ" },
    duration: { en: "5 months", ur: "5 ماہ" },
    fee: { 
      en: "PKR 40,000 total (PKR 10,000 admission + PKR 6,000/month × 5 months)",
      ur: "کل 40,000 روپے (10,000 داخلہ فیس + 6,000 روپے ماہانہ × 5 ماہ)"
    },
    description: {
      en: "Master digital marketing strategies including SEO, SEM, Social Media, and Email Marketing",
      ur: "SEO، SEM، سوشل میڈیا، اور ای میل مارکیٹنگ کی حکمت عملیوں میں مہارت حاصل کریں"
    },
    syllabus: [
      { en: "SEO", ur: "SEO" },
      { en: "Google Ads", ur: "گوگل اشتہارات" },
      { en: "Facebook Ads", ur: "فیس بک اشتہارات" },
      { en: "Content Marketing", ur: "مواد کی مارکیٹنگ" },
      { en: "Analytics", ur: "تجزیات" }
    ]
  },
  "seo": {
    title: { en: "SEO", ur: "SEO" },
    durations: [
      { en: "3 months (Basic) - PKR 20,000", ur: "3 ماہ (بنیادی) - 20,000 روپے" },
      { en: "6 months (Advanced) - PKR 40,000", ur: "6 ماہ (اعلی درجے) - 40,000 روپے" }
    ],
    fees: [
      { en: "Basic SEO: PKR 20,000 one-time payment", ur: "بنیادی SEO: 20,000 روپے یکمشت ادائیگی" },
      { en: "Advanced SEO: PKR 40,000 one-time payment", ur: "اعلی درجے SEO: 40,000 روپے یکمشت ادائیگی" }
    ],
    description: {
      en: "Learn search engine optimization from basics to advanced techniques",
      ur: "سرچ انجن آپٹیمائزیشن کو بنیادی سے اعلی درجے کی تکنیک تک سیکھیں"
    },
    syllabus: {
      "Basic": [
        { en: "Keyword Research", ur: "کلیدی لفظ کی تحقیق" },
        { en: "On-Page SEO", ur: "آن پیج SEO" },
        { en: "Technical SEO", ur: "تکنیکی SEO" }
      ],
      "Advanced": [
        { en: "Link Building", ur: "لنک کی تعمیر" },
        { en: "SEO Automation", ur: "SEO آٹومیشن" },
        { en: "International SEO", ur: "بین الاقوامی SEO" }
      ]
    }
  },
  "ai": {
    title: { en: "Artificial Intelligence", ur: "مصنوعی ذہانت" },
    durations: [
      { en: "3 months (Tools) - PKR 30,000", ur: "3 ماہ (ٹولز) - 30,000 روپے" },
      { en: "6 months (With Python) - PKR 50,000", ur: "6 ماہ (پائتھون کے ساتھ) - 50,000 روپے" }
    ],
    fees: [
      { en: "3 Months: PKR 30,000 one-time payment", ur: "3 ماہ: 30,000 روپے یکمشت ادائیگی" },
      { en: "6 Months: PKR 50,000 one-time payment", ur: "6 ماہ: 50,000 روپے یکمشت ادائیگی" }
    ],
    description: {
      en: "Learn AI fundamentals, tools and Python programming for AI",
      ur: "AI کی بنیادی باتیں، ٹولز اور AI کے لیے پائتھون پروگرامنگ سیکھیں"
    },
    syllabus: {
      "3 Months": [
        { en: "AI Tools", ur: "AI ٹولز" },
        { en: "ChatGPT", ur: "ChatGPT" },
        { en: "Midjourney", ur: "Midjourney" }
      ],
      "6 Months": [
        { en: "Python", ur: "پائتھون" },
        { en: "Machine Learning", ur: "مشین لرننگ" },
        { en: "Neural Networks", ur: "نیورل نیٹ ورکس" }
      ]
    }
  }
};

// Contact Information
const contactInfo = {
  phone: ["+923098325271", "+923227797673"],
  email: "contact@digitalglobalschool.com",
  location: {
    en: "Canal Road Toba Tek Singh, Near DC House 328JB Road, inside Fatima College of Health and Sciences",
    ur: "کینال روڈ ٹوبہ ٹیک سنگھ، ڈی سی ہاؤس 328JB روڈ کے قریب، فاطمہ کالج آف ہیلتھ اینڈ سائنسز کے اندر"
  },
  googleMaps: "https://g.co/kgs/fWQVotJ"
};

// FAQs in English, Urdu, and Roman Urdu
const faqs = {
  "refund": {
    en: "💸 2. Can I get a refund if I leave the course?\nYes, you can get your admission fee refunded only if you leave within one week of joining. After one week, neither the admission fee nor monthly fee is refundable.",
    ur: "💸 2. کیا میں کورس چھوڑنے پر رقم واپس لے سکتا ہوں؟\nہاں، آپ داخلہ فیس صرف ایک ہفتے کے اندر واپس لے سکتے ہیں۔ ایک ہفتے کے بعد نہ تو داخلہ فیس اور نہ ہی ماہانہ فیس واپس ہوگی۔",
    romanUrdu: "💸 2. Kya mein course chornay pa rupiya wapis le sakta hun?\nHaan, aap admission fee sirf ek haftay ke andar wapis le sakte hain. Ek haftay ke baad na to admission fee aur na hi mahana fee wapis hogi."
  },
  "demo": {
    en: "🆓 3. Is there a demo class available?\nYes, you can attend 3 demo classes free of cost before finalizing your admission.",
    ur: "🆓 3. کیا ڈیمو کلاس دستیاب ہے؟\nہاں، آپ داخلہ فیصلہ کرنے سے پہلے مفت میں 3 ڈیمو کلاسز میں شرکت کر سکتے ہیں۔",
    romanUrdu: "🆓 3. Kya demo class available hai?\nHaan, aap admission final karne se pehle 3 demo classes mein free shirkat kar sakte hain."
  },
  "installments": {
    en: "🧾 4. Can I pay the fees in installments?\nYes, installments are allowed. You can discuss a flexible fee plan with our admission team.",
    ur: "🧾 4. کیا میں قسطوں میں فیس ادا کر سکتا ہوں؟\nہاں، قسطوں کی سہولت دستیاب ہے۔ آپ ہماری داخلہ ٹیم سے لچکدار فیس پلان پر بات کر سکتے ہیں۔",
    romanUrdu: "🧾 4. Kya mein qistoon mein fees ada kar sakta hun?\nHaan, qiston ki saholat available hai. Aap hamari admission team se flexible fee plan par baat kar sakte hain."
  },
  "government": {
    en: "🏢 5. Is the course government-approved?\nNo, the course is not officially approved by the government. However, it is a skill-based course designed to help you earn online and work professionally.",
    ur: "🏢 5. کیا کورس سرکاری طور پر منظور شدہ ہے؟\nنہیں، یہ کورس سرکاری طور پر منظور شدہ نہیں ہے۔ تاہم، یہ ایک ہنر پر مبنی کورس ہے جو آن لائن کمائی اور پیشہ ورانہ کام کرنے میں مدد کے لیے ڈیزائن کیا گیا ہے۔",
    romanUrdu: "🏢 5. Kya course sarkari tor par manzoor shuda hai?\nNahi, ye course sarkari tor par manzoor shuda nahi hai. Lekin, ye ek hunar par mabni course hai jo online kamai aur professional kaam karne mein madad ke liye design kiya gaya hai."
  },
  "job": {
    en: "💼 6. Will I get a job after completing the course?\nYes, after completing the course, you can apply for jobs in software houses, work remotely, or even start freelancing. Many of our students have found good earning opportunities.",
    ur: "💼 6. کیا کورس مکمل کرنے کے بعد مجھے نوکری ملے گی؟\nہاں، کورس مکمل کرنے کے بعد آپ سافٹ ویئر ہاؤسز میں نوکری کے لیے درخواست دے سکتے ہیں، دور سے کام کر سکتے ہیں یا فری لانسنگ بھی شروع کر سکتے ہیں۔ ہمارے بہت سے طلباء نے اچھے کمائی کے مواقع حاصل کیے ہیں۔",
    romanUrdu: "💼 6. Kya course mukammal karne ke baad mujhe naukri milegi?\nHaan, course mukammal karne ke baad aap software houses mein naukri ke liye darkhwast de sakte hain, remote kaam kar sakte hain ya freelancing bhi shuru kar sakte hain. Hamare bohat se students ne achi kamai ke moqay hasil kiye hain."
  },
  "join": {
    en: "🧑‍💻 7. Can I join your team after the course?\nEvery year, we select 1–2 talented students to join our team based on performance and compatibility. If you do well, you may be offered an opportunity.",
    ur: "🧑‍💻 7. کیا میں کورس کے بعد آپ کی ٹیم میں شامل ہو سکتا ہوں؟\nہر سال، ہم کارکردگی اور مطابقت کی بنیاد پر 1-2 ہونہار طلباء کو اپنی ٹیم میں شامل کرتے ہیں۔ اگر آپ اچھا کام کریں گے، تو آپ کو بھی موقع دیا جا سکتا ہے۔",
    romanUrdu: "🧑‍💻 7. Kya mein course ke baad aap ki team mein shaamil ho sakta hun?\nHar saal, hum performance aur compatibility ki bina par 1-2 honhar students ko apni team mein shaamil karte hain. Agar aap acha kaam karenge, to aap ko bhi moqa diya ja sakta hai."
  },
  "admission": {
    en: "📢 8. Is admission currently open?\nYes, admissions are open now! You can register online or visit our center for more information.",
    ur: "📢 8. کیا داخلہ فی الحال کھلا ہے؟\nہاں، داخلے ابھی کھلے ہوئے ہیں! آپ آن لائن رجسٹر کر سکتے ہیں یا مزید معلومات کے لیے ہمارے مرکز پر آ سکتے ہیں۔",
    romanUrdu: "📢 8. Kya admission filhal khula hai?\nHaan, admissions abhi khule hue hain! Aap online register kar sakte hain ya mazeed malumat ke liye hamare center aa sakte hain."
  }
};

// FAQ triggers
const faqTriggers = {
  en: {
    refund: ["refund", "money back", "return fee"],
    demo: ["demo", "trial class", "free class"],
    installment: ["installment", "payment plan", "qist"],
    government: ["government", "approved", "sarkari"],
    job: ["job", "employment", "naukri"],
    join: ["join team", "work with", "team join"],
    admission: ["admission", "enroll", "register"]
  },
  ur: {
    refund: ["رقم واپسی", "پیسے واپس"],
    demo: ["ڈیمو", "مفت کلاس"],
    installment: ["قسط", "ادائیگی پلان"],
    government: ["سرکاری", "منظور شدہ"],
    job: ["نوکری", "ملازمت"],
    join: ["ٹیم میں شامل", "کام کریں"],
    admission: ["داخلہ", "رجسٹر"]
  },
  romanUrdu: {
    refund: ["wapis", "rupiya wapis", "money back"],
    demo: ["demo", "trial class", "free class"],
    installment: ["qist", "payment plan"],
    government: ["sarkari", "approved"],
    job: ["naukri", "rozgar"],
    join: ["team join", "kaam karein"],
    admission: ["admission", "enroll", "register"]
  }
};

// Language detection
function detectLanguage(text) {
  const urduChars = /[\u0600-\u06FF]/;
  const romanUrduKeywords = [
    "kitna", "hai", "kaise", "seekhna", "chahiye", "karna", 
    "admission", "fees", "wapis", "qist", "naukri", "sarkari"
  ];
  
  const urduCharCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalLength = text.length;
  
  if (urduCharCount > totalLength * 0.3) return 'ur';
  if (romanUrduKeywords.some(word => text.toLowerCase().includes(word))) return 'romanUrdu';
  return 'en';
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Get localized response
function getLocalized(data, lang) {
  if (!data) return data;
  if (data[lang]) return data[lang];
  if (Array.isArray(data)) return data.map(item => getLocalized(item, lang));
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = getLocalized(value, lang);
    }
    return result;
  }
  return data;
}

// Generate course information
function getCourseInfo(courseKey, lang) {
  const course = courses[courseKey.toLowerCase()];
  if (!course) return null;

  const labels = {
    en: {
      title: "Course",
      description: "Description",
      durations: "Durations",
      fees: "Fee Structure",
      syllabus: "Syllabus",
      contact: "Contact Us",
      location: "Location",
      assistance: "For immediate assistance, call us directly!"
    },
    ur: {
      title: "کورس",
      description: "تفصیل",
      durations: "مدت",
      fees: "فیس ڈھانچہ",
      syllabus: "نصاب",
      contact: "رابطہ کریں",
      location: "مقام",
      assistance: "فوری مدد کے لیے براہ راست کال کریں!"
    },
    romanUrdu: {
      title: "Course",
      description: "Description",
      durations: "Durations",
      fees: "Fee Structure",
      syllabus: "Syllabus",
      contact: "Contact Us",
      location: "Location",
      assistance: "For immediate assistance, call us directly!"
    }
  };

  const localized = getLocalized(course, lang);
  const label = labels[lang] || labels.en;

  let info = `*${localized.title} ${label.title}*\n\n📝 *${label.description}*: ${localized.description}\n\n`;

  if (localized.durations) {
    info += `⏳ *${label.durations}*:\n${localized.durations.map(d => `• ${d}`).join('\n')}\n\n`;
  }

  if (localized.fees) {
    info += `💰 *${label.fees}*:\n${Array.isArray(localized.fees) ? localized.fees.map(f => `• ${f}`).join('\n') : `• ${localized.fees}`}\n\n`;
  }

  info += `📚 *${label.syllabus}*:\n`;
  
  if (typeof localized.syllabus === 'object' && !Array.isArray(localized.syllabus)) {
    for (const [level, items] of Object.entries(localized.syllabus)) {
      info += `*${level}*:\n${items.map(item => `• ${item}`).join('\n')}\n`;
    }
  } else {
    info += `${localized.syllabus.map(item => `• ${item}`).join('\n')}\n`;
  }

  info += `\n📞 *${label.contact}*:\n` +
          `Phone: ${contactInfo.phone.join(", ")}\n` +
          `Email: ${contactInfo.email}\n\n` +
          `📍 *${label.location}*: ${contactInfo.location[lang === 'romanUrdu' ? 'en' : lang]}\n` +
          `🗺️ Google Maps: ${contactInfo.googleMaps}\n\n` +
          `💬 ${label.assistance}`;

  return info;
}

// Gemini AI reply with language context
async function getGeminiReply(prompt, lang) {
  const context = {
    en: `You are an assistant for Digital Global School in Toba Tek Singh, Pakistan. Respond in English.
    Contact: ${contactInfo.phone.join(", ")} | Location: ${contactInfo.location.en}
    Courses: Web Dev (PKR 30k-65k), Digital Marketing (PKR 40k), SEO (PKR 20k-40k), AI (PKR 30k-50k)
    Student asked: "${prompt}"`,
    ur: `آپ ڈیجیٹل گلوبل اسکول ٹوبہ ٹیک سنگھ کے معاون ہیں۔ اردو میں جواب دیں۔
    رابطہ: ${contactInfo.phone.join(", ")} | مقام: ${contactInfo.location.ur}
    کورسز: ویب ڈویلپمنٹ (30k-65k), ڈیجیٹل مارکیٹنگ (40k), SEO (20k-40k), AI (30k-50k)
    طالب علم نے پوچھا: "${prompt}"`,
    romanUrdu: `You are an assistant for Digital Global School in Toba Tek Singh, Pakistan. Respond in Roman Urdu.
    Contact: ${contactInfo.phone.join(", ")} | Location: ${contactInfo.location.en}
    Courses: Web Dev (PKR 30k-65k), Digital Marketing (PKR 40k), SEO (PKR 20k-40k), AI (PKR 30k-50k)
    Student asked: "${prompt}"`
  }[lang];

  try {
    const result = await model.generateContent(context);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini AI error:', error);
    return {
      en: "Sorry, I couldn't understand. Please call us directly: " + contactInfo.phone.join(" / "),
      ur: "معذرت، میں سمجھ نہیں پایا۔ براہ راست کال کریں: " + contactInfo.phone.join(" / "),
      romanUrdu: "Maaf karein, mein samajh nahi paya. Baraye meherbani directly call karein: " + contactInfo.phone.join(" / ")
    }[lang];
  }
}

// Create WhatsApp socket
async function createSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_multi');
  const sock = makeWASocket({
    auth: state,
    logger,
  });
  return { sock, saveCreds };
}

// Setup message handler with bilingual support
async function setupMessageHandler(sock) {
  // Welcome message for new chats
  sock.ev.on('chats.upsert', async ({ chats }) => {
    const newChat = chats.find(chat => chat.unreadCount > 0);
    if (newChat) {
      await sock.sendMessage(newChat.id, { 
        text: `Assalam-o-Alaikum! السلام علیکم! 👋\n\nWelcome to *Digital Global School* | *ڈیجیٹل گلوبل اسکول* میں خوش آمدید\n\nWhich course interests you? | آپ کو کون سا کورس پسند ہے؟\n\n` +
              `${Object.keys(courses).map(c => `- ${courses[c].title.en} | ${courses[c].title.ur}`).join('\n')}\n\n` +
              `Simply type the course name for details | تفصیلات کے لیے کورس کا نام لکھیں\n\n` +
              `📞 Contact | رابطہ: ${contactInfo.phone.join(" / ")}\n` +
              `📧 Email: ${contactInfo.email}`
      });
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const messageId = msg.key.id;
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    // Clear old message IDs to prevent memory buildup
    if (processedMessages.size > 1000) {
      const oldest = Array.from(processedMessages)[0];
      processedMessages.delete(oldest);
    }

    const sender = msg.key.remoteJid;
    let text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    if (!text) return;

    // Rate limiting
    const now = Date.now();
    if (!rateLimit.has(sender)) {
      rateLimit.set(sender, { count: 1, lastMessage: now });
    } else {
      const userLimit = rateLimit.get(sender);
      if (now - userLimit.lastMessage < 60 * 1000) {
        if (userLimit.count >= MAX_MESSAGES_PER_MINUTE) {
          await sock.sendMessage(sender, { 
            text: {
              en: "Please slow down! You're sending too many messages. Try again in a minute.",
              ur: "براہ کرم سست کریں! آپ بہت زیادہ پیغامات بھیج رہے ہیں۔ ایک منٹ بعد دوبارہ کوشش کریں۔",
              romanUrdu: "Baraye meherbani dheere karein! Aap bohat zyada messages bhej rahe hain. Ek minute baad dobara koshish karein."
            }[detectLanguage(text)]
          });
          return;
        }
        userLimit.count++;
      } else {
        rateLimit.set(sender, { count: 1, lastMessage: now });
      }
    }

    const lang = detectLanguage(text);
    console.log(`Message: "${text}" | Detected language: ${lang}`);

    let reply = '';

    // Check for FAQ matches
    for (const [key, faq] of Object.entries(faqs)) {
      const triggers = faqTriggers[lang][key] || [];
      if (triggers.some(trigger => text.toLowerCase().includes(trigger.toLowerCase()))) {
        console.log(`Matched FAQ: ${key} | Triggers: ${triggers.join(", ")}`);
        reply = lang === 'ur' ? faq.ur : 
                lang === 'romanUrdu' ? faq.romanUrdu : 
                faq.en;
        await sock.sendMessage(sender, { text: reply });
        return;
      }
    }

    // Handle location queries
    if (text.includes('location') || text.includes('address') || text.includes('toba tek singh') || text.includes('مقام') || text.includes('پتہ')) {
      reply = `📍 *${lang === 'en' ? 'Digital Global School Location' : 
              lang === 'ur' ? 'ڈیجیٹل گلوبل اسکول کا مقام' : 
              'Digital Global School Location'}*\n\n` +
              `${contactInfo.location[lang === 'romanUrdu' ? 'en' : lang]}\n\n` +
              `🗺️ Google Maps: ${contactInfo.googleMaps}\n\n` +
              `📞 ${lang === 'en' ? 'Contact' : 
               lang === 'ur' ? 'رابطہ' : 
               'Contact'}: ${contactInfo.phone.join(" / ")}`;
      await sock.sendMessage(sender, { text: reply });
      return;
    }

    // Handle contact queries
    if (text.includes('contact') || text.includes('number') || text.includes('call') || text.includes('email') || text.includes('رابطہ') || text.includes('نمبر') || text.includes('کال')) {
      reply = `📞 *${lang === 'en' ? 'Contact Digital Global School' : 
              lang === 'ur' ? 'ڈیجیٹل گلوبل اسکول سے رابطہ کریں' : 
              'Contact Digital Global School'}*\n\n` +
              `${lang === 'en' ? 'Phone' : 
               lang === 'ur' ? 'فون' : 
               'Phone'}:\n- ${contactInfo.phone.join("\n- ")}\n\n` +
              `📧 Email: ${contactInfo.email}\n\n` +
              `📍 ${lang === 'en' ? 'Location' : 
               lang === 'ur' ? 'مقام' : 
               'Location'}: ${contactInfo.location[lang === 'romanUrdu' ? 'en' : lang]}\n\n` +
              `${lang === 'en' ? 'For immediate assistance' : 
               lang === 'ur' ? 'فوری مدد کے لیے' : 
               'For immediate assistance'} ` +
              `${lang === 'en' ? 'please call us directly!' : 
               lang === 'ur' ? 'براہ راست کال کریں!' : 
               'please call us directly!'}`;
      await sock.sendMessage(sender, { text: reply });
      return;
    }

    // Check course inquiries
    let courseFound = false;
    for (const [key, course] of Object.entries(courses)) {
      if (text.toLowerCase().includes(key)) {
        reply = getCourseInfo(key, lang);
        courseFound = true;
        break;
      }
    }

    if (!courseFound) {
      if (text.includes('hello') || text.includes('hi') || text.includes('salam') || text.includes('السلام')) {
        const greeting = {
          en: `Assalam-o-Alaikum! 👋\nWelcome to *Digital Global School*\n\nWhich course interests you?\n${Object.keys(courses).map(c => `- ${courses[c].title.en}`).join('\n')}\n\nFor direct contact:\n📞 ${contactInfo.phone.join(" / ")}`,
          ur: `السلام علیکم! 👋\n*ڈیجیٹل گلوبل اسکول* میں خوش آمدید\n\nآپ کو کون سا کورس پسند ہے؟\n${Object.keys(courses).map(c => `- ${courses[c].title.ur}`).join('\n')}\n\nبراہ راست رابطے کے لیے:\n📞 ${contactInfo.phone.join(" / ")}`,
          romanUrdu: `Assalam-o-Alaikum! 👋\nWelcome to *Digital Global School*\n\nAap ko kaun sa course pasand hai?\n${Object.keys(courses).map(c => `- ${courses[c].title.en}`).join('\n')}\n\nDirect contact ke liye:\n📞 ${contactInfo.phone.join(" / ")}`
        };
        reply = greeting[lang];
      } 
      else if (text.includes('fee') || text.includes('price') || text.includes('cost') || text.includes('فیس') || text.includes('قیمت')) {
        const feeStructure = {
          en: `*Course Fees*\n\n${Object.values(courses).map(c => 
            `*${c.title.en}*:\n${Array.isArray(c.fees) ? c.fees.map(f => `• ${f.en}`).join('\n') : `• ${c.fee.en}`}`
          ).join('\n\n')}\n\n📞 ${lang === 'en' ? 'For admission details, call' : 
             lang === 'ur' ? 'داخلے کی تفصیلات کے لیے کال کریں' : 
             'Admission details ke liye call karein'}: ${contactInfo.phone.join(" / ")}`,
          ur: `*کورس فیس*\n\n${Object.values(courses).map(c => 
            `*${c.title.ur}*:\n${Array.isArray(c.fees) ? c.fees.map(f => `• ${f.ur}`).join('\n') : `• ${c.fee.ur}`}`
          ).join('\n\n')}\n\n📞 ${lang === 'en' ? 'For admission details, call' : 
             lang === 'ur' ? 'داخلے کی تفصیلات کے لیے کال کریں' : 
             'Admission details ke liye call karein'}: ${contactInfo.phone.join(" / ")}`,
          romanUrdu: `*Course Fees*\n\n${Object.values(courses).map(c => 
            `*${c.title.en}*:\n${Array.isArray(c.fees) ? c.fees.map(f => `• ${f.en}`).join('\n') : `• ${c.fee.en}`}`
          ).join('\n\n')}\n\n📞 Admission details ke liye call karein: ${contactInfo.phone.join(" / ")}`
        };
        reply = feeStructure[lang];
      }
      else if (text.includes('enroll') || text.includes('admission') || text.includes('join') || text.includes('داخلہ') || text.includes('رجسٹر')) {
        const admissionProcess = {
          en: `📝 *Admission Process*\n\n1. Select your course\n2. Fill admission form\n3. Submit required documents\n4. Pay admission fee\n\n📞 ${lang === 'en' ? 'For admission, call' : 
              lang === 'ur' ? 'داخلے کے لیے کال کریں' : 
              'Admission ke liye call karein'}: ${contactInfo.phone.join(" / ")}\n\n${lang === 'en' ? 'Which course would you like to enroll in?' : 
              lang === 'ur' ? 'آپ کون سا کورس کرنا چاہیں گے؟' : 
              'Aap kaun sa course karna chahenge?'}`,
          ur: `📝 *داخلہ کا طریقہ کار*\n\n1. اپنا کورس منتخب کریں\n2. داخلہ فارم پر کریں\n3. ضروری دستاویزات جمع کروائیں\n4. داخلہ فیس ادا کریں\n\n📞 ${lang === 'en' ? 'For admission, call' : 
              lang === 'ur' ? 'داخلے کے لیے کال کریں' : 
              'Admission ke liye call karein'}: ${contactInfo.phone.join(" / ")}\n\n${lang === 'en' ? 'Which course would you like to enroll in?' : 
              lang === 'ur' ? 'آپ کون سا کورس کرنا چاہیں گے؟' : 
              'Aap kaun sa course karna chahenge?'}`,
          romanUrdu: `📝 *Admission Process*\n\n1. Apna course select karein\n2. Admission form fill karein\n3. Zaroori documents submit karein\n4. Admission fee ada karein\n\n📞 Admission ke liye call karein: ${contactInfo.phone.join(" / ")}\n\nAap kaun sa course karna chahenge?`
        };
        reply = admissionProcess[lang];
      }
      else {
        reply = await getGeminiReply(text, lang);
      }
    }

    // Default fallback if no specific response is generated
    if (!reply) {
      reply = {
        en: `Sorry, I didn't understand your query. Please specify a course (e.g., Web Development, SEO) or ask about fees, admission, or contact details.\n📞 Call us: ${contactInfo.phone.join(" / ")}`,
        ur: `معذرت، میں آپ کا سوال نہیں سمجھ پایا۔ براہ کرم کورس کی وضاحت کریں (جیسے ویب ڈویلپمنٹ، SEO) یا فیس، داخلہ، یا رابطہ کی تفصیلات پوچھیں۔\n📞 کال کریں: ${contactInfo.phone.join(" / ")}`,
        romanUrdu: `Maaf karein, mein aap ka sawal nahi samjha. Baraye meherbani course specify karein (jaise Web Development, SEO) ya fees, admission, ya contact details poochein.\n📞 Call karein: ${contactInfo.phone.join(" / ")}`
      }[lang];
    }

    await sock.sendMessage(sender, { text: reply });
  });
}

// Start WhatsApp connection
async function startSock() {
  try {
    const { sock, saveCreds } = await createSocket();

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('QR code received, please scan:');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Logged out. Please delete ./auth_info_multi and scan QR again.');
        } else if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
          reconnectAttempts++;
          setTimeout(startSock, 5000);
        } else {
          console.log('Max reconnect attempts reached. Please restart the bot manually.');
        }
      } else if (connection === 'open') {
        console.log('Connected to WhatsApp');
        reconnectAttempts = 0; // Reset reconnect attempts
      }
    });

    await setupMessageHandler(sock);
  } catch (error) {
    console.error('Failed to start socket:', error);
    if (reconnectAttempts < maxReconnectAttempts) {
      console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
      reconnectAttempts++;
      setTimeout(startSock, 5000);
    } else {
      console.log('Max reconnect attempts reached. Please restart the bot manually.');
    }
  }
}

// Start the bot
startSock();