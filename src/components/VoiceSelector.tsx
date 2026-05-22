import React from "react";
import { motion } from "motion/react";
import { DialectOption, ToneOption, VoiceOption } from "../types";
import { dialectOptions, toneOptions, voiceOptions } from "../utils/audio";
import { UserCheck, MessageSquare, AudioLines, Sparkles, Check } from "lucide-react";

interface VoiceSelectorProps {
  selectedDialect: string;
  setSelectedDialect: (val: string) => void;
  selectedTone: string;
  setSelectedTone: (val: string) => void;
  selectedVoice: string;
  setSelectedVoice: (val: string) => void;
  selectedGender: string;
  setSelectedGender: (val: string) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedDialect,
  setSelectedDialect,
  selectedTone,
  setSelectedTone,
  selectedVoice,
  setSelectedVoice,
  selectedGender,
  setSelectedGender,
}) => {
  return (
    <div className="space-y-8" id="voice-selector-container">
      {/* 1. Dialect Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            أولاً: اختر اللهجة أو الكنة العربية
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          الذكاء الاصطناعي سيتحدث باللهجة المحددة ببراعة وسرعة كلام طبيعية.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {dialectOptions.map((dialect) => {
            const isSelected = selectedDialect === dialect.id;
            return (
              <motion.button
                key={dialect.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDialect(dialect.id)}
                type="button"
                id={`dialect-btn-${dialect.id.replace(/\s+/g, "-")}`}
                className={`p-3.5 rounded-2xl flex flex-col items-start text-right transition-all border-2 w-full cursor-pointer relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 left-2 bg-indigo-600 text-white p-0.5 rounded-full">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl" role="img" aria-label="flag">
                    {dialect.flag}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {dialect.label}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-normal">
                  {dialect.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 2. Tone and Emotion Selector */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AudioLines className="w-5 h-5 text-rose-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ثانياً: حدد نبرة الصوت والانفعال الشعوري
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          سيقوم النظام بتغيير نبرة الصوت، سرعته، وحدته لتعكس المشاعر المطلوبة.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {toneOptions.map((tone) => {
            const isSelected = selectedTone === tone.id;
            return (
              <motion.button
                key={tone.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedTone(tone.id)}
                type="button"
                id={`tone-btn-${tone.label.replace(/\s+/g, "-")}`}
                className={`p-3 rounded-2xl flex flex-col items-start text-right transition-all border-2 w-full cursor-pointer relative ${
                  isSelected
                    ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 left-2 bg-rose-500 text-white p-0.5 rounded-full">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                <span className="font-medium text-gray-905 dark:text-gray-100 text-sm mb-1">
                  {tone.label}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  {tone.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 3. Prebuilt Voice Selection & Gender Customization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Base Prebuilt Voice */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              ثالثاً: خامة وطبقة الصوت الأساسية
            </h3>
          </div>
          <div className="space-y-2">
            {voiceOptions.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <div
                  key={voice.id}
                  onClick={() => {
                    setSelectedVoice(voice.id);
                    // Match default gender to voice mapping
                    if (voice.gender === "female") {
                      setSelectedGender("شابة (صوت ناعم ومناسب للفتيات)");
                    } else if (voice.gender === "male") {
                      setSelectedGender("شاب (صوت مفعم بالرجولية والحيوية)");
                    } else {
                      setSelectedGender("شخص ناضج ومتزن (صوت متوسط)");
                    }
                  }}
                  id={`voice-option-${voice.id}`}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between text-right cursor-pointer transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-50/30 dark:bg-sky-950/20"
                      : "border-gray-100 dark:border-gray-900 hover:border-gray-200"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {voice.label}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {voice.description}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center mr-2 ${
                        isSelected ? "border-sky-500" : "border-gray-300"
                      }`}
                    >
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Gender Tone Overlays */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              رابعاً: توجيه الصوت ومستواه العمري
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            يسهم هذا الإعداد في تخصيص طبقة الصوت النهائية والسرعة لتلائم الفئة المختارة.
          </p>
          <div className="space-y-2">
            {[
              { id: "شاب (صوت مفعم بالرجولية والحيوية)", label: "صوت شاب (متوسط السرعة)" },
              { id: "شابة (صوت ناعم ومناسب للفتيات)", label: "صوت شابة (ناعم ولطيف)" },
              { id: "طفل صغير أو طفلة مرحة", label: "صوت طفل أو طفلة (مرح ونشيط)" },
              { id: "شخص وقور ومتقدم في السن بحكمة عالية", label: "صوت وقور/كبير في السن (متزن ومتروٍّ)" }
            ].map((option) => {
              const isSelected = selectedGender === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => setSelectedGender(option.id)}
                  id={`gender-option-${option.id.replace(/\s+/g, "-")}`}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between text-right cursor-pointer transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
                      : "border-gray-100 dark:border-gray-900 hover:border-gray-200"
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {option.label}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center mr-2 ${
                      isSelected ? "border-emerald-500" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
