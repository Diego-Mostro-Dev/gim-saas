import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import useAuthStore from "./store/auth.store";
import { ThemeProvider } from "./context/ThemeContext";
import { FeatureProvider } from "./features/FeatureProvider";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const root = ReactDOM.createRoot(document.getElementById("root"));

useAuthStore.getState().hydrate().then(() => {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <FeatureProvider mode="admin">
              <App />
            </FeatureProvider>
            <Toaster position="top-center" />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
