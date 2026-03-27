import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  return (
    <div className="flex items-center">
      <select
        value={currentLang}
        onChange={handleLanguageChange}
        className="px-2 py-1.5 bg-transparent hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--glass-border)] rounded-lg text-sm font-medium text-[var(--text-main)] outline-none cursor-pointer transition-all focus:ring-2 focus:ring-[var(--brand-primary)]/20 appearance-none pr-6 relative"
        aria-label="Select language"
        style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.25rem center', backgroundSize: '0.8em', MozAppearance: 'none', WebkitAppearance: 'none' }}
      >
        <option value="en" className="text-gray-900 bg-white">🇨🇦 English (CA)</option>
        <option value="fr" className="text-gray-900 bg-white">🇨🇦 Français (CA)</option>
      </select>
    </div>
  );
};
