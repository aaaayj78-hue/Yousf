import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

// Ensure type definitions are respected and environmental instructions followed.
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(customApiKey?: string) {
  const keyToUse = customApiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error("مفتاح API الخاص بـ Gemini غير متوفر. يرجى إضافته في إعدادات التطبيق أو الخادم.");
  }
  
  if (!customApiKey && aiClient) {
    return aiClient;
  }

  const client = new GoogleGenAI({
    apiKey: keyToUse,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  if (!customApiKey) {
    aiClient = client;
  }
  return client;
}

function splitTextIntoChunks(text: string, maxLength: number = 185): string[] {
  // Split using common Arabic/English terminal punctuation and newlines
  const segments = text.split(/([.؟?!؛،\n\r])+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    // If adding the next segment exceeds maxLength, save current and restart
    if ((currentChunk + segment).length > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // If a single segment is itself too long, split it gracefully by words
      if (segment.length > maxLength) {
        const words = segment.split(/\s+/);
        let subChunk = "";
        for (const word of words) {
          if ((subChunk + " " + word).trim().length > maxLength) {
            if (subChunk.trim()) chunks.push(subChunk.trim());
            subChunk = word;
          } else {
            subChunk = (subChunk + " " + word).trim();
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = segment;
      }
    } else {
      currentChunk += segment;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Smart pre-analysis and diacritics generator
  app.post("/api/analyze-text", async (req, res) => {
    try {
      const { text, dialect, tone } = req.body;
      const customKey = req.headers["x-gemini-key"] as string | undefined;

      if (!text || typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({ error: "النص فارغ" });
      }

      const client = getGeminiClient(customKey);
      
      const prompt = `أنت خبير لغوي والمشكل الذكي الأبرز للنصوص العربية الفصحى واللهجات القطرية، وظيفتك تهيئة وتطوير النصوص بشكل احترافي مئة بالمئة لتلقينها في محركات توليد ونطق الكلام (TTS) لتخرج بصوت بشري شديد الطبيعية والجمال.

تفاصيل العمليات المطلوبة منك بدقة:
1. التشكيل الهيكلي الكامل: قم بضبط النص بالتشكيل الحرفي الكامل (الضمة، الفتحة، الكسرة، السكون، الشدّة، والتنوين بنوعيه) وبمراعاة تامة للمحل الإعرابي وحركات التقاء الساكنين.
2. نبرة الصوت وتوافق المشاعر: اضبط صياغة النص أو ضع علامات ترقيم مناسبة تعبر عن نبرة الإلقاء المطلوبة: [${tone || "هادئة ومريحة وبوتيرة مريحة جداً"}].
3. اللهجة والدولة: اضبط التوافق الصوتي مع لهجة: [${dialect || "العربية الفصحى (مع التشكيل الكامل والنطق الصحيح)"}]. إذا كانت لهجة عراقية أو خليجية أو مصرية، قم بكتابة الكلمات بأحرف تظهر مخارج اللفظ لتلك اللهجة (مثال: استخدام الجيم الحجازية أو القاف العراقية أو الكاف الشبه معجمة إذا لزم) أو اجعل بناء الجملة منساباً للغاية مع الحفاظ التام على جوهر النص.

النص المراد تحليله وتشكيله الآن:
"${text}"

أرجع لي النص الجديد المشكّل والمنقَّح بالكامل فقط، دون أي مقدمات، شروحات، أو هوامش جانبية من أي نوع، ليدخل مباشرة لمحرك النطق.`;

      let response;
      const textAnalysisModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let lastTextAnalysisErr = null;

      for (const modelName of textAnalysisModels) {
        try {
          console.log(`Analyzing text using model: ${modelName}`);
          response = await client.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
          });
          break;
        } catch (geminiError: any) {
          console.warn(`Text analysis failed for model ${modelName}:`, geminiError.message || geminiError);
          lastTextAnalysisErr = geminiError;
        }
      }

      if (!response) {
        throw lastTextAnalysisErr || new Error("فشلت معالجة النص في جميع النماذج المستهدفة.");
      }

      const processedText = response.text?.trim() || text;
      res.json({ success: true, text: processedText });
    } catch (error: any) {
      console.error("Text analysis error:", error);
      // Fallback gracefully to original text
      res.json({ success: false, text: req.body?.text || "", error: error.message });
    }
  });

  // Main TTS Generation endpoint
  app.post("/api/tts", async (req, res) => {
    const { text, dialect, tone, voiceName, gender } = req.body;
    try {
      const customKey = req.headers["x-gemini-key"] as string | undefined;

      if (!text || typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({ error: "النص المطلوب تحويله فارغ أو غير صالح." });
      }

      const client = getGeminiClient(customKey);

      let finalVoiceName = voiceName || "Kore";
      let finalGenderInstruction = gender || "صوت طبيعي مميز";

      if (voiceName === "iraqi-young-smart") {
        finalVoiceName = "Puck";
        finalGenderInstruction = "شاب عراقي ذكي ومتعلم من بغداد، نبرته متزنة وذكية وتستخدم اللهجة العراقية بصورة نقية وعذبة للغاية للشباب";
      } else if (voiceName === "iraqi-female-smart") {
        finalVoiceName = "Kore";
        finalGenderInstruction = "شابة عراقية ذكية ومتوازنة تروي بلهجة بغدادية دافئة ولطيفة";
      }

      // Formulate a structured prompt that instructs the Gemini TTS model on dialect, emotion/tone, and gender.
      // This enables the highly intelligent pronunciation requested by the user.
      const prompt = `أنت قارئ نصوص ومحرك نطق ذكي ومحترف للغاية. قم بنطق وقراءة النص التالي بدقة تامة وبمخارج حروف عربية صحيحة مئة بالمئة، مع العناية الفائقة بنطق الكلمات الصعبة وضبط حركات التشكيل (الضمة والفتحة والكسرة والتنوين).

معايير الإلقاء والنطق المطلوبة:
1. اللهجة: يجب القراءة والتحدث بـ ${dialect || "العربية الفصحى المبسطة"}. يجب أن يظهر النطق باللكنة والأسلوب الطبيعي لهذه المنطقة بكل سلاسة.
2. نبرة الصوت والانفعال: يجب أن تكون نبرة الصوت ${tone || "متزنة وهادئة"}. إذا كانت النبرة عصبي تكلّم بحدة وانفعال، وإذا كانت هادئة تكلّم بارتياح وسكينة، وإذا كانت متحمسة تكلّم بطاقة عالية وهكذا. دع صوتك يعبر بصدق عن هذه المشاعر.
3. فئة اللفظ والشخصية: مناسب لـ ${finalGenderInstruction} بطبقة صوت واضحة وممتازة.

النص المراد قراءته وتحويله إلى صوت مسموع:
"${text}"`;

      // Use the designated TTS model
      const modelName = "gemini-3.1-flash-tts-preview";

      console.log(`Generating TTS audio using model ${modelName} with dialect: ${dialect}, tone: ${tone}, voice: ${finalVoiceName}`);

      const response = await client.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: finalVoiceName },
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        if (finishReason === "SAFETY") {
          throw new Error("عذراً، تم حظر هذا النص بواسطة فلاتر الأمان التلقائية للذكاء الاصطناعي (قد يحتوي على كلمات حساسة أو غير ملائمة). يرجى تعديل الكلمات والمحاولة مجدداً.");
        }
        if (finishReason === "RECITATION") {
          throw new Error("عذراً، تم حظر النطق بسبب حقوق الحماية الفكرية للنصوص المقتبسة.");
        }
        throw new Error("فشل توليد الصوت من الذكاء الاصطناعي. لم يتم إرجاع بيانات صوتية (احتمال وجود ضغط على خوادم النطق المؤقت، يرجى إعادة المحاولة).");
      }

      // Return raw base64 data and metadata
      res.json({
        success: true,
        audioData: base64Audio,
        sampleRate: 24000,
        voiceFeedback: `تم توليد الصوت بنجاح بلهجة ${dialect} ونبرة ${tone}`,
      });
    } catch (error: any) {
      console.warn("Gemini Premium TTS failed:", error.message || error);
      
      let errorMsg = error.message || "";
      let isQuota = false;

      // Detect if it is a rate limit or quota exceeded error (429 RESOURCE_EXHAUSTED or 503 high demand)
      if (
        errorMsg.includes("429") || 
        errorMsg.includes("quota") || 
        errorMsg.includes("quotaExceeded") || 
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("demand") ||
        (error.status && error.status === "RESOURCE_EXHAUSTED") ||
        (error.code && error.code === 429)
      ) {
        isQuota = true;
        errorMsg = "⚠️ عذراً، نفدت كلياً الحصة اليومية للجوزاء أو يواجه الخادم ضغطاً عالياً ومؤقتاً. يرجى إضافة مفاتيح API المدوّرة الخاصة بك أو الانتقال للخيار الأول المجاني بالكامل من الأعلى.";
      }

      res.status(isQuota ? 429 : 500).json({
        success: false,
        error: errorMsg || "حدث خطأ غير متوقع أثناء معالجة طلب النطق عبر الجوزاء.",
      });
    }
  });

  // Video and Audio Dubbing with Transcribing, Translation, and Synced TTS Synthesis
  app.post("/api/dub", async (req, res) => {
    try {
      const { mediaData, mimeType, dialect, tone, voiceName, gender, engine, editedArabicText, duration } = req.body;
      const customKey = req.headers["x-gemini-key"] as string | undefined;

      if (!mediaData || !mimeType) {
        return res.status(400).json({ error: "الرجاء رفع ملف مرئي أو مسموع صالح للبدء بالدبلجة." });
      }

      const client = getGeminiClient(customKey);

      // Clean base64 string
      const rawBase64 = mediaData.replace(/^data:.*?;base64,/, "");

      let parsedResult: any = {
        hasSpeech: true,
        originalLanguage: "معدل يدوياً",
        transcription: "تم تعديل السيناريو يدوياً ولذلك تم تجاوز التحليل اللغوي الأصلي.",
        arabicTranslation: editedArabicText,
        scenesSummary: "معدل يدوياً من قبل المستخدم",
      };
      
      let arabicText = editedArabicText?.trim();

      // Step 1: Query Gemini using multimodal capabilities to transcribe and translate if no custom text provided
      if (!arabicText) {
        let durationInstruction = "";
        if (duration && typeof duration === "number" && duration > 0) {
          const maxWords = Math.round(duration * 2.3);
          durationInstruction = `\n4. مدة المقطع: طول المقطع المرفق هو ${duration.toFixed(1)} ثانية بالضبط. مهم جداً: يجب أن تكون الترجمة العربية الفصيحة/اللهجة قصيرة وموجزة للغاية بحيث تحتوي على ${maxWords} كلمة على الأكثر لتناسب مدة الفيديو تماماً وتتجنب الزيادة الحركية غير الدقيقة.`;
        }

        const prompt = `أنت خبير فنان الدبلجة والمترجم السمعي البصري الاحترافي لـ Gemini.
أمامك ملف وسائط مرفق (صوتي أو مرئي). قم بتحليله وترجمته ترجمة درامية احترافية ومعدة خصيصاً للدوبلاج الصوتي.

المهام التفصيلية:
1. استمع وحلل المادة: إذا كانت المادة مسموعة أو مرئية، حدد هل تحتوي على لغة منطوقة (الإنجليزية، التركية، الهندية، إلخ)؟
   - إذا نعم: قم بتفريغ النص المنطوق بالكامل (transcription)، ثم ترجمته بدقة وعناية فائقة وتنسيقه باللغة العربية بلهجة: [${dialect || "العربية الفصحى"}].
   - إذا لا: تفحص الفيديو للبحث عن كلمات مكتوبة على الشاشة أو نصوص وعلامات وإرشادات هامة مثل (Hi, Welcome, إلخ) وقم بتفريغها وترجمتها للعربية بشكل يلائم الدبلجة النطقية التلقائية.
2. نسّق السيناريو ليكون منساباً درامياً وطبيعياً جداً ومقسماً بشكل يبدو منسجماً مع التوقيتات والأداء بدون أي كلمات معقدة.
3. التشكيل الكامل: قم بتشكيل وضبط الكلمات العربية بالكامل لتسهيل نطقها بشكل متزن وممتاز من قبل محرك الكلام.${durationInstruction}

أرجو منك إرجاع كائن JSON حصراً بالأشكال الآتية تماماً وبصياغة صالحة للقراءة بواسطة JSON.parse، دون أي علامات markdown إضافية غير الضرورية:
{
  "hasSpeech": true,
  "originalLanguage": "اللغة الأصلية هنا",
  "transcription": "النص الأصلي هنا باللغة الأصلية",
  "arabicTranslation": "النص العربي المترجم والمشكل والمنقح والجاهز تماماً للنطق الصوتي الفوري هنا",
  "scenesSummary": "تلخيص المشهد أو النبرة المطلوبة لدبلجة مذهلة"
}

تنبيه: لا تضع أي شروحات أو عبارات خارج هذا القالب، فقط كائن الـ JSON الصالح للقراءة تماماً.`;

        console.log(`Analyzing media for Dubbing. MIME Type: ${mimeType}`);

        try {
          let analysisResponse;
          const videoAnalysisModels = [
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash",
            "gemini-flash-latest"
          ];
          let lastVideoAnalysisErr = null;

          for (const modelName of videoAnalysisModels) {
            try {
              console.log(`Attempting video translation with model: ${modelName}`);
              analysisResponse = await client.models.generateContent({
                model: modelName,
                contents: [{
                  parts: [
                    {
                      inlineData: {
                        data: rawBase64,
                        mimeType: mimeType,
                      },
                    },
                    { text: prompt },
                  ]
                }],
                config: {
                  responseMimeType: "application/json",
                }
              });
              break;
            } catch (modelErr: any) {
              console.warn(`Translation analysis failed for model ${modelName}:`, modelErr.message || modelErr);
              lastVideoAnalysisErr = modelErr;
            }
          }

          if (!analysisResponse) {
            throw lastVideoAnalysisErr || new Error("حدث خطأ غير معروف في جميع نماذج تحليل المقطع.");
          }

          const rawText = analysisResponse.text?.trim() || "";
          console.log("Gemini Dubbing analysis raw response received.");

          try {
            parsedResult = JSON.parse(rawText);
          } catch (e) {
            // Fallback parser if JSON wrap is slightly flawed
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("فشلت دبلجة الملف لغوياً في تحويل النتيجة بصيغة منظمة. يرجى المحاولة مجدداً.");
            }
          }
          arabicText = parsedResult.arabicTranslation || "";
        } catch (analysisTotalError: any) {
          console.warn("All Gemini video/audio analysis models failed.", analysisTotalError.message || analysisTotalError);
          const errMsg = String(analysisTotalError?.message || analysisTotalError || "خطأ غير معروف");
          
          console.log("Returning graceful fallback to let user write manual script.");
          return res.json({
            success: true,
            isFallback: true, // Special flag for frontend to not break on missing audio
            originalLanguage: "غير متوفر (يرجى إدخال النص يدوياً)",
            transcription: `[تعذر تحليل الفيديو تلقائياً] الرسالة التقنية: ${errMsg.slice(0, 100)}`,
            arabicTranslation: "⚠️ تعذر تحليل لغة الفيديو تلقائياً (إما بسبب الحصص اليومية المجانية أو نوع الملف). تفضل بكتابة السيناريو المطلوب باللغة العربية هنا، ثم انقر على زر (تحديث ودبلجة السيناريو المعدل 🔄) لتوليد الصوت ودبلجته مباشرة بطريقة رائعة ومجانية 100%!",
            scenesSummary: "تعذر التحليل التلقائي. يرجى كتابة أو تعديل سيناريو الرواية يدوياً أدناه وسيقوم المحرك بالنطق والدوبلاج مباشرة وبدقة ممتازة.",
            audioData: "" // Empty audio to prevent synthesizing error messages
          });
        }
      }

      if (!arabicText) {
        arabicText = "تم إكمال الترجمة بنجاح.";
      }

      // Step 2: Synthesize the translated Arabic text into audio!
      let dubbedBase64Audio = "";
      let isMp3Fallback = false;

      const shouldForceGoogle = (engine === "google" || engine === "browser");

      if (shouldForceGoogle) {
        console.log("Forcing free Google Translate TTS engine for video dubbing as requested.");
        const chunks = splitTextIntoChunks(arabicText, 150);
        const buffers: Buffer[] = [];

        for (const chunk of chunks) {
          let success = false;
          let retries = 3;
          while (retries > 0 && !success) {
            const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(chunk)}`;
            const response = await fetch(fallbackUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
            if (response.ok) {
              const arrayBuf = await response.arrayBuffer();
              if (arrayBuf.byteLength > 100) {
                 buffers.push(Buffer.from(arrayBuf));
                 success = true;
              } else {
                 console.warn("Google TTS returned too small buffer, might be blocked.");
              }
            }
            if (!success) {
               retries--;
               console.warn("Google TTS chunk failed, retrying...");
               await new Promise(r => setTimeout(r, 1500));
            }
          }
          await new Promise(r => setTimeout(r, 700)); // anti-ban delay
        }

        if (buffers.length > 0) {
          const combined = Buffer.concat(buffers);
          dubbedBase64Audio = combined.toString("base64");
          isMp3Fallback = true;
          console.log("Successfully dubbed with free Google Translate engine!");
        } else {
          throw new Error("تعذر دبلجة المقطع باستخدام المحرك الصوتي الفوري المجاني، يرجى المحاولة مجدداً.");
        }
      } else {
        // Setup the emotional TTS Prompt targeting our Gemini 3.1 TTS model for a gorgeous voice-over
        let finalVoiceName = voiceName || "Kore";
        let finalGenderInstruction = gender || "صوت طبيعي مميز";

        if (voiceName === "iraqi-young-smart") {
          finalVoiceName = "Puck";
          finalGenderInstruction = "شاب عراقي ذكي ومتسق بغدادي، نبرته متزنة وذكية وتستخدم اللهجة العراقية بصورة نقية وعذبة للغاية للشباب ومتطابقة مع إحساس الفيديو";
        } else if (voiceName === "iraqi-female-smart") {
          finalVoiceName = "Kore";
          finalGenderInstruction = "شابة عراقية ذكية ومتوازنة تروي بلهجة بغدادية دافئة ولطيفة";
        }

        const ttsPrompt = `أنت ممثل صوتي محترف وفنان دبلجة سينمائي ذو حضور رائع ونبرة صوت جذابة وطبيعية مئة بالمئة.
أمامك نص مترجم ومعد بعناية فائقة للدبلجة السينمائية. اقرأ النص التالي ومثله صوتياً بأعلى درجات الاندماج العاطفي والتعبير الفني الصادق.

معايير النطق والمشاعر الفنية:
1. اللهجة المعتمدة: ${dialect || "العربية الفصحى المبسطة"}.
2. النبرة الصوتية والتلقائية: نبرة مريحة ومتوافقة مع الحماس والمشاعر السائدة في السيناريو: [${tone || "طبيعية ومتزنة"}].
3. فئة اللفظ والشخصية الفنية: ${finalGenderInstruction}.

النص المترجم والمكتوب بالكامل للتمثيل الصوتي والدبلجة:
"${arabicText}"`;

        console.log(`Synthesizing Dubbed Voice-Over... Voice target: ${finalVoiceName}`);
        
        try {
          const ttsResponse = await client.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: ttsPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: finalVoiceName },
                },
              },
            },
          });

          dubbedBase64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
          if (!dubbedBase64Audio) {
            throw new Error("لم يرجع نموذج الصوت الفاخر استجابة صالحة، التحويل التلقائي جاري...");
          }
        } catch (recitationOrBackupErr: any) {
          console.warn("Gemini Premium TTS in Dubbing failed, sliding to Google Translate fallback TTS:", recitationOrBackupErr.message || recitationOrBackupErr);
          
          const chunks = splitTextIntoChunks(arabicText, 150);
          const buffers: Buffer[] = [];

          for (const chunk of chunks) {
            let success = false;
            let retries = 3;
            while (retries > 0 && !success) {
              const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(chunk)}`;
              const response = await fetch(fallbackUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              });
              if (response.ok) {
                const arrayBuf = await response.arrayBuffer();
                if (arrayBuf.byteLength > 100) {
                   buffers.push(Buffer.from(arrayBuf));
                   success = true;
                }
              }
              if (!success) {
                 retries--;
                 console.warn("Fallback Google TTS chunk failed, retrying...");
                 await new Promise(r => setTimeout(r, 1500));
              }
            }
            await new Promise(r => setTimeout(r, 700));
          }

          if (buffers.length > 0) {
            const combined = Buffer.concat(buffers);
            dubbedBase64Audio = combined.toString("base64");
            isMp3Fallback = true;
            console.log("Successfully backfilled with free Google Translate engine after Gemini TTS failure!");
          } else {
            throw new Error(`تعذر النطق الصوتي للمقطع عبر محرك النطق البديل بعد تعذر محرك Gemini: ${recitationOrBackupErr.message || recitationOrBackupErr}`);
          }
        }
      }

      res.json({
        success: true,
        hasSpeech: parsedResult.hasSpeech,
        originalLanguage: parsedResult.originalLanguage,
        transcription: parsedResult.transcription,
        arabicTranslation: arabicText,
        scenesSummary: parsedResult.scenesSummary,
        audioData: dubbedBase64Audio,
        isMp3: isMp3Fallback,
        voiceFeedback: `تمت دبلجة المقطع من (${parsedResult.originalLanguage || "غير محدد"}) بنجاح ونطقه بنبرة ${tone}`,
      });

    } catch (error: any) {
      console.error("Dubbing API Error:", error);
      res.status(500).json({
        error: error.message || "حدث خطأ فني أثناء دبلجة المقطع وترجمته ذكياً."
      });
    }
  });

  // Free, Unlimited Google Translate TTS Proxy endpoint
  app.post("/api/unlimited-tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({ error: "النص المطلوب تحويله فارغ أو غير صالح." });
      }

      const textToProcess = text.trim();
      const chunks = splitTextIntoChunks(textToProcess, 150);
      const buffers: Buffer[] = [];

      for (const chunk of chunks) {
        let success = false;
        let retries = 3;
        while (retries > 0 && !success) {
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(chunk)}`;
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });

          if (response.ok) {
            const arrayBuf = await response.arrayBuffer();
            if (arrayBuf.byteLength > 100) {
              buffers.push(Buffer.from(arrayBuf));
              success = true;
            }
          }
          if (!success) {
            retries--;
             console.warn("Google TTS chunk failed, retrying...");
             await new Promise(r => setTimeout(r, 1500));
          }
        }
        if (!success) {
          throw new Error(`فشل جلب النطق السريع من سحابة جوجل بشكل كامل.`);
        }
        await new Promise(r => setTimeout(r, 700));
      }

      const combinedBuffer = Buffer.concat(buffers);
      const base64Audio = combinedBuffer.toString("base64");

      res.json({
        success: true,
        audioData: base64Audio,
        isMp3: true,
        voiceFeedback: "تم توليد الصوت الفوري بنجاح عبر محرك النطق السحابي المفتوح اللامحدود!"
      });
    } catch (error: any) {
      console.error("Unlimited TTS Error:", error);
      res.status(500).json({
        error: error.message || "حدث خطأ غير متوقع أثناء توليد الصوت الفوري لغوياً."
      });
    }
  });

  // Handle Vite middleware for dev or Static asset routing for production
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
