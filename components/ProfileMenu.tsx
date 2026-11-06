import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from "firebase/auth";

export function sanitizeAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1_500_000) return null;

  if (trimmed.startsWith('data:image/')) {
    const allowedDataPrefix = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)(;base64,|;utf8,|,utf8,)/i;
    if (!allowedDataPrefix.test(trimmed)) return null;
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('<script') ||
      lower.includes('javascript:') ||
      lower.includes('<foreignobject') ||
      /\bon[a-z]+\s*=/i.test(trimmed)
    ) {
      return null;
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const safeAvatar = !imgError ? sanitizeAvatarUrl(profile?.photoURL) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-slate-200 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-transform"
      >
        {safeAvatar ? (
          <img
            src={safeAvatar}
            alt="Perfil"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="material-symbols-outlined text-primary text-xl">person</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-white/5">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => { navigate('/settings'); setIsOpen(false); }}
                className="flex items-center gap-3 w-full p-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Configuración
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileMenu;
