import { createApp } from 'vue'
import "./style.css"
import App from './App.vue'
import './samples/node-api'
import { create, NButton, NInput, NSpace, NSelect, NSpin, NProgress } from 'naive-ui'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

const i18n = createI18n({
  legacy: false, 
  locale: 'zh', // 默认语言
  messages: {
    en, // 英语
    zh, // 中文
  },
})

const app = createApp(App)

const naive = create({
  components: [NButton, NInput, NSpace, NSelect, NSpin, NProgress]
})

app.use(naive)
app.use(i18n)
app.mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })

