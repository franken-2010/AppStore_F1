
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../context/NotificationContext';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotifClick = (n: AppNotification) => {
    markAsRead(n.id);
    setIsOpen(false);
    
    // Navegación inteligente basada en el tipo de notificación
    if (n.type === 'PRICE_UPDATE_REPORT' || n.refType === 'price_update_job') {
      navigate('/tools/price-update');
      // Podríamos pasar el refId si quisiéramos abrir el modal automáticamente, 
      // pero por ahora redirigimos a la pantalla.
    }
  };

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
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Notificaciones</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] text-primary font-black uppercase hover:underline"
                >
                  Limpiar todas
                </button>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotifClick(n)}
                    className={`p-4 border-b border-slate-50 dark:border-white/5 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex gap-3">
                      <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        n.type === 'PRICE_UPDATE_REPORT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-100/50 text-blue-600'
                      }`}>
                        <span className="material-symbols-outlined text-xl">
                          {n.type === 'PRICE_UPDATE_REPORT' ? 'sync_alt' : 'info'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                        <p className={`text-xs ${!n.isRead ? 'font-black' : 'font-bold'} text-slate-900 dark:text-white truncate`}>{n.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{n.message}</p>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase">
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
                <div className="p-12 text-center flex flex-col items-center gap-3">
                  <div className="size-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-700">notifications_none</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sin actividad reciente</p>
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
