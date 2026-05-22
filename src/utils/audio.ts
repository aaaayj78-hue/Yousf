import { DialectOption, ToneOption, VoiceOption } from "../types";

// Base64 to ArrayBuffer decoder
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Raw 16-bit PCM Mono to Web Audio API AudioBuffer
export function pcmToAudioBuffer(
  audioCtx: AudioContext,
  arrayBuffer: ArrayBuffer,
  sampleRate: number
): AudioBuffer {
  const int16Data = new Int16Array(arrayBuffer);
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }
  const audioBuffer = audioCtx.createBuffer(1, float32Data.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32Data);
  return audioBuffer;
}

// Raw PCM data to playable WAV file Blob
export function pcmToWavBlob(arrayBuffer: ArrayBuffer, sampleRate: number): Blob {
  const rawLength = arrayBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + rawLength);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length - 8
  view.setUint32(4, 36 + rawLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM = 1)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, rawLength, true);

  // Write actual PCM data
  const srcView = new Uint8Array(arrayBuffer);
  const dstView = new Uint8Array(buffer, 44);
  dstView.set(srcView);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Dialect options (Arabic countries & Standard)
export const dialectOptions: DialectOption[] = [
  {
    id: "العربية الفصحى (مع التشكيل الكامل والنطق الصحيح)",
    label: "الفصحى (الرسمية)",
    flag: "🇸🇦",
    description: "نطق رسمي سليم بكامل حركات الإعراب والتشكيل اللغوي الأصيل."
  },
  {
    id: "اللهجة العراقية الشعبية المحببة وبجميع قفشاتها المحلية ورنتها الجميلة",
    label: "العراقية 🇮🇶",
    flag: "🇮🇶",
    description: "لكنة عراقية فصيحة، مميزة بجمال لفظها وطابعها البغدادي والجنوبي الدافئ."
  },
  {
    id: "اللهجة السعودية النجدية والحجازية الودودة وبطابعها الخليجي الأصيل",
    label: "السعودية 🇸🇦",
    flag: "🇸🇦",
    description: "نطق بلهجة سعودية أصيلة، تمزج بين وقار النجدية وودية الحجازية."
  },
  {
    id: "اللهجة الإماراتية الخليجية الراقية وبطابعها المحلي الهادئ",
    label: "الإماراتية 🇦🇪",
    flag: "🇦🇪",
    description: "لهجة إماراتية خليجية طبيعية تمتاز بالرقي والهدوء اللفظي المحبب."
  },
  {
    id: "اللهجة المصرية الشعبية السريعة والكوميدية خفيفة الظل وبلكنتها القاهرية المعروفة",
    label: "المصرية 🇪🇬",
    flag: "🇪🇬",
    description: "لكنة مصرية قاهرية حيوية، تجمع خفة الظل والسرعة الطبيعية المألوفة."
  },
  {
    id: "اللهجة السورية واللبنانية الشامية الرقيقة والناعمة بنطقها الصافي",
    label: "الشامية 🇸🇾 🇱🇧",
    flag: "🇸🇾",
    description: "لكنة بلاد الشام الرقيقة، تمتاز بالنعومة وسلاسة المخارج وعذوبة الأذن."
  }
];

// Tone options representing emotions requested by the user
export const toneOptions: ToneOption[] = [
  {
    id: "هادئ ومطمئن وسلس جداً ومريح للأذن",
    label: "هادئ ومريح 😌",
    icon: "SmileInside",
    description: "وتيرة متزنة وصوت مريح ومثالي لقراءة التأملات والكتب والروايات."
  },
  {
    id: "عصبي وغاضب ومنفعل جداً وبنبرة مرتفعة ومشحونة بالحدة والتوتر",
    label: "عصبي ومنفعل 😡",
    icon: "Flame",
    description: "صوت مشحون بالغضب والحدة والتوتر العالي، لإنفعال مسرحي وواقعي."
  },
  {
    id: "متحمس ومليء بالنشاط والسرور العالي والطاقة الإيجابية الكبيرة والمشجعة",
    label: "متحمس ونشيط 🔥",
    icon: "Sparkles",
    description: "نبرة مفعمة بالحيوية والسرور العالي تصلح للإعلانات والتشجيع الحماسي."
  },
  {
    id: "حزين باكي تملأه الدموع واللوعة والكسرة والألم والندم ونبرة منخفضة متهدجة",
    label: "حزين وباكٍ 😢",
    icon: "CloudRain",
    description: "صوت يحمل لوعة الفراق والندم الشديد، مناسب للنصوص المؤثرة والدرامية."
  },
  {
    id: "جاد ورسمي ووقور للغاية ويصلح للأخبار العاجلة والتقارير الإخبارية الرسمية دون ابتسامة",
    label: "رسمي وجاد 💼",
    icon: "FileText",
    description: "إلقاء إخباري رسمي رصين، خالٍ من الضحك ومثالي للمقالات والتقارير الجادة."
  },
  {
    id: "ودود ولطيف ومرحب للغاية ودافئ ويبعث الطمأنينة كأنه يتحدث مع صديق مقرب",
    label: "ودود ولطيف 🤗",
    icon: "Heart",
    description: "صوت دافئ ومرحب يبعث على الراحة النفسية، كأنه يخاطب صديقه الحميم."
  },
  {
    id: "مرح ومزاح وسخرية خفيفة ويحمل ابتسامة واضحة في نبرة الصوت وتلعثم مضحك",
    label: "مرح وكوميدي 🤪",
    icon: "Laugh",
    description: "إلقاء ضاحك ومبهج ومليء بالمداعبة والتلطف الفكاهي الطريف."
  }
];

// Prebuilt voices available in standard Gemini TTS, mapped nicely with description and tags
export const voiceOptions: VoiceOption[] = [
  {
    id: "iraqi-young-smart",
    label: "سرمد العراقي (Sarmad) - شاب ذكي ومتناسق 🇮🇶",
    gender: "male",
    description: "صوت عراقي شاب، ذكي ومحايد ومتسق مع مشاهد الفيديو وحركاتها بصورة مذهلة."
  },
  {
    id: "iraqi-female-smart",
    label: "ريم الرافدين (Reem) - شابة ذكية ومتسقة 🇮🇶",
    gender: "female",
    description: "صوت شابة عراقية بغدادية، يمتاز بالدفء والذكاء والانسجام مع الصوت الأصلي للفيديو."
  },
  {
    id: "Kore",
    label: "كوري (Kore) - أنثى دافئة",
    gender: "female",
    description: "صوت نسائي ناعم ودافئ، مثالي للمواضيع الأدبية والقصصية واللطيفة."
  },
  {
    id: "Puck",
    label: "بَك (Puck) - شاب مفعم بالحيوية",
    gender: "male",
    description: "صوت شبابي مفعم بالطاقة العالية والحركة والإثارة."
  },
  {
    id: "Zephyr",
    label: "زيفير (Zephyr) - صوت إعلامي متزن",
    gender: "neutral",
    description: "نبرة صوت مثقفة ورصينة، ممتازة للأخبار والبودكاست والتقارير العلمية."
  },
  {
    id: "Charon",
    label: "شارون (Charon) - رجل وقور عميق",
    gender: "male",
    description: "صوت ذكوري جهوري عميق يحاكي صوت رجال الوثائقيات المخضرمين."
  },
  {
    id: "Fenrir",
    label: "فينرير (Fenrir) - صلب وديناميكي",
    gender: "male",
    description: "إلقاء درامي صلب، يمتاز بنبرة تبرز القوة والصلابة في قراءة الحوارات الصعبة."
  }
];
