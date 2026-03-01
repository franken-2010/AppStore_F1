
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean; 
  type: 'price_update' | 'system' | 'alert' | 'PRICE_UPDATE_REPORT';
  refId?: string;
  refType?: string;
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
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    try {
      const q = query(
        collection(db, "users", user.uid, "notifications"),
        orderBy("timestamp", "desc"),
        limit(30)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const internalNotifs = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Sanitización: Extraer solo campos serializables para evitar estructuras circulares
          // como DocumentReferences que pueden venir en el spread.
          return {
            id: doc.id,
            title: String(data.title || ''),
            message: String(data.message || ''),
            // Manejar Timestamp de Firebase o string ISO
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : String(data.timestamp || new Date().toISOString()),
            type: data.type || 'system',
            refId: data.refId || null,
            refType: data.refType || null,
            isRead: data.read === true
          };
        }) as AppNotification[];
        
        setNotifications(internalNotifs);
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Error en Firestore notifications:", error);
        }
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to setup notification listener:", e);
    }
  }, [user?.uid]);

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

  const markAsRead = async (id: string) => {
    if (!user || id.startsWith('local_')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      return;
    }
    
    try {
      const docRef = doc(db, "users", user.uid, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (e) {
      console.error("Error marking as read:", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "users", user.uid, "notifications"),
        where("read", "==", false)
      );
      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { read: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error marking all as read:", e);
    }
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
