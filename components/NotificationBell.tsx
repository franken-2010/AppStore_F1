
import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors active:scale-95"
      >
        <span className="material-symbols-outlined text-slate-700 dark:text-white text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 size-4 bg-red-500 rounded-full border-2 border-white dark:border-background-dark text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Notificaciones</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Leer todas
                </button>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => markAsRead(n.id)}
                    className={`p-4 border-b border-slate-50 dark:border-white/5 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                        n.type === 'price_update' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <span className="material-symbols-outlined text-lg">
                          {n.type === 'price_update' ? 'sell' : 'info'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-sm ${!n.isRead ? 'font-bold' : 'font-medium'} text-slate-900 dark:text-white`}>{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="size-2 bg-primary rounded-full shrink-0 self-center"></div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">notifications_off</span>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No hay notificaciones</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
