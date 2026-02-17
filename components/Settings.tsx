import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, ExternalLink, Bot, Mic } from 'lucide-react';
import { POLZA_MODELS, POLZA_STT_MODELS } from '../types';

interface SettingsProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedSttModel: string;
  setSelectedSttModel: (model: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  apiKey, 
  setApiKey, 
  selectedModel, 
  setSelectedModel,
  selectedSttModel,
  setSelectedSttModel
}) => {
  const [inputVal, setInputVal] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInputVal(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    setApiKey(inputVal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 flex flex-col h-full overflow-y-auto pb-24">
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        <Key className="w-6 h-6 text-primary" />
        Настройки
      </h2>

      <div className="bg-surface rounded-xl p-6 shadow-lg border border-slate-700 space-y-6">
        {/* API Key Section */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Polza API Key
          </label>
          <input
            type="password"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>

        {/* STT Model Selection Section */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Модель распознавания речи (STT)
          </label>
          <div className="relative">
            <select
              value={selectedSttModel}
              onChange={(e) => setSelectedSttModel(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none"
            >
              {POLZA_STT_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Влияет на точность и стоимость распознавания. По умолчанию GPT-4o Mini.
          </p>
        </div>

        {/* LLM Model Selection Section */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Модель AI для анализа (LLM)
          </label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none"
            >
              {POLZA_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Выберите модель, которая будет использоваться для создания резюме и выделения задач.
          </p>
        </div>
        
        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            saved 
              ? 'bg-green-600 text-white' 
              : 'bg-primary hover:bg-indigo-600 text-white'
          }`}
        >
          {saved ? 'Сохранено' : 'Сохранить ключ'}
        </button>

        <div className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            Ваш ключ хранится локально на устройстве в зашифрованном виде (LocalStorage). Мы не передаем его на сторонние серверы, кроме прямых запросов к API Polza.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-3">О Polza AI</h3>
        <a 
          href="https://docs.polza.ai/docs" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-surface p-4 rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors group"
        >
          <span className="text-slate-300">Документация API</span>
          <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white" />
        </a>
      </div>
    </div>
  );
};

export default Settings;