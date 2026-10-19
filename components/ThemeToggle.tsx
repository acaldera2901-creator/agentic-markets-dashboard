'use client';
import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme, subscribeTheme } from '@/lib/theme';
const serverTheme = () => 'dark' as const;
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, serverTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Light' : 'Dark';
  return <button type="button" className="br-theme-toggle" aria-label={label} title={label} onClick={() => setTheme(next)}>
    {next === 'light' ? <Sun size={17} aria-hidden="true"/> : <Moon size={17} aria-hidden="true"/>}
    <span>{label}</span>
  </button>;
}
