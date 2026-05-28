import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'GM Assistant',
  description: 'Session management for tabletop GMs — encounter tracking, ambient audio, and a player-facing display.',
  base: '/gmassistant/',

  head: [
    ['link', { rel: 'icon', href: '/gmassistant/favicon.ico' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Help', link: '/help' },
      { text: 'About', link: '/about' },
      {
        text: 'Download',
        link: 'https://github.com/gludington/gmassistant/releases',
      },
    ],

    sidebar: {
      '/help': [
        {
          text: 'Help',
          items: [
            { text: 'Home Screen', link: '/help#home-screen' },
            { text: 'Adventure Manager', link: '/help#adventure-manager' },
            { text: 'Encounter Tracker', link: '/help#encounter-tracker' },
            { text: 'Playlists & Audio', link: '/help#playlists-audio' },
            { text: 'Player Screen', link: '/help#player-screen' },
            { text: 'Desktop App', link: '/help#desktop-app' },
            { text: 'Import & Export', link: '/help#import-export' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gludington/gmassistant' },
    ],

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
