import DefaultTheme from 'vitepress/theme';
import HandoffWalkthrough from './HandoffWalkthrough.vue';
import UnderstandingCheck from './UnderstandingCheck.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HandoffWalkthrough', HandoffWalkthrough);
    app.component('UnderstandingCheck', UnderstandingCheck);
  },
};
