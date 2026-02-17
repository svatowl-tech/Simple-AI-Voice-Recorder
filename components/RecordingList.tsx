import React, { useState, useEffect, useRef } from 'react';
import { Play, FileText, BrainCircuit, Trash2, Calendar, Clock, X, Download, FileDown, Search, Sparkles, PenTool, Copy, Check, List } from 'lucide-react';
import { AudioRecording } from '../types';
import { getAudioBlob, deleteAudioBlob } from '../services/db';
import { transcribeAudio, analyzeText, improveTextWithPolza } from '../services/polza';

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
  const [copiedSection, setCopiedSection] = useState<'analysis' | 'improved' | 'transcription' | null>(null);
  
  // Export Menu State
  const [exportMenuOpen, setExportMenuOpen] = useState<{ type: 'transcription' | 'analysis' | 'improved', id: string } | null>(null);
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

  const handleImproveText = async () => {
    if (!selectedRecording || !selectedRecording.transcription || !apiKey) {
      alert("Для улучшения текста сначала нужна транскрипция и API ключ.");
      return;
    }

    setIsLoading(true);
    const prevStatus = selectedRecording.status;
    
    // Set status
    updateRecording({ ...selectedRecording, status: 'processing_improve' });

    try {
      const improved = await improveTextWithPolza(apiKey, selectedRecording.transcription, selectedModel);
      
      updateRecording({
        ...selectedRecording,
        status: prevStatus, // Revert to analyzed/transcribed status
        improvedText: improved
      });

    } catch (error) {
      console.error(error);
      alert("Ошибка улучшения текста: " + error);
      updateRecording({ ...selectedRecording, status: prevStatus });
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

  const handleCopy = async (text: string, section: 'analysis' | 'improved' | 'transcription') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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

    let contentText = "";
    let suffix = "";

    switch (exportMenuOpen.type) {
      case 'analysis':
        contentText = getAnalysisContent(selectedRecording);
        suffix = '_analysis';
        break;
      case 'transcription':
        contentText = selectedRecording.transcription || "";
        suffix = '_transcript';
        break;
      case 'improved':
        contentText = selectedRecording.improvedText || "";
        suffix = '_improved';
        break;
    }
    
    const baseFilename = selectedRecording.title.replace(/[^a-zа-яё0-9]/gi, '_');
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
  const renderDetailView = (rec: AudioRecording) => (
      <div className="h-full flex flex-col bg-dark pb-24 md:pb-0 overflow-hidden relative md:rounded-tl-2xl md:border-l md:border-slate-700">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 bg-surface/50 backdrop-blur-md sticky top-0 z-20">
          <button onClick={() => setSelectedId(null)} className="md:hidden p-2 hover:bg-slate-700 rounded-full">
              <X className="w-5 h-5" />
          </button>
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
          {rec.status !== 'analyzed' && rec.status !== 'processing_stt' && rec.status !== 'processing_ai' && rec.status !== 'processing_improve' && (
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
          {(rec.status === 'processing_stt' || rec.status === 'processing_ai' || rec.status === 'processing_improve') && (
            <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-xl animate-pulse">
               <p className="text-blue-200 text-center flex flex-col gap-1">
                 <span className="font-semibold">
                    {rec.status === 'processing_stt' && `Транскрибация аудио (${selectedSttModel})...`}
                    {rec.status === 'processing_ai' && `Анализ текста (${selectedModel})...`}
                    {rec.status === 'processing_improve' && `Улучшение текста с ИИ... Это может занять время.`}
                 </span>
                 <span className="text-xs opacity-70">Пожалуйста, не закрывайте приложение</span>
               </p>
            </div>
          )}

          {/* Analysis Results */}
          {rec.transcription && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Analysis Section */}
              <div className="xl:col-span-2 space-y-6">
                
                {rec.status === 'analyzed' && (
                  <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                          <h3 className="text-secondary font-semibold flex items-center gap-2">
                              <BrainCircuit className="w-5 h-5" />
                              AI Анализ
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(getAnalysisContent(rec), 'analysis');
                                }}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                                title="Копировать в буфер обмена"
                            >
                                {copiedSection === 'analysis' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                {copiedSection === 'analysis' ? 'Скопировано' : 'Копировать'}
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExportMenuOpen({ type: 'analysis', id: rec.id });
                                }}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                            >
                                <Download className="w-3 h-3" /> Экспорт
                            </button>
                          </div>
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

                {/* Improved Text Section */}
                {rec.improvedText && (
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3 pt-4 border-t border-slate-800">
                        <h3 className="text-purple-400 font-semibold flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            Улучшенный текст
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(rec.improvedText || '', 'improved');
                                }}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                                title="Копировать в буфер обмена"
                            >
                                {copiedSection === 'improved' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                {copiedSection === 'improved' ? 'Скопировано' : 'Копировать'}
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExportMenuOpen({ type: 'improved', id: rec.id });
                                }}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                            >
                                <FileDown className="w-3 h-3" /> Экспорт
                            </button>
                        </div>
                    </div>

                    {/* Export Menu for Improved Text */}
                    {exportMenuOpen?.type === 'improved' && (
                        <div ref={exportMenuRef} className="absolute right-0 top-14 z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                            <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Text (.txt)</button>
                            <button onClick={() => handleExport('rtf')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">Rich Text (.rtf)</button>
                            <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">MS Word (.doc)</button>
                        </div>
                    )}

                    <div className="bg-purple-900/10 rounded-xl p-6 border border-purple-500/30 shadow-sm">
                      <div className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap font-serif">
                        {rec.improvedText}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transcription Section */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-3 pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-3">
                        <h3 className="text-slate-400 font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Исходная транскрипция
                        </h3>
                        
                        {/* Improve Button */}
                        {!rec.improvedText && rec.status !== 'processing_improve' && (
                            <button
                              onClick={handleImproveText}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full hover:shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
                              title="Исправить ошибки и улучшить читаемость с помощью ИИ"
                            >
                              <Sparkles className="w-3 h-3" />
                              Улучшить с ИИ
                            </button>
                        )}
                        
                        {rec.improvedText && (
                            <button
                              onClick={handleImproveText}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                              title="Перегенерировать улучшенный текст"
                            >
                              <PenTool className="w-3 h-3" />
                              Пересоздать
                            </button>
                        )}

                      </div>
                      <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(rec.transcription || '', 'transcription');
                            }}
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                            title="Копировать в буфер обмена"
                        >
                            {copiedSection === 'transcription' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {copiedSection === 'transcription' ? 'Скопировано' : 'Копировать'}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setExportMenuOpen({ type: 'transcription', id: rec.id });
                            }}
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
                        >
                            <FileDown className="w-3 h-3" /> Экспорт
                        </button>
                      </div>
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
    <div className="flex h-full overflow-hidden">
      {/* List Sidebar */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-800 bg-slate-900/50`}>
        <div className="p-4 border-b border-slate-800 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <List className="w-5 h-5 text-primary" />
            Записи
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <BrainCircuit className="w-12 h-12 opacity-20" />
              <p>Нет записей</p>
            </div>
          ) : (
            recordings.map((rec) => (
              <div 
                key={rec.id}
                onClick={() => setSelectedId(rec.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border group ${
                  selectedId === rec.id 
                    ? 'bg-primary/20 border-primary/50 shadow-lg' 
                    : 'bg-surface border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-semibold text-sm truncate pr-2 ${selectedId === rec.id ? 'text-white' : 'text-slate-200'}`}>
                    {rec.title}
                  </h3>
                  <button 
                    onClick={(e) => handleDelete(e, rec.id)}
                    className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-700 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(rec.date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(rec.duration / 60)}:{String(rec.duration % 60).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex gap-2 mt-2">
                  {rec.transcription && (
                    <span className="bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded text-[10px] border border-blue-800/50">STT</span>
                  )}
                  {rec.summary && (
                    <span className="bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded text-[10px] border border-purple-800/50">AI</span>
                  )}
                  {rec.status.startsWith('processing') && (
                    <span className="bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded text-[10px] border border-yellow-800/50 animate-pulse">...</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Detail View */}
      <div className={`flex-1 ${selectedId ? 'flex' : 'hidden md:flex'} bg-dark relative`}>
        {selectedRecording ? (
          renderDetailView(selectedRecording)
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
             <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700">
                <Play className="w-8 h-8 opacity-50 ml-1" />
             </div>
             <p className="font-medium">Выберите запись для просмотра</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingList;