
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GeminiService } from '../services/geminiService';
import VoiceInputButton from '../components/VoiceInputButton';
import BottomNav from '../components/BottomNav';
import { ChatMessage, ChatAttachment } from '../types';

const ChatScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `¡Hola ${profile?.displayName?.split(' ')[0] || 'Administrador'}! Soy F1-AI. Puedo ver fotos de tus productos o consultar el inventario de Firebase. ¿Qué necesitas?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, pendingAttachments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fix: Explicitly cast FileList to File array to ensure correct typing of elements
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const attachment: ChatAttachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: base64,
          name: file.name,
          mimeType: file.type
        };
        setPendingAttachments(prev => [...prev, attachment]);
      };
      // Fix: file is now correctly typed as File, which is a subclass of Blob
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() && pendingAttachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
      attachments: [...pendingAttachments]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setPendingAttachments([]);
    setIsTyping(true);

    try {
      const aiResponseText = await GeminiService.chatWithContext(
        [...messages, userMessage],
        profile?.displayName || 'Admin'
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased pb-[180px]">
      <header className="sticky top-0 z-30 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-xl pt-12 px-6 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-lg relative">
              <span className="material-symbols-outlined text-2xl">smart_toy</span>
              <div className="absolute -bottom-0.5 -right-0.5 size-3 bg-emerald-500 rounded-full border-2 border-white dark:border-background-dark"></div>
            </div>
            <div>
              <h1 className="text-sm font-black leading-none text-slate-900 dark:text-white">F1 Assistant</h1>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">IA Multimodal + BDD</p>
            </div>
          </div>
        </div>
      </header>

      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div 
              className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-white dark:bg-surface-dark text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-white/5'
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((att, i) => (
                    att.type === 'image' ? (
                      <img key={i} src={att.url} alt="adjunto" className="w-full max-h-48 object-cover rounded-2xl border border-white/20" />
                    ) : (
                      <div key={i} className="flex items-center gap-2 bg-black/10 p-2 rounded-xl text-[10px] font-bold">
                        <span className="material-symbols-outlined text-sm">description</span>
                        <span className="truncate max-w-[100px]">{att.name}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
              {msg.text}
            </div>
            <span className="text-[9px] font-bold text-slate-400 mt-2 px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-2 animate-pulse">
            <div className="bg-white dark:bg-surface-dark p-4 rounded-3xl rounded-tl-none border border-slate-100 dark:border-white/5">
              <div className="flex gap-1 items-center">
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest">IA Procesando...</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Input Area con Previsualización */}
      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/80 dark:via-background-dark/80 to-transparent pt-4 pb-2">
        {pendingAttachments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
            {pendingAttachments.map((att, i) => (
              <div key={i} className="relative shrink-0">
                {att.type === 'image' ? (
                  <img src={att.url} className="size-16 object-cover rounded-xl border-2 border-primary" alt="preview" />
                ) : (
                  <div className="size-16 bg-white dark:bg-surface-dark rounded-xl border-2 border-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">description</span>
                  </div>
                )}
                <button 
                  onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 size-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/10 p-2 shadow-2xl flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf,.txt,.csv" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="size-10 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined">add_circle</span>
          </button>
          
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Pregunta precios o adjunta fotos..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium py-2 px-1 dark:text-white"
          />
          
          <div className="flex items-center gap-1">
            <VoiceInputButton onResult={(t) => handleSendMessage(t)} className="text-slate-400" />
            <button 
              onClick={() => handleSendMessage()}
              disabled={!input.trim() && pendingAttachments.length === 0}
              className="size-10 bg-primary text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ChatScreen;
