import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { OpenAiSessionProvider } from "./lib/openai-session";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OpenAiSessionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </OpenAiSessionProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
