import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Relay',
  description: 'Let me walk you through how two agents work together.',
  lang: 'en-US',
  appearance: false,
  lastUpdated: false,
  head: [['meta', { name: 'theme-color', content: '#174b40' }]],
  themeConfig: {
    siteTitle: 'Relay / The walkthrough',
    nav: [
      { text: 'Understand it', link: '/' },
      { text: 'Try & review', link: '/review' },
      { text: 'Open the demo ↗', link: 'http://127.0.0.1:8780' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Let me explain the demo', link: '/' },
          { text: 'Your guided review', link: '/review' },
        ],
      },
      {
        text: 'Look closer',
        items: [
          { text: 'Architecture & source map', link: '/ARCHITECTURE' },
          { text: 'Classroom presentation', link: '/PRESENTATION' },
          { text: 'What has been tested', link: '/VALIDATION' },
        ],
      },
    ],
    outline: { level: [2, 2], label: 'In this walkthrough' },
    search: { provider: 'local' },
    footer: { message: 'Team 3 · AI Operations · Fictional workshop, real local A2A transport' },
  },
});
