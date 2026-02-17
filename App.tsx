import React, { useState, useEffect } from 'react';
import { Mic, List, Settings as SettingsIcon, AudioWaveform } from 'lucide-react';
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

  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex md:flex-row flex-col items-center md:gap-3 gap-1 md:px-4 md:py-3 w-full md:rounded-xl transition-all
        ${activeTab === tab 
          ? 'md:bg-primary/10 text-primary' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        }`}
    >
      <Icon className={`w-6 h-6 ${activeTab === tab ? 'fill-current md:fill-none' : ''}`} />
      <span className="text-[10px] md:text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="w-full h-screen bg-dark text-white flex overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0">
        <div className="p-6 flex items-center gap-2 text-primary font-bold text-xl">
           <AudioWaveform className="w-8 h-8" />
           <span>Polza Voice</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <NavItem tab={Tab.RECORD} icon={Mic} label="Запись" />
          <NavItem tab={Tab.LIST} icon={List} label="Мои записи" />
          <NavItem tab={Tab.SETTINGS} icon={SettingsIcon} label="Настройки" />
        </nav>

        <div className="p-4 text-xs text-slate-500 text-center">
          v1.0.0 &copy; 2024
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-dark to-slate-900">
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden absolute bottom-0 left-0 w-full bg-surface/90 backdrop-blur-md border-t border-slate-700 h-20 pb-4 z-50">
        <div className="flex justify-around items-center h-full">
           <NavItem tab={Tab.RECORD} icon={Mic} label="Запись" />
           <NavItem tab={Tab.LIST} icon={List} label="Лента" />
           <NavItem tab={Tab.SETTINGS} icon={SettingsIcon} label="Настройки" />
        </div>
      </nav>
    </div>
  );
};

export default App;