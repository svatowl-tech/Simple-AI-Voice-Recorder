import React, { useState, useEffect, useRef } from 'react';
import { Play, FileText, BrainCircuit, Trash2, Calendar, Clock, X, Download, FileDown, Search } from 'lucide-react';
import { AudioRecording } from '../types';
import { getAudioBlob, deleteAudioBlob } from '../services/db';
import { transcribeAudio, analyzeText } from '../services/polza';

interface RecordingListProps {
  recordings: AudioRecording[];
  apiKey: string;
  selectedModel: string;
  selectedSttModel: string;
  updateRecording: (updated: AudioRecording) => void;
  deleteRecording: (id: string) => void;
}

const RecordingList: React.FC<RecordingListProps> = ({ 
  recordings, 
  apiKey, 
  selectedModel, 
  selectedSttModel, 
  updateRecording, 
  deleteRecording 
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Export Menu State
  const [exportMenuOpen, setExportMenuOpen] = useState<{ type: 'transcription' | 'analysis', id: string } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const selectedRecording = recordings.find(r => r.id === selectedId);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load blob when selecting a recording
  useEffect(() => {
    if (selectedId) {
      getAudioBlob(selectedId).then(blob => {
        if (blob) {
          setCurrentBlobUrl(URL.createObjectURL(blob));
        }
      });
    } else {
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
      setCurrentBlobUrl(null);
    }
  }, [selectedId]);

  const handleProcess = async () => {
    if (!selectedRecording || !apiKey) {
      alert("Пожалуйста, введите API ключ в настройках.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get Blob
      const blob = await getAudioBlob(selectedRecording.id);
      if (!blob) throw new Error("Audio file not found locally");

      // 2. Transcribe
      // Only transcribe if we haven't already, or if previous status was error during stt
      let transcriptionText = selectedRecording.transcription;

      if (!transcriptionText) {
          const processingSttRec: AudioRecording = { ...selectedRecording, status: 'processing_stt' };
          updateRecording(processingSttRec);
          
          const sttResult = await transcribeAudio(apiKey, blob, selectedSttModel);
          transcriptionText = sttResult.text;
          
          const transcribedRec: AudioRecording = {
            ...processingSttRec,
            transcription: transcriptionText,
            status: 'transcribed'
          };
          updateRecording(transcribedRec);
      }

      // 3. AI Analysis
      const processingAiRec: AudioRecording = { 
          ...selectedRecording, 
          transcription: transcriptionText,
          status: 'processing_ai'
      };
      updateRecording(processingAiRec);

      const aiResult = await analyzeText(apiKey, transcriptionText, selectedModel);

      const finalRec: AudioRecording = {
          ...processingAiRec,
          summary: aiResult.summary,
          tasks: aiResult.tasks,
          keyPoints: aiResult.keyPoints,
          status: 'analyzed'
      };
      
      updateRecording(finalRec);

    } catch (error) {
      console.error(error);
      updateRecording({ ...selectedRecording, status: 'error' });
      alert("Ошибка обработки: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Удалить эту запись?")) {
      await deleteAudioBlob(id);
      deleteRecording(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  // --- EXPORT LOGIC ---
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMenuOpen(null);
  };

  const getAnalysisContent = (rec: AudioRecording) => {
    let text = `ОТЧЕТ AI АНАЛИЗА\nНазвание: ${rec.title}\nДата: ${new Date(rec.date).toLocaleString()}\n\n`;
    if (rec.summary) text += `--- КРАТКОЕ РЕЗЮМЕ ---\n${rec.summary}\n\n`;
    if (rec.tasks && rec.tasks.length > 0) {
        text += `--- ЗАДАЧИ ---\n`;
        rec.tasks.forEach(t => text += `[ ] ${t}\n`);
        text += `\n`;
    }
    if (rec.keyPoints && rec.keyPoints.length > 0) {
        text += `--- КЛЮЧЕВЫЕ ТЕЗИСЫ ---\n`;
        rec.keyPoints.forEach(p => text += `• ${p}\n`);
        text += `\n`;
    }
    return text;
  };

  // RTF helper with basic unicode support for Cyrillic
  const toRTF = (text: string) => {
    // Escape special characters
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/\n/g, '\\par\n');
    
    // Convert non-ascii to unicode hex
    const unicodeText = escaped.split('').map(char => {
        const code = char.charCodeAt(0);
        return code > 127 ? `\\u${code}?` : char;
    }).join('');

    return `{\\rtf1\\ansi\\ansicpg1251\\deff0\\nouicompat\\deflang1049{\\fonttbl{\\f0\\fnil\\fcharset204 Calibri;}}
{\\*\\generator Polza App;}\\viewkind4\\uc1 
\\pard\\sa200\\sl276\\slmult1\\f0\\fs22\\lang1049 ${unicodeText}\\par
}`;
  };

  const toHTMLDoc = (text: string, title: string) => {
      return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${title}</title></head>
      <body style="font-family: Calibri, sans-serif;">
      ${text.replace(/\n/g, '<br/>')}
      </body></html>`;
  };

  const handleExport = (format: 'txt' | 'rtf' | 'doc') => {
    if (!selectedRecording || !exportMenuOpen) return;

    const isAnalysis = exportMenuOpen.type === 'analysis';
    const contentText = isAnalysis 
        ? getAnalysisContent(selectedRecording) 
        : (selectedRecording.transcription || "");
    
    const baseFilename = selectedRecording.title.replace(/[^a-zа-яё0-9]/gi, '_');
    const suffix = isAnalysis ? '_analysis' : '_transcript';
    const filename = `${baseFilename}${suffix}.${format}`;

    if (format === 'txt') {
        downloadFile(contentText, filename, 'text/plain;charset=utf-8');
    } else if (format === 'rtf') {
        downloadFile(toRTF(contentText), filename, 'application/rtf');
    } else if (format === 'doc') {
        // Saving as .doc using HTML content is a standard web trick that Word supports well
        downloadFile(toHTMLDoc(contentText, selectedRecording.title), filename, 'application/msword');
    }
  };

  // RENDER HELPERS
  const renderDetailView = (rec: AudioRecording, isMobile: boolean) => (
      <div className={`h-full flex flex-col bg-dark pb-24 md:pb-0 overflow-hidden relative ${isMobile ? '' : 'rounded-tl-2xl border-l border-slate-700'}`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 bg-surface/50 backdrop-blur-md sticky top-0 z-20">
          {isMobile && (
             <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-slate-700 rounded-full">
                <X className="w-5 h-5" />
             </button>
          )}
          <h2 className="text-lg font-semibold truncate flex-1">{rec.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {/* Audio Player */}
          {currentBlobUrl && (
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-slate-700">
              <audio controls src={currentBlobUrl} className="w-full" />
            </div>
          )}

          {/* Action Button */}
          {rec.status !== 'analyzed' && rec.status !== 'processing_stt' && rec.status !== 'processing_ai' && (
             <button
             onClick={handleProcess}
             disabled={isLoading}
             className="w-full bg-gradient-to-r from-primary to-secondary p-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
           >
             <BrainCircuit className="w-5 h-5" />
             {isLoading ? 'Обработка...' : (rec.transcription ? 'Сгенерировать резюме' : 'Обработать с Polza AI')}
           </button>
          )}

          {/* Status Indicator during processing */}
          {(rec.status === 'processing_stt' || rec.status === 'processing_ai') && (
            <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-xl animate-pulse">
               <p className="text-blue-200 text-center flex flex-col gap-1">
                 <span className="font-semibold">
                    {rec.status === 'processing_stt' ? `Транскрибация аудио (${selectedSttModel})...` : `Анализ текста (${selectedModel})...`}
                 </span>
                 <span className="text-xs opacity-70">Это может занять некоторое время</span>
               </p>
            </div>
          )}

          {/* Analysis Results */}
          {rec.transcription && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Analysis Section (Full width on mobile, half on very wide desktop screens if needed, keeping stacked for now for better reading) */}
              <div className="xl:col-span-2 space-y-6">
                
                {rec.status === 'analyzed' && (
                  <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                          <h3 className="text-secondary font-semibold flex items-center gap-2">
                              <BrainCircuit className="w-5 h-5" />
                              AI Анализ
                          </h3>
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setExportMenuOpen({ type: 'analysis', id: rec.id });
                              }}
                              className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                          >
                              <Download className="w-3 h-3" /> Экспорт отчета
                          </button>
                      </div>

                      {/* Export Menu Popover for Analysis */}
                      {exportMenuOpen?.type === 'analysis' && (
                          <div ref={exportMenuRef} className="absolute right-0 top-10 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                              <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Text (.txt)</button>
                              <button onClick={() => handleExport('rtf')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Rich Text (.rtf)</button>
                              <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">MS Word (.doc)</button>
                          </div>
                      )}

                      {rec.summary && (
                          <div className="bg-surface rounded-xl p-5 border border-slate-700 mb-4 shadow-sm">
                          <p className="text-slate-200 leading-relaxed text-base">
                              <span className="text-slate-500 block text-xs font-bold mb-2 uppercase tracking-wider">Резюме</span>
                              {rec.summary}
                          </p>
                          </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        {rec.tasks && rec.tasks.length > 0 && (
                            <div className="bg-surface rounded-xl p-5 border border-slate-700 shadow-sm h-full">
                            <span className="text-green-500 block text-xs font-bold mb-3 uppercase tracking-wider">Задачи</span>
                            <ul className="list-none space-y-3 text-slate-300 text-sm">
                                {rec.tasks.map((task, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <div className="mt-1 min-w-[16px] h-4 border-2 border-slate-600 rounded flex-shrink-0"></div>
                                  <span>{task}</span>
                                </li>
                                ))}
                            </ul>
                            </div>
                        )}

                        {rec.keyPoints && rec.keyPoints.length > 0 && (
                            <div className="bg-surface rounded-xl p-5 border border-slate-700 shadow-sm h-full">
                            <span className="text-amber-500 block text-xs font-bold mb-3 uppercase tracking-wider">Тезисы</span>
                            <ul className="space-y-2">
                                {rec.keyPoints.map((point, idx) => (
                                <li key={idx} className="flex gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-800">
                                    <span className="text-amber-400 font-bold min-w-[10px]">•</span>
                                    <span>{point}</span>
                                </li>
                                ))}
                            </ul>
                            </div>
                        )}
                      </div>
                  </div>
                )}

                {/* Transcription Section */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-3 pt-4 border-t border-slate-800">
                      <h3 className="text-slate-400 font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Транскрипция
                      </h3>
                      <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              setExportMenuOpen({ type: 'transcription', id: rec.id });
                          }}
                          className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                      >
                          <FileDown className="w-3 h-3" /> Экспорт текста
                      </button>
                  </div>

                  {/* Export Menu Popover for Transcription */}
                  {exportMenuOpen?.type === 'transcription' && (
                          <div ref={exportMenuRef} className="absolute right-0 top-14 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                              <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Text (.txt)</button>
                              <button onClick={() => handleExport('rtf')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Rich Text (.rtf)</button>
                              <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">MS Word (.doc)</button>
                          </div>
                      )}

                  <div className="bg-surface rounded-xl p-6 border border-slate-700 shadow-sm">
                    <div className="text-slate-300 text-base leading-relaxed whitespace-pre-wrap font-sans">
                      {rec.transcription}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
  );

  return (
    <div className="flex h-full w-full">
      
      {/* LEFT COLUMN: LIST */}
      {/* On Mobile: Hidden if selectedId is set. On Desktop: Always visible, fixed width */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 flex-shrink-0 bg-dark md:bg-transparent h-full pb-20 md:pb-0`}>
        <div className="p-4 md:p-6 sticky top-0 bg-dark z-10">
           <h2 className="text-2xl font-bold text-white mb-4">Мои записи</h2>
           <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Поиск..." 
                className="w-full bg-surface border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary placeholder-slate-600"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Clock className="w-12 h-12 mb-4 opacity-20" />
              <p>Нет записей</p>
            </div>
          ) : (
            recordings.map((rec) => (
              <div 
                key={rec.id}
                onClick={() => setSelectedId(rec.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group relative
                  ${selectedId === rec.id 
                    ? 'bg-primary/10 border-primary shadow-md' 
                    : 'bg-surface hover:bg-slate-700/50 border-slate-700'
                  }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    rec.status === 'analyzed' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {rec.status === 'analyzed' ? <BrainCircuit className="w-4 h-4" /> : <Play className="w-3 h-3 ml-0.5" />}
                  </div>
                  <h3 className={`font-medium truncate text-sm flex-1 ${selectedId === rec.id ? 'text-primary' : 'text-white'}`}>
                    {rec.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pl-11">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(rec.date).toLocaleDateString()}
                  </span>
                  <span>{Math.floor(rec.duration / 60)}:{(rec.duration % 60).toString().padStart(2, '0')}</span>
                </div>

                <button 
                  onClick={(e) => handleDelete(e, rec.id)}
                  className="absolute top-3 right-3 p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: DETAIL VIEW */}
      {/* On Mobile: Visible if selectedId is set. On Desktop: Visible always (placeholder or content) */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 h-full w-full overflow-hidden`}>
          {selectedId && selectedRecording ? (
             renderDetailView(selectedRecording, window.innerWidth < 768)
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center w-full h-full text-slate-500 bg-slate-900/50 rounded-tl-2xl border-l border-slate-800">
               <FileText className="w-16 h-16 mb-4 opacity-10" />
               <p className="text-lg font-medium">Выберите запись для просмотра</p>
               <p className="text-sm opacity-60">Транскрипция и AI анализ появятся здесь</p>
            </div>
          )}
      </div>

    </div>
  );
};

export default RecordingList;