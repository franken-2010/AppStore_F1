
import React, { useState } from 'react';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  className?: string;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onResult, className = "" }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={startListening}
      className={`p-2 rounded-full transition-all active:scale-90 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-primary'} ${className}`}
      title="Dictar por voz"
    >
      <span className="material-symbols-outlined text-[20px]">
        {isListening ? 'mic' : 'mic_none'}
      </span>
    </button>
  );
};

export default VoiceInputButton;
