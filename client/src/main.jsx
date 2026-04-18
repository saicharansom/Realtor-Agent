import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import BuyerChat from './pages/BuyerChat.jsx';
import './index.css';

const page = window.location.pathname.startsWith('/chat') ? <BuyerChat /> : <App />;
createRoot(document.getElementById('root')).render(page);
