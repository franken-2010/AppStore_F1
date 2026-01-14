
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { label: 'Cuentas', icon: 'account_balance_wallet', path: '/finance-accounts' },
    { label: 'Reportes', icon: 'analytics', path: '/finance-stats' },
    { label: 'Inicio', icon: 'grid_view', path: '/dashboard', isCenter: true },
    { label: 'Cortes', icon: 'point_of_sale', path: '/cortes' },
    { label: 'Ajustes', icon: 'more_horiz', path: '/settings' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] bg-[#121212]/95 backdrop-blur-lg border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around h-18 max-w-md mx-auto px-2 py-3">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              item.isCenter ? 'relative -top-1' : ''
            } ${
              isActive(item.path) 
                ? 'text-primary' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className={`flex items-center justify-center transition-transform ${
              item.isCenter ? 'scale-125 bg-primary/10 rounded-2xl p-2 shadow-lg shadow-primary/10' : ''
            } ${isActive(item.path) && item.isCenter ? 'bg-primary text-white scale-125' : ''}`}>
              <span className={`material-symbols-outlined text-[26px] ${isActive(item.path) ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-tighter transition-opacity ${
              isActive(item.path) ? 'opacity-100' : 'opacity-60'
            }`}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
