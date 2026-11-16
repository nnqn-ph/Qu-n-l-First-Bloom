import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Tự động refetch dữ liệu khi người dùng chuyển lại tab
      refetchOnReconnect: true,   // Tự động refetch khi có mạng trở lại
      retry: 1,
      staleTime: 5000,           // 5 giây trước khi cache được xem là stale
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
