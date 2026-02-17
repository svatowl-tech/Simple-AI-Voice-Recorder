import React, { useState, useEffect, useRef } from 'react';
import { Play, FileText, BrainCircuit, Trash2, Calendar, Clock, ChevronRight, X, Download, FileDown } from 'lucide-react';
import { AudioRecording, AIAnalysisResult } from '../types';
import { getAudioBlob, deleteAudioBlob } from '../services/db';
import { transcribeAudio, analyzeText } from '../services/polza';
import ReactMarkdown from 'react-markdown';

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
          const updatedRec = { ...selectedRecording, status: 'processing_stt' as const };
          updateRecording(updatedRec);
          
          const sttResult = await transcribeAudio(apiKey, blob, selectedSttModel);
          transcriptionText = sttResult.text;
          
          updatedRec.transcription = transcriptionText;
          updatedRec.status = 'transcribed';
          updateRecording({ ...updatedRec });
      }

      // 3. AI Analysis
      const processingAiRec = { 
          ...selectedRecording, 
          transcription: transcriptionText,
          status: 'processing_ai' as const 
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

  // Detail View Component
  if (selectedId && selectedRecording) {
    return (
      <div className="h-full flex flex-col bg-dark pb-24 overflow-hidden relative">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 bg-surface/50 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold truncate flex-1">{selectedRecording.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Audio Player */}
          {currentBlobUrl && (
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-slate-700">
              <audio controls src={currentBlobUrl} className="w-full" />
            </div>
          )}

          {/* Action Button */}
          {selectedRecording.status !== 'analyzed' && selectedRecording.status !== 'processing_stt' && selectedRecording.status !== 'processing_ai' && (
             <button
             onClick={handleProcess}
             disabled={isLoading}
             className="w-full bg-gradient-to-r from-primary to-secondary p-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2"
           >
             <BrainCircuit className="w-5 h-5" />
             {isLoading ? 'Обработка...' : (selectedRecording.transcription ? 'Сгенерировать резюме' : 'Обработать с Polza AI')}
           </button>
          )}

          {/* Status Indicator during processing */}
          {(selectedRecording.status === 'processing_stt' || selectedRecording.status === 'processing_ai') && (
            <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-xl animate-pulse">
               <p className="text-blue-200 text-center flex flex-col gap-1">
                 <span className="font-semibold">
                    {selectedRecording.status === 'processing_stt' ? `Транскрибация аудио (${selectedSttModel})...` : `Анализ текста (${selectedModel})...`}
                 </span>
                 <span className="text-xs opacity-70">Это может занять некоторое время</span>
               </p>
            </div>
          )}

          {/* Analysis Results */}
          {selectedRecording.transcription && (
            <div className="space-y-6">
              
              {/* Analysis Section */}
              {selectedRecording.status === 'analyzed' && (
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                         <h3 className="text-secondary font-semibold flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" />
                            AI Анализ
                        </h3>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setExportMenuOpen({ type: 'analysis', id: selectedRecording.id });
                            }}
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                        >
                            <Download className="w-3 h-3" /> Экспорт
                        </button>
                    </div>

                    {/* Export Menu Popover for Analysis */}
                    {exportMenuOpen?.type === 'analysis' && (
                        <div ref={exportMenuRef} className="absolute right-0 top-8 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                            <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Text (.txt)</button>
                            <button onClick={() => handleExport('rtf')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Rich Text (.rtf)</button>
                            <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">MS Word (.doc)</button>
                        </div>
                    )}

                    {selectedRecording.summary && (
                        <div className="bg-surface rounded-xl p-5 border border-slate-700 mb-4">
                        <p className="text-slate-300 leading-relaxed text-sm">
                            <span className="text-slate-500 block text-xs font-bold mb-1 uppercase">Резюме</span>
                            {selectedRecording.summary}
                        </p>
                        </div>
                    )}

                    {selectedRecording.tasks && selectedRecording.tasks.length > 0 && (
                        <div className="bg-surface rounded-xl p-5 border border-slate-700 mb-4">
                        <span className="text-green-500 block text-xs font-bold mb-2 uppercase">Задачи</span>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                            {selectedRecording.tasks.map((task, idx) => (
                            <li key={idx}>{task}</li>
                            ))}
                        </ul>
                        </div>
                    )}

                    {selectedRecording.keyPoints && selectedRecording.keyPoints.length > 0 && (
                        <div className="bg-surface rounded-xl p-5 border border-slate-700">
                        <span className="text-amber-500 block text-xs font-bold mb-2 uppercase">Тезисы</span>
                        <ul className="space-y-2">
                            {selectedRecording.keyPoints.map((point, idx) => (
                            <li key={idx} className="flex gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded">
                                <span className="text-amber-400 font-bold min-w-[10px]">•</span>
                                <span>{point}</span>
                            </li>
                            ))}
                        </ul>
                        </div>
                    )}
                </div>
              )}

              {/* Transcription Section */}
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-slate-400 font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Транскрипция
                    </h3>
                    <button 
                         onClick={(e) => {
                            e.stopPropagation();
                            setExportMenuOpen({ type: 'transcription', id: selectedRecording.id });
                        }}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                    >
                        <FileDown className="w-3 h-3" /> Экспорт
                    </button>
                </div>

                 {/* Export Menu Popover for Transcription */}
                 {exportMenuOpen?.type === 'transcription' && (
                        <div ref={exportMenuRef} className="absolute right-0 top-8 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                            <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Text (.txt)</button>
                            <button onClick={() => handleExport('rtf')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Rich Text (.rtf)</button>
                            <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">MS Word (.doc)</button>
                        </div>
                    )}

                <div className="bg-surface rounded-xl p-5 border border-slate-700">
                  <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedRecording.transcription}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  // List View Component
  return (
    <div className="h-full flex flex-col p-4 pb-24 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 text-white sticky top-0 bg-dark z-10 py-2">Мои записи</h2>
      {recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 mt-20">
          <Clock className="w-16 h-16 mb-4 opacity-20" />
          <p>Нет записей</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map((rec) => (
            <div 
              key={rec.id}
              onClick={() => setSelectedId(rec.id)}
              className="bg-surface hover:bg-slate-700/50 transition-colors p-4 rounded-xl border border-slate-700 flex items-center gap-4 cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                rec.status === 'analyzed' ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
              }`}>
                {rec.status === 'analyzed' ? <BrainCircuit className="w-5 h-5" /> : <Play className="w-4 h-4 ml-0.5" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{rec.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(rec.date).toLocaleDateString()}
                  </span>
                  <span>{Math.floor(rec.duration / 60)}:{(rec.duration % 60).toString().padStart(2, '0')}</span>
                  {rec.status === 'analyzed' && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">AI Ready</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                 <button 
                  onClick={(e) => handleDelete(e, rec.id)}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecordingList;