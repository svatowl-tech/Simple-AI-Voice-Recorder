import { AIAnalysisResult, PolzaTranscribeResponse } from "../types";

const POLZA_BASE_URL = "https://api.polza.ai/api/v1";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // FileReader result includes "data:audio/wav;base64,..." which is what Polza expects
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const transcribeAudio = async (
  apiKey: string,
  blob: Blob,
  model: string
): Promise<PolzaTranscribeResponse> => {
  if (!apiKey) throw new Error("API Key is missing");

  const base64Audio = await blobToBase64(blob);

  const payload = {
    model: model, 
    file: base64Audio,
    language: "ru", // Defaulting to Russian as per request context, but can be auto
  };

  const response = await fetch(`${POLZA_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Polza STT Error: ${err}`);
  }

  return response.json();
};

export const analyzeText = async (
  apiKey: string,
  text: string,
  model: string
): Promise<AIAnalysisResult> => {
  if (!apiKey) throw new Error("API Key is missing");

  const endpoint = `${POLZA_BASE_URL}/chat/completions`; 

  const systemPrompt = `
    Ты - профессиональный бизнес-ассистент и аналитик. Твоя задача - проанализировать текст транскрипции аудиозаписи.
    
    Сделай следующее:
    1. Напиши краткое содержание (summary) - 3-5 предложений, передающих суть разговора.
    2. Извлеки список конкретных задач (tasks) - действия, которые нужно выполнить. Если задач нет, верни пустой массив.
    3. Выдели ключевые тезисы (keyPoints) - основные мысли и факты.

    ВАЖНО: Твой ответ должен быть ТОЛЬКО валидным JSON объектом. Не добавляй никаких пояснений, маркдауна (вроде \`\`\`json) или вступительных слов.
    
    Формат JSON:
    {
      "summary": "Текст резюме...",
      "tasks": ["Задача 1", "Задача 2"],
      "keyPoints": ["Тезис 1", "Тезис 2"]
    }
  `;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Текст для анализа:\n${text}` },
    ],
    temperature: 0.3, // Lower temperature for more deterministic/structured output
    // max_tokens: 2000,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Polza Chat Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  
  try {
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Cleanup potential markdown wrappers if the model ignores the "no markdown" instruction
    const cleanContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanContent);
    
    // Ensure structure matches expectation even if partial
    return {
      summary: parsed.summary || "Не удалось сгенерировать резюме.",
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
    };
  } catch (e) {
    console.error("Failed to parse AI response", e, data);
    throw new Error("AI вернул некорректный формат данных. Попробуйте другую модель.");
  }
};