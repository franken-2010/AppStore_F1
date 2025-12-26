
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'price_update' | 'system' | 'alert';
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { user } = useAuth(); // Obtenemos el usuario del AuthContext

  // 1. Escuchar notificaciones persistentes de Firestore
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    console.log("🔔 Iniciando listener de Firestore para:", user.uid);
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const internalNotifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      
      setNotifications(prev => {
        // Mantener las notificaciones 'live' y 'local' que no estén en firestore
        const existingLiveAndLocal = prev.filter(n => n.id.startsWith('live_') || n.id.startsWith('local_'));
        const internalIds = new Set(internalNotifs.map(n => n.id));
        const uniqueLive = existingLiveAndLocal.filter(n => !internalIds.has(n.id));

        const combined = [...internalNotifs, ...uniqueLive];
        return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
    }, (error) => {
      console.error("Error en Firestore notifications:", error);
    });

    return () => unsubscribe();
  }, [user]); // Se activa cuando el usuario cambia o inicia sesión

  // 2. Escuchar notificaciones EN VIVO vía ntfy.sh
  useEffect(() => {
    if (!user) return;

    const topic = `dataflow_admin_${user.uid}`;
    console.log("⚡ Conectando a stream de notificaciones Live:", topic);
    
    const eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);

    eventSource.onopen = () => {
      console.log("✅ Conexión establecida con ntfy.sh");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'message') {
          console.log("📩 Mensaje recibido de ntfy:", data);
          let payload: any = {};
          
          // Parsing inteligente del campo message (Make suele enviarlo como string JSON)
          if (typeof data.message === 'string') {
            const trimmed = data.message.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                payload = JSON.parse(trimmed);
              } catch (e) {
                payload = { message: data.message };
              }
            } else {
              payload = { message: data.message };
            }
          }

          const newNotif: AppNotification = {
            id: 'live_' + (data.id || Math.random().toString(36).substr(2, 9)),
            title: payload.title || data.title || 'Alerta de Sistema',
            message: payload.message || 'Nueva actualización recibida.',
            type: payload.type || 'system',
            timestamp: payload.timestamp || new Date().toISOString(),
            isRead: false
          };

          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev];
            return updated.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      } catch (err) {
        console.error("❌ Error procesando notificación live:", err);
      }
    };

    eventSource.onerror = (e) => {
      console.warn("⚠️ Error en conexión SSE, ntfy intentará reconectar automáticamente.");
    };

    return () => {
      console.log("🔌 Cerrando conexión Live");
      eventSource.close();
    };
  }, [user]); // Se activa cuando el usuario cambia o inicia sesión

  const fetchNotifications = useCallback(async () => {}, []);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notification,
      id: 'local_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      isRead: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
