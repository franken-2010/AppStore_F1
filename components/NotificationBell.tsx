
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    notifications.forEach(n => {
      const day = n.timestamp.split('T')[0];
      const key = `${n.type}-${n.title}-${day}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });

    return Object.entries(groups).map(([key, items]) => {
      if (items.length > 1) {
        return {
          id: key,
          items,
          isGroup: true as const,
          title: items[0].title,
          type: items[0].type,
          timestamp: items[0].timestamp,
          isRead: items.every(i => i.isRead)
        };
      }
      return items[0];
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Bloquear scroll del cuerpo cuando el panel está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleNotifClick = (n: AppNotification) => {
    markAsRead(n.id);
    if (n.type === 'PRICE_UPDATE_REPORT' || n.refType === 'price_update_job') {
      setIsOpen(false);
      navigate('/tools/price-update');
    }
  };

  const formatNotifTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    }).toUpperCase();
  };

  return (
    <>
      {/* Botón de la Campana */}
      <div className="relative">
        <button 
          onClick={() => setIsOpen(true)}
          className="relative p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors active:scale-95"
          aria-label="Abrir notificaciones"
        >
          <span className="material-symbols-outlined text-slate-700 dark:text-white text-[26px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-4.5 bg-red-500 rounded-full border-2 border-background-light dark:border-background-dark text-[10px] text-white flex items-center justify-center font-black shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Drawer / Panel de Notificaciones (Portal-like) */}
      {isOpen && (
        <div className="fixed inset-0 z-[5000] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Contenedor del Panel - OPACO TOTAL */}
          <div className="relative w-full max-w-[340px] h-full bg-[#0a0f1d] shadow-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Cabecera */}
            <header className="pt-14 px-6 pb-6 border-b border-white/5 bg-[#161d2b]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-[12px] uppercase tracking-[0.25em] text-primary">Notificaciones</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {unreadCount} pendientes
                </p>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => markAllAsRead()}
                    className="text-[11px] text-primary font-black uppercase tracking-wider hover:opacity-80 transition-opacity"
                  >
                    Limpiar todas
                  </button>
                )}
              </div>
            </header>
            
            {/* Lista de Notificaciones - Fondo Sólido */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-[#0a0f1d] relative">
              {groupedNotifications.length > 0 ? (
                <div className="divide-y divide-white/5 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {groupedNotifications.map((n) => {
                      const isGroup = 'isGroup' in n;
                      const groupKey = isGroup ? (n as any).id : n.id;
                      const isExpanded = expandedGroups.has(groupKey);

                      if (isGroup) {
                        const group = n as any;
                        const firstItem = group.items[0];

                        return (
                          <div key={group.id} className="relative bg-[#0a0f1d]">
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, x: -100 }}
                              drag="x"
                              dragConstraints={{ left: -100, right: 0 }}
                              onDragEnd={(_, info) => {
                                if (info.offset.x < -60) {
                                  group.items.forEach((item: any) => deleteNotification(item.id));
                                }
                              }}
                              className="relative"
                            >
                              <div className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 z-0">
                                <span className="material-symbols-outlined text-white">delete_sweep</span>
                              </div>

                              <div 
                                onClick={() => toggleGroup(group.id)}
                                className={`p-6 flex items-center gap-4 transition-all cursor-pointer relative z-10 group ${!group.isRead ? 'bg-[#121928]' : 'bg-[#0a0f1d] hover:bg-white/5'}`}
                              >
                                <div className="flex-1 overflow-hidden">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-primary text-sm">filter_none</span>
                                    <p className={`text-[13px] font-black leading-tight uppercase transition-colors ${!group.isRead ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                      {group.title}
                                    </p>
                                    <span className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-full">
                                      {group.items.length}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed truncate">
                                    {group.items.length} notificaciones similares hoy
                                  </p>
                                </div>
                                <span className={`material-symbols-outlined text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                  expand_more
                                </span>
                              </div>
                            </motion.div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden bg-black/20"
                                >
                                  {group.items.map((item: any) => (
                                    <div key={item.id} className="relative pl-6 border-l-2 border-primary/20 ml-6 my-2">
                                      <div 
                                        onClick={() => handleNotifClick(item)}
                                        className="py-3 pr-6 text-left hover:bg-white/5 transition-colors rounded-r-xl"
                                      >
                                        <p className="text-[11px] text-slate-300 font-medium">
                                          {item.message}
                                        </p>
                                        <p className="text-[9px] font-black text-slate-500 mt-1 uppercase">
                                          {formatNotifTime(item.timestamp)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      }

                      // Render normal notification
                      const single = n as AppNotification;
                      return (
                        <motion.div
                          key={single.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                          drag="x"
                          dragConstraints={{ left: -100, right: 0 }}
                          dragElastic={{ left: 0.1, right: 0 }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -60) {
                              deleteNotification(single.id);
                            }
                          }}
                          className="relative"
                        >
                          {/* Background for Delete Action */}
                          <div className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 z-0">
                            <span className="material-symbols-outlined text-white">delete</span>
                          </div>

                          <div 
                            onClick={() => handleNotifClick(single)}
                            className={`p-6 transition-all cursor-pointer relative z-10 group ${!single.isRead ? 'bg-[#121928]' : 'bg-[#0a0f1d] hover:bg-white/5'}`}
                          >
                            <div className="flex gap-4">
                              <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
                                <p className={`text-[13px] font-black leading-tight uppercase transition-colors ${!single.isRead ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                  {single.title}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                  {single.message}
                                </p>
                                <p className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-widest">
                                  {formatNotifTime(single.timestamp)}
                                </p>
                              </div>
                              
                              {!single.isRead && (
                                <div className="flex items-center justify-center shrink-0">
                                  <div className="size-2.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="size-20 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-slate-600">notifications_none</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-black uppercase tracking-[0.2em]">Sin actividad reciente</p>
                </div>
              )}
            </div>

            {/* Footer - Fondo Sólido */}
            <footer className="p-6 bg-[#0a0f1d] border-t border-white/5">
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-4 bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-white/10 active:scale-95 transition-all shadow-lg"
              >
                Cerrar Panel
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
