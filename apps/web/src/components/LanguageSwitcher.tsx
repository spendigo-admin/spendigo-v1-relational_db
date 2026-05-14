import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  const toggle = () => i18n.changeLanguage(isFr ? 'en' : 'fr');

  return (
    <button
      onClick={toggle}
      aria-label={isFr ? 'Switch to English' : 'Passer au français'}
      className="relative flex items-center w-[72px] h-8 rounded-full bg-gray-100 border border-gray-200 p-0.5 transition-colors duration-300 cursor-pointer hover:border-[var(--brand-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
    >
      {/* Track labels */}
      <span className={`absolute left-2 text-[11px] font-black transition-opacity duration-200 ${isFr ? 'opacity-40' : 'opacity-0'}`}>🇨🇦</span>
      <span className={`absolute right-2 text-[11px] font-black transition-opacity duration-200 ${!isFr ? 'opacity-40' : 'opacity-0'}`}>🇨🇦</span>

      {/* Sliding thumb */}
      <span
        className={`relative z-10 flex items-center justify-center w-[30px] h-[26px] rounded-full bg-white shadow-sm border border-gray-200 text-[13px] transition-transform duration-300 ease-in-out ${isFr ? 'translate-x-[36px]' : 'translate-x-0'}`}
      >
        {isFr ? '🇫🇷' : '🇬🇧'}
      </span>
    </button>
  );
};
