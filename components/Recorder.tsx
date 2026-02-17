import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Save, RotateCcw, Upload, MonitorPlay, Info } from 'lucide-react';
import { AudioRecording } from '../types';
import { saveAudioBlob } from '../services/db';
import { v4 as uuidv4 } from 'uuid';

interface RecorderProps {
  onRecordingComplete: (recording: AudioRecording) => void;
}

type RecordingMode = 'mic' | 'conference';

const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mode, setMode] = useState<RecordingMode>('mic');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // Refs for audio mixing
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceStreamsRef = useRef<MediaStream[]>([]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err: any) {
      console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err: any) {
        console.error(`Wake Lock release error: ${err.name}, ${err.message}`);
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isRecording) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      let finalStream: MediaStream;
      sourceStreamsRef.current = []; // Reset tracked streams

      if (mode === 'mic') {
        // Standard Mic Recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        finalStream = stream;
        sourceStreamsRef.current.push(stream);
      } else {
        // Conference Recording (Mic + System Audio)
        try {
            // 1. Get System Audio (via Screen Share)
            // Note: We request video: true because getDisplayMedia requires it, but we won't record the video track.
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true, 
                audio: true 
            });

            // Check if user actually shared audio
            if (displayStream.getAudioTracks().length === 0) {
                alert("Внимание: Вы не предоставили доступ к системному аудио. Будет записан только микрофон (или тишина). Убедитесь, что поставили галочку 'Share audio' в системном окне.");
            }

            sourceStreamsRef.current.push(displayStream);

            // 2. Get Microphone
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            sourceStreamsRef.current.push(micStream);

            // 3. Mix streams using Web Audio API
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            const dest = ctx.createMediaStreamDestination();

            // Add Display Audio to Mix
            if (displayStream.getAudioTracks().length > 0) {
                const sysSrc = ctx.createMediaStreamSource(displayStream);
                sysSrc.connect(dest);
            }

            // Add Mic Audio to Mix
            if (micStream.getAudioTracks().length > 0) {
                const micSrc = ctx.createMediaStreamSource(micStream);
                micSrc.connect(dest);
            }

            finalStream = dest.stream;

            // Stop recording if user stops screen sharing via browser UI
            displayStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

        } catch (err) {
            console.error("Error setting up conference recording", err);
            alert("Ошибка доступа к экрану или микрофону. Отмена записи.");
            return;
        }
      }

      const mediaRecorder = new MediaRecorder(finalStream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Cleanup all tracks
        sourceStreamsRef.current.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        
        // Cleanup Audio Context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        releaseWakeLock();
      };

      mediaRecorder.start();
      setIsRecording(true);
      await requestWakeLock();
      
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (err) {
      console.error("Error accessing media devices", err);
      alert("Не удалось получить доступ к устройствам записи.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setDuration(0);
    releaseWakeLock();
  };

  const saveRecording = async () => {
    if (!audioBlob) return;

    const id = uuidv4();
    const newRecording: AudioRecording = {
      id,
      title: mode === 'conference' 
        ? `Встреча ${new Date().toLocaleString('ru-RU')}`
        : `Запись ${new Date().toLocaleString('ru-RU')}`,
      date: Date.now(),
      duration,
      status: 'recorded'
    };

    await saveAudioBlob(id, audioBlob);
    onRecordingComplete(newRecording);
    resetRecording();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
        alert("Пожалуйста, выберите аудиофайл (mp3, wav, m4a и т.д.)");
        return;
    }

    const tempAudio = new Audio(URL.createObjectURL(file));
    
    tempAudio.onloadedmetadata = async () => {
        const fileDuration = tempAudio.duration === Infinity || isNaN(tempAudio.duration) ? 0 : Math.floor(tempAudio.duration);
        const id = uuidv4();
        
        const newRecording: AudioRecording = {
            id,
            title: file.name.replace(/\.[^/.]+$/, "") || `Импорт ${new Date().toLocaleString('ru-RU')}`,
            date: Date.now(),
            duration: fileDuration,
            status: 'recorded'
        };

        await saveAudioBlob(id, file);
        onRecordingComplete(newRecording);
    };

    tempAudio.onerror = () => {
        alert("Ошибка при чтении файла.");
    };

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      releaseWakeLock();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 pb-24">
      
      {/* Mode Switcher */}
      {!isRecording && !audioBlob && (
          <div className="mb-8 flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setMode('mic')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'mic' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              Микрофон
            </button>
            <button
              onClick={() => setMode('conference')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'conference' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MonitorPlay className="w-4 h-4" />
              Конференция
            </button>
          </div>
      )}

      {/* Info Box for Conference Mode */}
      {!isRecording && !audioBlob && mode === 'conference' && (
        <div className="mb-6 max-w-xs bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-lg flex gap-3 text-left">
           <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
           <p className="text-xs text-indigo-200">
             Для записи вебинара или звонка выберите вкладку или окно и обязательно включите <b>"Share audio" (Поделиться аудио)</b> в системном окне.
           </p>
        </div>
      )}

      {/* Visualizer / Timer */}
      <div className="mb-12 relative flex items-center justify-center">
        {isRecording && (
          <div className={`absolute w-64 h-64 rounded-full animate-ping ${mode === 'conference' ? 'bg-indigo-500/20' : 'bg-red-500/20'}`}></div>
        )}
        <div className="relative z-10 w-48 h-48 rounded-full bg-surface border-4 border-slate-700 flex flex-col items-center justify-center shadow-2xl">
           <span className={`text-4xl font-mono font-bold ${isRecording ? (mode === 'conference' ? 'text-indigo-400' : 'text-red-500') : 'text-slate-200'}`}>
             {formatTime(duration)}
           </span>
           <span className="text-xs text-slate-500 mt-2 uppercase tracking-widest flex items-center gap-1">
             {isRecording 
                ? (mode === 'conference' ? <><MonitorPlay className="w-3 h-3"/> Запись...</> : <><Mic className="w-3 h-3"/> Запись...</>) 
                : 'Готов'
             }
           </span>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="audio/*" 
        className="hidden" 
        style={{ display: 'none' }}
      />

      {/* Controls */}
      <div className="w-full max-w-xs flex items-center justify-center gap-6">
        {!audioBlob ? (
          !isRecording ? (
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 ring-4 ${
                    mode === 'conference' 
                    ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20 ring-indigo-900/30' 
                    : 'bg-red-500 hover:bg-red-600 shadow-red-900/20 ring-red-900/30'
                }`}
              >
                {mode === 'conference' ? <MonitorPlay className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
              </button>
              
              <button 
                onClick={handleImportClick}
                className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium border border-transparent hover:border-slate-700"
              >
                <Upload className="w-4 h-4" />
                Загрузить файл
              </button>
            </div>
          ) : (
            <button
              onClick={stopRecording}
              className="w-24 h-24 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 border-4 border-slate-500"
            >
              <Square className="w-10 h-10 text-white fill-current" />
            </button>
          )
        ) : (
          <>
            <button
              onClick={resetRecording}
              className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 hover:border-slate-400 transition-colors">
                 <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-xs">Сброс</span>
            </button>

            <button
              onClick={saveRecording}
              className="w-24 h-24 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-900/20 transition-all hover:scale-105 active:scale-95 ring-4 ring-green-900/30"
            >
              <Save className="w-10 h-10 text-white" />
            </button>
          </>
        )}
      </div>

      {audioBlob && (
        <div className="mt-8 w-full max-w-sm bg-surface p-4 rounded-lg border border-slate-700">
           <audio controls src={URL.createObjectURL(audioBlob)} className="w-full h-8" />
           <p className="text-center text-xs text-slate-400 mt-2">Прослушайте перед сохранением</p>
        </div>
      )}
    </div>
  );
};

export default Recorder;