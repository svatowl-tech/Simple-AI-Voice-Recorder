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

// Helper function to split text into chunks based on character limit (preserving sentences)
const splitTextIntoChunks = (text: string, maxChunkSize: number = 8000): string[] => {
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let currentChunk = "";

  // Split by paragraphs first, then sentences if needed
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    // If a single paragraph is huge, we might need to split it by sentences
    if ((currentChunk.length + paragraph.length) > maxChunkSize) {
       if (currentChunk.length > 0) {
         chunks.push(currentChunk);
         currentChunk = "";
       }
       
       if (paragraph.length > maxChunkSize) {
          // Hard split for extremely long paragraphs
          const sentences = paragraph.match(/[^.!?]+[.!?]+[\])'"]*/g) || [paragraph];
          for (const sentence of sentences) {
             if ((currentChunk.length + sentence.length) > maxChunkSize) {
                chunks.push(currentChunk);
                currentChunk = "";
             }
             currentChunk += sentence + " ";
          }
       } else {
         currentChunk = paragraph + "\n";
       }
    } else {
      currentChunk += paragraph + "\n";
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
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
    language: "ru", 
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
    temperature: 0.3, 
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
    
    const cleanContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanContent);
    
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

export const improveTextWithPolza = async (
  apiKey: string,
  text: string,
  model: string
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  const endpoint = `${POLZA_BASE_URL}/chat/completions`;
  const chunks = splitTextIntoChunks(text, 6000); // 6000 chars ~ 1500 tokens is safe for prompt + output
  let improvedFullText = "";

  const systemPrompt = `
    Ты - профессиональный литературный редактор. Твоя задача - превратить сырую транскрипцию речи (Speech-to-Text) в качественный, читаемый текст.
    
    Инструкции:
    1. Исправь грамматические и пунктуационные ошибки.
    2. Устрани обрывочные фразы, "эканья", слова-паразиты и повторы.
    3. Восстанови смысл плохо распознанных фрагментов, исходя из контекста.
    4. Удали случайные комментарии и шумы, которые явно не относятся к основной теме разговора.
    5. Структурируй текст: разбей на абзацы, сделай его связным и логичным.
    6. Не сокращай текст без необходимости, сохрани все важные детали и факты, но изложи их литературным языком.
    
    Отвечай ТОЛЬКО улучшенным текстом. Не добавляй вступлений вроде "Вот исправленный текст:".
  `;

  for (const chunk of chunks) {
    const payload = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Отредактируй этот фрагмент текста:\n${chunk}` },
      ],
      temperature: 0.4, 
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
      throw new Error(`Error improving text: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const resultChunk = data.choices?.[0]?.message?.content || "";
    
    improvedFullText += resultChunk + "\n\n";
  }

  return improvedFullText.trim();
};