
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { label: 'Trans.', icon: 'description', path: '/dashboard' },
    { label: 'Estad.', icon: 'bar_chart', path: '/finance-stats' },
    { label: 'Cuentas', icon: 'payments', path: '/finance-accounts' },
    { label: 'Más', icon: 'more_horiz', path: '/settings' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212] border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive(item.path) 
                ? 'text-[#f87171]' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`material-symbols-outlined text-[24px] ${isActive(item.path) ? 'fill-1' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
