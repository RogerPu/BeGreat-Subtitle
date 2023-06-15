<template>
  <div id="app">
    <div class="block">
      <n-button style="margin-bottom: 40px;" @click="switchLanguage">{{ currentLanguage === 'zh' ? 'Switch to English' : '切换为中文' }}</n-button>
      <n-button style="margin-bottom: 5px;" type="info" @click="downloadFile">{{ $t('download_tips') }}</n-button>
      <n-progress type="line" :percentage="progress" :indicator-placement="'inside'" processing />
      <p v-if="isDownloaded">{{ $t('dl_success_tips') }}</p>
      <p v-if="isDownloaded">{{ $t('md5_tips') }} {{ checksum }}</p>
      <p v-if="isDownloaded">{{ $t('md5_correct') }} </p>
      <p style="text-align: center; margin-bottom: 0px; font-size: 24px; font-family: 'Microsoft YaHei';">{{ $t('sw_title') }}</p>
      <img src="/BeGreat-Subtitle.jpg" alt="Your Image"
        style="width: 150px; height: auto; margin-top: 10px; margin-bottom: 100px;" />
      <n-button @click="handleButtonClick">{{ $t('choose_file') }}</n-button>
      <p>{{ $t('choosed_file') }} {{ selectedFile }}</p>
      <n-space class="space-component">
        <n-select v-model:value="lan_value" :options="lan_options" :placeholder="$t('output_file')" class="select-1" />
      </n-space>
      <n-space class="space-component">
        <n-button @click="CreateSubtitle">{{ $t('start_gen_sub') }}</n-button>
        <n-button @click="openFile">{{ $t('open_store_dir') }}</n-button>
        <n-button @click="showModal = true">{{ $t('donate') }}</n-button>
      </n-space>
      <div v-if="showModal" class="modal">
        <div class="modal-content">
          <span @click="showModal = false" class="close">&times;</span>
          <img :src="imageUrl" alt="Donation Image" style="width: 400px;" />
        </div>
      </div>
    </div>
    <div class="block">
      <n-space vertical>
        <n-spin :show="handler_status" description="处理中(15分钟视频macOS预计15分钟，Windows预计30分钟，请耐心等待)">
          <n-card title="处理结果" style="width: 100%; white-space: pre-line; text-align: left; overflow: auto;">
            {{ trans_result }}
          </n-card>
        </n-spin>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
// 导入必要的依赖项
import { ref, onMounted, onUnmounted } from 'vue';
import { ipcRenderer } from 'electron';
import os from 'os';
import path from 'path';
import { useI18n } from 'vue-i18n';

// 多语言设置函数
const setupLanguage = () => {
    const i18n = useI18n();
    const currentLanguage = ref('zh'); // 默认语言为中文

    const switchLanguage = () => {
        const newLanguage = currentLanguage.value === 'zh' ? 'en' : 'zh';
        i18n.locale.value = newLanguage; // 更新语言环境
        currentLanguage.value = newLanguage;
    };

    return {
        currentLanguage,
        switchLanguage,
    };
}

const { currentLanguage, switchLanguage } = setupLanguage();
const i18n = useI18n();


// 规范化脚本代码

// 模型检查下载
const progress = ref('0');
const isDownloaded = ref(false);
const checksum = ref('');

const downloadFile = async () => {
  // 下载文件逻辑
  const url = 'https://objectstorage.ap-osaka-1.oraclecloud.com/p/CobRpzV_0TH5qRZTRPxNd4VIXX3i06BI2pmHN5uFBGoU6WDNLqySVj7HptY5ff8v/n/axjf9pgc63wu/b/bucket-begreat-top/o/magic.bin';
  const result = await ipcRenderer.invoke('check-and-download-file', url);

  if (result.isDownloaded) {
    checksum.value = result.checksum;
    isDownloaded.value = true;
  } else {
    // 文件正在下载，可以在这里处理下载逻辑
  }
};

onMounted(() => {
  ipcRenderer.on('download-progress', (event, newProgress) => {
    progress.value = newProgress;
  });
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners('download-progress');
});

// 弹窗模态框逻辑
const showModal = ref(false);
const imageUrl = path.join(process.resourcesPath, 'extraResources', 'donate.png');

// 视频转字幕核心流程
const handler_status = ref(false);
const trans_result = ref('');

const CreateSubtitle = async () => {

  handler_status.value = true
  // 开始处理视频提取音频
  await handleAudioExtraction();

  //开始音频转写字幕
  const path = require("path");
  const addonPath = path.join(process.resourcesPath, 'extraResources', 'whisper-addon.node');
  // const addonPath = '/Users/puwenjun/Code/desktop-whisper/BeGreat-Subtitle/extraResources/whisper-addon.node';

  const { whisper } = require(addonPath) as any;

  const { promisify } = require("util");
  const whisperAsync = promisify(whisper);

  const directoryPath = path.join(os.homedir(), 'BeGreat-Subtitle');
  const binFilePath = path.join(directoryPath, 'magic.bin');
  // const binFilePath = '/Users/puwenjun/Code/desktop-whisper/BeGreat-Subtitle/extraResources/magic.bin';
  let whisperParams: { [key: string]: any } = {
    language: lan_value.value,
    model: binFilePath,
    fname_inp: extractedAudio.value
    // fname_inp: "/Users/puwenjun/Code/Whisper/whisper.cpp/samples/jfk.wav"
  };

  const args = process.argv.slice(2);
  const params = Object.fromEntries(
    args.map(item => {
      if (item.startsWith("--")) {
        return item.slice(2).split("=");
      }
      return [item, true];
    })
  );

  for (const key in params) {
    if (key in whisperParams) {
      whisperParams[key] = params[key];
    }
  }

  // console.log("whisperParams =", whisperParams);

  // 字幕格式生成
  let count = 0;
  const toSrtFormat = (inputArr: string[]): string => {
    count += 1;
    return `${count}\n${inputArr[0]} --> ${inputArr[1]}\n${inputArr[2].trim()}\n\n`;
  }

  const convertToSrtFormat = (inputArray: string[][]): string => {
    const srtBlocks = inputArray.map(toSrtFormat);
    return srtBlocks.join('');
  }

  // console.log(handler_status.value)
  whisperAsync(whisperParams).then((result: string[][]) => {
    const srt_result = convertToSrtFormat(result)
    ipcRenderer.send('write-to-file', srt_result)
    trans_result.value = srt_result
    // console.log(handler_status.value)
    handler_status.value = false
  });
};

// 选择文件
const selectedFile = ref('')
const handleButtonClick = async () => {
  const filePath = await ipcRenderer.invoke('open-file-dialog')
  if (filePath) {
    selectedFile.value = filePath
  }
}

// 提取音频
const extractedAudio = ref('')
const handleAudioExtraction = async () => {
  const audioPath = await ipcRenderer.invoke('extract-audio', selectedFile.value)
  if (audioPath) {
    extractedAudio.value = audioPath
  }
}

// 模型选择器
const lan_value = ref(null)
const lan_options = [
  {
    label: "English",
    value: 'en',
    disabled: false
  },
  {
    label: "简体中文",
    value: 'zh',
    disabled: false
  },
  {
    label: "Japanese",
    value: 'ja',
    disabled: false
  },
  {
    label: "German",
    value: 'de',
    disabled: false
  },
  {
    label: "Arabic",
    value: 'ar',
    disabled: false
  },
  {
    label: "Portuguese",
    value: 'pt',
    disabled: false
  },
  {
    label: "Russian",
    value: 'ru',
    disabled: false
  }
]

// 打开存放文件夹
const openFile = () => {
  // 新的文件路径
  const directoryPath = path.join(os.homedir(), 'BeGreat-Subtitle')
  const filePath = path.join(directoryPath, 'BeGreat-Subtitle.srt')
  ipcRenderer.invoke('open-file', filePath)
}

// 暴露给模板的属性和方法
defineExpose({
  downloadFile,
  isDownloaded,
  progress,
  checksum,
  showModal,
  imageUrl,
  CreateSubtitle,
  handler_status,
  trans_result,
  selectedFile,
  handleButtonClick,
  extractedAudio,
  handleAudioExtraction,
  lan_value,
  lan_options,
  openFile,
  currentLanguage,
  switchLanguage
});

</script>

  
<style>
#app {
  max-width: 100%;
  overflow-y: auto;
}

.block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.space-component {
  margin-bottom: 20px;
}

.select-1 {
  width: 150px;
}

/* The Modal (background) */
.modal {
  display: block;
  position: fixed;
  z-index: 1;
  padding-top: 100px;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);
}

/* Modal Content (image) */
.modal-content {
  margin: auto;
  display: block;
  width: 100%;
  max-width: 400px;
}

/* The Close Button */
.close {
  position: absolute;
  top: 15px;
  right: 35px;
  color: #f1f1f1;
  font-size: 40px;
  font-weight: bold;
  transition: 0.3s;
}

.close:focus {
  color: #bbb;
  text-decoration: none;
  cursor: pointer;
}
</style>
  
  