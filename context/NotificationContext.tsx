
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    const pollUrl = localStorage.getItem('webhook_notifications');
    if (!pollUrl) return;

    try {
      const response = await fetch(pollUrl);
      if (response.ok) {
        const data = await response.json();
        // Asumimos que Make devuelve un array de notificaciones
        if (Array.isArray(data)) {
          setNotifications(prev => {
            // Combinar y evitar duplicados por ID
            const newIds = new Set(data.map(n => n.id));
            const existing = prev.filter(n => !newIds.has(n.id));
            return [...data, ...existing].sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  useEffect(() => {
    // Cargar iniciales de localStorage para persistencia offline
    const saved = localStorage.getItem('app_notifications_list');
    if (saved) setNotifications(JSON.parse(saved));

    // Polling cada 30 segundos si hay URL configurada
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    localStorage.setItem('app_notifications_list', JSON.stringify(notifications));
  }, [notifications]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
