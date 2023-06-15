import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh', // 默认语言
  messages: {
    en: {
      welcome: 'Welcome',
      // ...其他英文翻译
    },
    zh: {
      welcome: '欢迎',
      // ...其他中文翻译
    },
    // ...其他语言
  },
})