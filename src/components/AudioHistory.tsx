import React, { useState } from "react";
import { HistoryItem } from "../types";
import { Play, Pause, Download, Trash, Clock, Volume2, Calendar, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AudioHistoryProps {
  history: HistoryItem[];
  currentlyPlayingId: string | null;
  onPlay: (item: HistoryItem) => void;
  onPause: () => void;
  onDownload: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const AudioHistory: React.FC<AudioHistoryProps> = ({
  history,
  currentlyPlayingId,
  onPlay,
  onPause,
  onDownload,
  onDelete,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDialect, setFilterDialect] = useState<string>("all");

  if (history.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 dark:bg-slate-900/10 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800" id="empty-history">
        <Volume2 className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400">سجل الاستماع فارغ</h4>
        <p className="text-xs text-gray-400 mt-1">الأصوات التي تقوم بتوليدها ستظهر هنا لحفظها والاستماع إليها لاحقاً.</p>
      </div>
    );
  }

  // Format date helper
  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "سابقاً";
    }
  };

  // Filter & Search Logic
  const filteredHistory = history.filter((item) => {
    const mainText = (item.text || "").toLowerCase();
    const origText = (item.textOriginal || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = mainText.includes(query) || origText.includes(query);

    if (filterDialect === "all") return matchesSearch;
    return matchesSearch && item.dialect.toLowerCase().includes(filterDialect.toLowerCase());
  });

  const uniqueDialects = [
    { label: "الكل", id: "all" },
    { label: "الفصحى", id: "الفصحى" },
    { label: "العراقية", id: "عراق" },
    { label: "السعودية", id: "سعود" },
    { label: "الإماراتية", id: "إمارات" },
    { label: "المصرية", id: "مصر" },
    { label: "الشامية", id: "شام" },
  ];

  return (
    <div className="space-y-4" id="audio-history-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">سجل التحويلات والأصوات المحفوظة</h3>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          id="clear-all-history-btn"
          className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer border border-rose-200 hover:border-rose-300 px-2.5 py-1 rounded-xl transition-all hover:bg-rose-50/50"
        >
          مسح السجل بالكامل
        </button>
      </div>

      {/* Search Input and Dialect Filter Pill Options */}
      <div className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-gray-150/45 dark:border-slate-800/80">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث في سجل النصوص والأصوات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-right font-sans"
            dir="rtl"
          />
          <Search className="w-4 h-4 text-gray-450 absolute right-3 top-2.5" />
        </div>

        {/* Dialect Fast Filter Tags */}
        <div className="flex flex-wrap gap-1.5 items-center justify-start" dir="rtl">
          <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-1 select-none">
            <Filter className="w-3 h-3 text-indigo-500" />
            تصفية بـ:
          </span>
          {uniqueDialects.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setFilterDialect(d.id)}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterDialect === d.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-950 border border-gray-250 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listing with Animation */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout text-right" initial={false}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item, index) => {
              const isPlaying = currentlyPlayingId === item.id;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={`${item.id}-${index}`}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isPlaying
                      ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-md shadow-indigo-100/50 dark:shadow-none"
                      : "border-gray-100 dark:border-slate-900 bg-white dark:bg-slate-950 hover:border-gray-200 hover:dark:border-slate-800"
                  }`}
                >
                  <div className="flex-1 space-y-2 text-right w-full">
                    {/* Text prompt */}
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed line-clamp-2">
                      {item.text}
                    </p>

                    {/* Metadata badges row */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                        🗣️ {item.dialect.split(" وبجميع")[0].split(" وبطابع")[0]}
                      </span>
                      <span className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-semibold font-mono">
                        🎭 {item.tone.split(" وسلس")[0].split(" وغاضب")[0].split(" ومليء")[0].split(" باكي")[0].split(" ووقور")[0].split(" ولطيف")[0].split(" ومزاح")[0]}
                      </span>
                      <span className="text-[10px] bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-semibold">
                        👤 {item.voiceName} ({item.gender.includes("شابة") ? "أنثى" : "ذكر"})
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5 mr-auto">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Interaction Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Play/Pause Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => (isPlaying ? onPause() : onPlay(item))}
                      id={`play-btn-${item.id}`}
                      className={`p-3 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                        isPlaying
                          ? "bg-rose-500 text-white hover:bg-rose-600 animate-pulse"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                      title={isPlaying ? "إيقاف مؤقت" : "استماع للصوت"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </motion.button>

                    {/* Download WAV Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => onDownload(item)}
                      id={`download-btn-${item.id}`}
                      className="p-3 rounded-full bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 hover:dark:bg-slate-800 cursor-pointer"
                      title="تحميل الملف الصوتي بـ صيغة WAV عالية الجودة"
                    >
                      <Download className="w-4 h-4" />
                    </motion.button>

                    {/* Trash Delete Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => onDelete(item.id)}
                      id={`delete-btn-${item.id}`}
                      className="p-3 rounded-full bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 text-rose-500 hover:bg-rose-100 hover:dark:bg-rose-950/30 cursor-pointer"
                      title="حذف من السجل"
                    >
                      <Trash className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 bg-gray-50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800"
            >
              <Search className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-405">لا توجد نتائج مطابقة لبحثك أو تصفيتك.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
