export function isElectron(): boolean {
  return !!(window as { electronAPI?: unknown }).electronAPI;
}
