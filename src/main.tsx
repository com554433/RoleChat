import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 启动动画：React 挂载后淡出闪屏
const splash = document.getElementById('splash');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 等待最小显示时间后淡出
setTimeout(() => {
  splash?.classList.add('hide');
  // 动画结束后移除 DOM
  setTimeout(() => splash?.remove(), 500);
}, 600);
