const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, 'apps/web/src/pages/consumer/Profile.tsx');
let content = fs.readFileSync(profilePath, 'utf8');

// Advanced replacements using regex with word boundaries to avoid partial matches
content = content.replace(/\bbg-white\/70\b/g, 'bg-[var(--glass-bg)]');
content = content.replace(/\bbg-white\/50\b/g, 'bg-[var(--glass-bg)]');
content = content.replace(/\bbg-white\/40\b/g, 'bg-[var(--glass-bg)]');
content = content.replace(/\bborder-gray-200\b/g, 'border-[var(--glass-border)]');
content = content.replace(/\bborder-white\/50\b/g, 'border-[var(--glass-border)]');
content = content.replace(/\bhover:bg-white\b/g, 'hover:bg-[var(--surface-1)]');
content = content.replace(/from-blue-50 to-white border border-blue-100\/50/g, 'from-[var(--surface-2)] to-[var(--surface-1)] border border-[var(--glass-border)]');
content = content.replace(/from-purple-50 to-white border border-purple-100\/50/g, 'from-[var(--surface-2)] to-[var(--surface-1)] border border-[var(--glass-border)]');
content = content.replace(/\bbg-gray-50\b/g, 'bg-[var(--surface-2)]');
content = content.replace(/\bbg-gray-100\b/g, 'bg-[var(--surface-3)]');
content = content.replace(/\bbg-blue-50\b/g, 'bg-[var(--surface-2)]');
content = content.replace(/\bborder-blue-100\b/g, 'border-[var(--glass-border)]');
content = content.replace(/\bborder-blue-200\b/g, 'border-[var(--glass-border)]');
content = content.replace(/\bhover:border-blue-200\b/g, 'hover:border-[var(--brand-primary)]');
content = content.replace(/\bhover:border-blue-300\b/g, 'hover:border-[var(--brand-primary)]');
content = content.replace(/\bbg-red-50\b/g, 'bg-red-500/10');
content = content.replace(/\bborder-red-100\b/g, 'border-red-500/20');
content = content.replace(/\bborder-red-200\b/g, 'border-red-500/30');
content = content.replace(/\bbg-green-50\b/g, 'bg-green-500/10');
content = content.replace(/\bborder-green-200\b/g, 'border-green-500/30');
content = content.replace(/\bbg-white\b/g, 'bg-[var(--surface-1)]');
content = content.replace(/\bborder-white\b/g, 'border-[var(--glass-border)]');

fs.writeFileSync(profilePath, content);
console.log('Profile.tsx updated safely.');
