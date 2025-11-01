import React from 'react';
import { useI18n } from '../i18n';

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const choose = (code) => {
    setLang(code);
    setOpen(false);
  };

  const alignClass = lang === 'ar' ? 'left-0' : 'right-0';
  const textAlign = lang === 'ar' ? 'text-right' : 'text-left';

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={lang === 'ar' ? 'AR' : 'RO'}
        className="text-gold active:opacity-70"
      >
        <i className="fas fa-language text-2xl"></i>
      </button>
      {open && (
        <div className={`absolute ${alignClass} top-full mt-2 min-w-[10rem] rounded-lg border border-gold/30 bg-marble-black/95 backdrop-blur p-1 z-50 shadow-lg`}>
          <button
            onClick={() => choose('ar')}
            className={`w-full ${textAlign} px-3 py-2 rounded-md hover:bg-gold/10 ${lang === 'ar' ? 'text-gold' : 'text-off-white'}`}
          >
            AR — العربية {lang === 'ar' ? '✓' : ''}
          </button>
          <button
            onClick={() => choose('ro')}
            className={`w-full ${textAlign} px-3 py-2 rounded-md hover:bg-gold/10 ${lang === 'ro' ? 'text-gold' : 'text-off-white'}`}
          >
            RO — Română {lang === 'ro' ? '✓' : ''}
          </button>
          <button
            onClick={() => choose('en')}
            className={`w-full ${textAlign} px-3 py-2 rounded-md hover:bg-gold/10 ${lang === 'en' ? 'text-gold' : 'text-off-white'}`}
          >
            EN — English {lang === 'en' ? '✓' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
