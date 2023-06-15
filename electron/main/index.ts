import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import os from 'os'
import path from 'path'
import axios from 'axios'
import crypto from 'crypto'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
// process.env.DIST = app.getAppPath()
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: '',
    icon: join(process.env.PUBLIC, 'logo.svg'),
    width:1024,
    height:768,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344



}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// 选择文件的ipc
ipcMain.handle('open-file-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile']
  })
  if (filePaths.length > 0) {
    return filePaths[0]
  }
})

// 视频音频提取
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)

ipcMain.handle('extract-audio', async (event, videoPath) => {
  const audioPath = videoPath.replace(/\.[^.]+$/, '.wav')

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions('-ar 16000')
      .output(audioPath)
      .on('end', () => resolve(audioPath))
      .on('error', reject)
      .run()
  })
})

//srt文件写入目录相关操作
ipcMain.on('write-to-file', (event, arg) => {
  // arg is the string you want to write to file
  const userHomeDir = os.homedir();
  const directoryPath = path.join(userHomeDir, 'BeGreat-Subtitle');
  
  if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);
  }
  
  const srtFilePath = path.join(directoryPath, 'BeGreat-Subtitle.srt');
  fs.writeFile(srtFilePath, arg, (err) => {
      if (err) throw err;
      console.log('Subtitle file saved!');
  });
});

// 打开并选中文件
ipcMain.handle('open-file', async (event, filePath) => {
  shell.showItemInFolder(filePath)
})

// 识别模型下载和检查相关
// 检查模型文件是否存在的函数
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

// MD5 计算函数
async function calculateChecksum(filePath) {
  const hash = crypto.createHash('md5');
  const fileStream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    fileStream.on('data', chunk => hash.update(chunk));
    fileStream.on('end', () => resolve(hash.digest('hex')));
    fileStream.on('error', reject);
  });
}

ipcMain.handle('check-and-download-file', async (event, url) => {
  const directoryPath = path.join(os.homedir(), 'BeGreat-Subtitle');
  fs.mkdirSync(directoryPath, { recursive: true });  
  const filePath = path.join(directoryPath, 'magic.bin');

  // 如果文件已经存在
  if (checkFileExists(filePath)) {
    const checksum = await calculateChecksum(filePath);
    return { isDownloaded: true, checksum };
  }

  // 文件不存在，开始下载
  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const totalLength = parseInt(response.headers['content-length']);

  response.data.on('data', (chunk) => {
    const progress = Math.round((writer.bytesWritten / totalLength) * 100);
    event.sender.send('download-progress', `${progress}`);
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      calculateChecksum(filePath)
        .then(checksum => {
          resolve({ isDownloaded: true, checksum }); 
        });
    });
    writer.on('error', reject);
  });
});