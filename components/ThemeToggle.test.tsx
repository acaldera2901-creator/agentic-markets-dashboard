import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { THEME_BOOTSTRAP } from '@/lib/theme';

beforeEach(() => { localStorage.clear(); document.documentElement.dataset.theme = 'dark'; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('theme preference', () => {
 it('switches and persists, keeping multiple headers in sync', () => {
  render(<><ThemeToggle/><ThemeToggle/></>);
  fireEvent.click(screen.getAllByRole('button', {name:'Light'})[0]);
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('betredge-theme')).toBe('light');
  expect(screen.getAllByRole('button', {name:'Dark'})).toHaveLength(2);
 });
 it('restores the preference before rendering and can switch back', () => {
  localStorage.setItem('betredge-theme','light');
  window.eval(THEME_BOOTSTRAP);
  render(<ThemeToggle/>);
  fireEvent.click(screen.getByRole('button', {name:'Dark'}));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('betredge-theme')).toBe('dark');
 });
 it('uses dark for first visits or invalid values, ignoring retired preferences', () => {
  localStorage.setItem('agentic-theme','light');
  localStorage.setItem('betredge-theme','invalid');
  window.eval(THEME_BOOTSTRAP);
  expect(document.documentElement.dataset.theme).toBe('dark');
 });
 it('still switches when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<ThemeToggle/>);
  fireEvent.click(screen.getByRole('button', {name:'Light'}));
  expect(document.documentElement.dataset.theme).toBe('light');
 });
 it('follows preference updates from another tab', () => {
  render(<ThemeToggle/>);
  act(() => window.dispatchEvent(new StorageEvent('storage',{key:'betredge-theme',newValue:'light'})));
  expect(screen.getByRole('button', {name:'Dark'})).toBeTruthy();
 });
});
