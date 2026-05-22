import React from "react";
import { motion } from "motion/react";
import { Sparkles, HelpCircle, FileText, Bot } from "lucide-react";

interface TtsFormProps {
  text: string;
  setText: (val: string) => void;
  isGenerating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  dialectLabel: string;
  toneLabel: string;
}

// Complex Arabic words/sentences to test TTS pronunciation and intelligence
const difficultWords = [
  {
    word: "فَسَيَكْفِيكَهُمُ اللَّهُ ۚ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    label: "آية قرآنية صعبة",
    desc: "تختبر النطق الموصول الطويل والمخارج الدقيقة."
  },
  {
    word: "الْخُزَعْبَلَاتُ وَالسَّفْسَطَةُ الْفَلْسَفِيَّةُ",
    label: "كلمات معقدة لغوياً",
    desc: "تكامل التشكيل المخروطي وتفخيم الحروف المتتالية."
  },
  {
    word: "الْمُسْتَصْغِرُونَ يَسْتَنْشِقُونَ الْأُوكْسِجِينَ",
    label: "اشتقاقات لغوية ومصطلحات",
    desc: "حروف الهمس والصفير والجمع السالم."
  },
  {
    word: "هَلْ تَسْتَسْلِمُونَ يَا مَعْشَرَ الْمُتَشَعِّبِينَ؟",
    label: "سؤال حواري انفعالي",
    desc: "مثالي لاختبار نبرة الغضب أو التساؤل المدهش."
  },
  {
    word: "جَاءَ فِي دُسْتُورِ الْبِلَادِ أَنَّ الْمُوَاطَنَةَ حَقٌّ مَكْفُولٌ",
    label: "جملة رسمية جادة",
    desc: "تختبر الوقار ونبرة الإعلام والأخبار الجادة."
  }
];

export const TtsForm: React.FC<TtsFormProps> = ({
  text,
  setText,
  isGenerating,
  onSubmit,
  dialectLabel,
  toneLabel,
}) => {
  const handleQuickInsert = (val: string) => {
    setText(val);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" id="tts-form">
      {/* Difficult words testing catalog */}
      <div className="bg-indigo-50/40 dark:bg-slate-900/30 rounded-2xl p-4 border border-indigo-100/50 dark:border-slate-800/80">
        <div className="flex items-center gap-2 mb-2 text-indigo-900 dark:text-indigo-200">
          <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-semibold">تحدَّ ذكاء النطق! (كلمات وجمل صعبة الاختبار)</h4>
        </div>
        <p className="text-xs text-indigo-700/80 dark:text-indigo-300 mb-3 leading-relaxed">
          انقر على أي جملة من الجمل التشكيلية الصعبة أدناه لتعبئة الصندوق واختبار مخارج الحروف الفصيحة للذكاء الاصطناعي:
        </p>
        <div className="flex flex-wrap gap-2">
          {difficultWords.map((item, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              id={`quick-word-${index}`}
              onClick={() => handleQuickInsert(item.word)}
              className="text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all text-right flex flex-col cursor-pointer max-w-xs"
            >
              <span className="font-semibold text-gray-800 dark:text-gray-200 mb-0.5">
                {item.label}
              </span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono truncate w-full">
                {item.word}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main text input container */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
            <FileText className="w-4 h-4 text-gray-500" />
            أدخل النص الذي تريد نطقه هنا:
          </label>
          <span className="text-xs text-gray-400 font-mono">
            {text.length} حرف
          </span>
        </div>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب هنا النص باللغة العربية، يمكنك كتابته بالتشكيل أو بدونه. الذكاء الاصطناعي كافٍ ليفهم الكلمات الصعبة وينطقها حسب الحركات والسياق تلقائياً..."
            maxLength={1000}
            rows={5}
            id="tts-textarea"
            className="w-full rounded-2xl border-2 border-gray-200 dark:border-slate-800 p-4 font-sans text-sm focus:border-indigo-600 dark:focus:border-indigo-500 focus:outline-none transition-colors text-right leading-relaxed bg-white dark:bg-slate-950 resize-y"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>الحد الأقصى للنص هو 1000 حرف لتوفير جودة نطق وسرعة استجابة مثالية.</span>
        </div>
      </div>

      {/* Action submit button */}
      <div className="pt-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isGenerating || text.trim() === ""}
          id="tts-generate-submit-btn"
          className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
            isGenerating || text.trim() === ""
              ? "bg-gray-100 dark:bg-slate-900 text-gray-400 dark:text-gray-600 border-none cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-200 dark:shadow-none"
          }`}
        >
          {isGenerating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
              <span>جاري تحليل النص وتوليد الصوت وبث الانفعالات عاطفياً...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>تحويل النص إلى صوت ذكي الآن</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Brief selection tracker */}
      {!isGenerating && text.trim() !== "" && (
        <div className="text-center">
          <span className="text-xs text-gray-400">
            سيتم الإلقاء باللكنة <b className="text-indigo-600 dark:text-indigo-400">{dialectLabel}</b> ونبرة عاطفية <b className="text-rose-500">{toneLabel}</b>.
          </span>
        </div>
      )}
    </form>
  );
};
