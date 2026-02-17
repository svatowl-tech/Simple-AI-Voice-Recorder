import React, { useState, useEffect } from 'react';
import { Mic, List, Settings as SettingsIcon } from 'lucide-react';
import Recorder from './components/Recorder';
import RecordingList from './components/RecordingList';
import Settings from './components/Settings';
import { AudioRecording, Tab, DEFAULT_MODEL, DEFAULT_STT_MODEL } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.RECORD);
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [selectedSttModel, setSelectedSttModel] = useState<string>(DEFAULT_STT_MODEL);
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);

  // Load data on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('polza_api_key');
    if (storedKey) setApiKey(storedKey);

    const storedModel = localStorage.getItem('polza_selected_model');
    if (storedModel) setSelectedModel(storedModel);

    const storedSttModel = localStorage.getItem('polza_selected_stt_model');
    if (storedSttModel) setSelectedSttModel(storedSttModel);

    const storedRecs = localStorage.getItem('polza_recordings_meta');
    if (storedRecs) {
      try {
        setRecordings(JSON.parse(storedRecs));
      } catch (e) {
        console.error("Failed to parse recordings metadata");
      }
    }
  }, []);

  // Persistence helpers
  const saveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('polza_api_key', key);
  };

  const saveModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('polza_selected_model', model);
  };

  const saveSttModel = (model: string) => {
    setSelectedSttModel(model);
    localStorage.setItem('polza_selected_stt_model', model);
  };

  const saveRecordingsMeta = (recs: AudioRecording[]) => {
    setRecordings(recs);
    localStorage.setItem('polza_recordings_meta', JSON.stringify(recs));
  };

  const addRecording = (rec: AudioRecording) => {
    const newRecs = [rec, ...recordings];
    saveRecordingsMeta(newRecs);
    setActiveTab(Tab.LIST);
  };

  const updateRecording = (updated: AudioRecording) => {
    const newRecs = recordings.map(r => r.id === updated.id ? updated : r);
    saveRecordingsMeta(newRecs);
  };

  const deleteRecording = (id: string) => {
    const newRecs = recordings.filter(r => r.id !== id);
    saveRecordingsMeta(newRecs);
  };

  return (
    <div className="w-full h-screen bg-dark text-white flex flex-col overflow-hidden max-w-lg mx-auto shadow-2xl relative">
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === Tab.RECORD && <Recorder onRecordingComplete={addRecording} />}
        {activeTab === Tab.LIST && (
          <RecordingList 
            recordings={recordings} 
            apiKey={apiKey}
            selectedModel={selectedModel}
            selectedSttModel={selectedSttModel}
            updateRecording={updateRecording}
            deleteRecording={deleteRecording}
          />
        )}
        {activeTab === Tab.SETTINGS && (
          <Settings 
            apiKey={apiKey} 
            setApiKey={saveKey}
            selectedModel={selectedModel}
            setSelectedModel={saveModel}
            selectedSttModel={selectedSttModel}
            setSelectedSttModel={saveSttModel}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 w-full bg-surface/90 backdrop-blur-md border-t border-slate-700 h-20 pb-4 z-50">
        <div className="flex justify-around items-center h-full">
          <button
            onClick={() => setActiveTab(Tab.RECORD)}
            className={`flex flex-col items-center gap-1 w-16 ${activeTab === Tab.RECORD ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Mic className={`w-6 h-6 ${activeTab === Tab.RECORD ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">Запись</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.LIST)}
            className={`flex flex-col items-center gap-1 w-16 ${activeTab === Tab.LIST ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <List className="w-6 h-6" />
            <span className="text-[10px] font-medium">Лента</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.SETTINGS)}
            className={`flex flex-col items-center gap-1 w-16 ${activeTab === Tab.SETTINGS ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Настройки</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;