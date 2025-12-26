
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

  // Efecto para escuchar notificaciones internas de Firestore (Webhook de Sistema)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

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
        const external = prev.filter(n => !n.id.startsWith('sys_')); // Mantener externas que no choquen
        const combined = [...internalNotifs, ...external];
        return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
    });

    return () => unsubscribe();
  }, []);

  const fetchNotifications = useCallback(async () => {
    const pollUrl = localStorage.getItem('webhook_notifications');
    if (!pollUrl) return;

    try {
      const response = await fetch(pollUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setNotifications(prev => {
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

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notification,
      id: 'sys_' + Math.random().toString(36).substr(2, 9),
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
