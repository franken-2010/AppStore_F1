
import React, { useState, useRef, useEffect } from 'react';

interface VoiceInputButtonProps {
  onResult: (text: string, isFinal: boolean) => void;
  className?: string;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onResult, className = "" }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'es-MX';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      // Si se detiene pero nosotros queremos seguir (ej. por timeout del navegador), 
      // podríamos reiniciarlo aquí, pero por ahora respetamos el onend natural
      // a menos de que hayamos detenido nosotros.
      setIsListening(false);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) onResult(finalTranscript, true);
      if (interimTranscript) onResult(interimTranscript, false);
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-2 rounded-full transition-all active:scale-90 flex items-center gap-2 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'} ${className}`}
      title={isListening ? "Detener dictado" : "Dictar por voz"}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isListening ? 'mic_off' : 'mic'}
      </span>
      {isListening && <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Escuchando...</span>}
    </button>
  );
};

export default VoiceInputButton;
