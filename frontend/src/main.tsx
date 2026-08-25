import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { TooltipProvider } from './components/ui/tooltip';
import App from './App';
import './index.css';

document.documentElement.classList.add('dark', 'theme');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={350}>
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
