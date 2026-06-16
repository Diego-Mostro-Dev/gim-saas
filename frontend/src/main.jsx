import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App";
import useAuthStore from "./store/auth.store";
import { ThemeProvider } from "./context/ThemeContext";

import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

useAuthStore.getState().hydrate().then(() => {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
