import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PopoutPlayerView } from './components/PopoutPlayerView.tsx';
import './index.css';

const isPopoutMode = window.location.search.includes("popout=true");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPopoutMode ? <PopoutPlayerView /> : <App />}
  </StrictMode>,
);
