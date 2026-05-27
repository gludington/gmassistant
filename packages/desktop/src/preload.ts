import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setFullScreen: (flag: boolean) => ipcRenderer.send('set-fullscreen', flag),
  openYouTubeLogin: () => ipcRenderer.send('open-youtube-login'),
  openSpotifyLogin: () => ipcRenderer.send('open-spotify-login'),
});
