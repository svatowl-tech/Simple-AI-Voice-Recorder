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
    <div className="flex flex-col h-full overflow-y-auto pb-24 md:pb-6 p-6 md:p-10 items-center">
      <div className="w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-8 text-white flex items-center gap-3">
          <Key className="w-8 h-8 text-primary" />
          Настройки
        </h2>

        <div className="bg-surface rounded-2xl p-8 shadow-xl border border-slate-700 space-y-8">
          {/* API Key Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Polza API Key
            </label>
            <input
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-slate-900 text-white rounded-xl px-4 py-3.5 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* STT Model Selection Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Mic className="w-4 h-4" />
                Модель распознавания (STT)
              </label>
              <div className="relative">
                <select
                  value={selectedSttModel}
                  onChange={(e) => setSelectedSttModel(e.target.value)}
                  className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
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
                Влияет на точность и стоимость распознавания.
              </p>
            </div>

            {/* LLM Model Selection Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Bot className="w-4 h-4" />
                Модель анализа (LLM)
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 border border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
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
                Для генерации резюме и задач.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-primary hover:bg-indigo-600 text-white hover:shadow-primary/30'
            }`}
          >
            {saved ? 'Настройки сохранены' : 'Сохранить изменения'}
          </button>

          <div className="flex items-start gap-4 bg-slate-900/50 p-5 rounded-xl border border-slate-800">
            <ShieldCheck className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-200">Безопасность данных</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ваш ключ хранится локально на устройстве (LocalStorage). Мы не передаем его на сторонние серверы, кроме прямых запросов к API Polza. Аудиозаписи хранятся в браузере (IndexedDB).
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <a 
            href="https://docs.polza.ai/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span className="font-medium">Документация API</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Settings;