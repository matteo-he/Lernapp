import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';
import { Card } from './Card';

const SYSTEM_INSTRUCTION = `
Du bist ein erfahrener Ausbildner und KI-Tutor für die österreichische Polizei (E1/E2a Auswahlprüfung und Grundausbildung).
Dein Ziel ist es, Anwärter bei der Vorbereitung auf die Prüfung zu unterstützen.

Deine Spezialgebiete basieren auf folgendem Lehrplan:
1. DIENSTRECHT (BDG, Gehaltsgesetz, RGV): Fokus auf Pflichten (§ 43, 44 BDG), Rechte, Ernennung.
2. SICHERHEITSPOLIZEI (SPG): Befugnisse, Aufgaben der Sicherheitsbehörden, Organe des öffentlichen Sicherheitsdienstes.
3. STRAFRECHT (StGB): Allgemeiner Teil (Vorsatz, Notwehr) und Besonderer Teil (Leib & Leben, Vermögen, Amtspflicht).
4. VERKEHRSRECHT (StVO, KFG, FSG): Fahrregeln, Bevorzugte Straßenbenützer, Alkohol, Zulassung, Führerschein.
5. VERFASSUNGSRECHT: Grundrechte (EMRK), Staatsorganisation.
6. FREMDENRECHT & WAFFENGESETZ.

Verhaltensregeln:
- Antworte präzise, juristisch korrekt, aber verständlich.
- Zitiere, wenn möglich, den entsprechenden Paragraphen (§).
- Wenn eine Frage unklar ist, frage nach dem Kontext (z.B. "Meinst du im Sinne des SPG oder StPO?").
- Sei motivierend, aber streng in der Sache (Polizeiarbeit erfordert Genauigkeit).
- Halte die Antworten kompakt, außer der User bittet um eine ausführliche Erklärung.

Du bist kein Rechtsanwalt, sondern ein Tutor für die Ausbildung.
`;

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: 'Servus! Ich bin dein KI-Tutor für die E1/E2a Ausbildung. Ich kenne mich bestens mit dem BDG, SPG, StGB und der StVO aus. Was möchtest du heute wiederholen?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: userText, timestamp: Date.now() };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Use explicit casting or fallback to ensure process.env access
      const apiKey = process.env.API_KEY || (window as any).process?.env?.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      
      // Construct history for context
      const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...history, { role: 'user', parts: [{ text: userText }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4, 
        }
      });

      const aiText = response.text || "Entschuldigung, ich konnte darauf keine Antwort generieren.";
      
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: aiText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Gemini Error:", error);
      const errorMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: '⚠️ Fehler bei der Verbindung. Bitte prüfe deinen API Schlüssel oder die Internetverbindung.', 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">KI-Tutor</h2>
        <p className="text-slate-500 dark:text-slate-400">Stelle Fragen zu BDG, SPG, StVO und mehr.</p>
      </div>

      <Card className="flex-1 flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm relative
                  ${isUser 
                    ? 'bg-gradient-to-br from-police-600 to-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm'}
                `}>
                  {!isUser && (
                    <div className="absolute -top-3 -left-2 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-lg shadow-sm">
                      👮
                    </div>
                  )}
                  <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap ${!isUser ? 'ml-2' : ''}`}>
                    {msg.text}
                  </div>
                  <div className={`text-[10px] mt-2 opacity-60 ${isUser ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="flex justify-start w-full">
               <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2 ml-2">
                 <div className="w-2 h-2 bg-police-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                 <div className="w-2 h-2 bg-police-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                 <div className="w-2 h-2 bg-police-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
               </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Frage stellen (z.B. 'Was sind die Pflichten nach § 43 BDG?')"
              className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-police-500 outline-none transition-all shadow-inner text-slate-800 dark:text-slate-100"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 bg-police-600 hover:bg-police-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </form>
          <div className="text-center mt-2">
             <span className="text-[10px] text-slate-400">Powered by Gemini 2.5 Flash. Antworten können Fehler enthalten. Überprüfe wichtige Fakten im Gesetz.</span>
          </div>
        </div>
      </Card>
    </div>
  );
};