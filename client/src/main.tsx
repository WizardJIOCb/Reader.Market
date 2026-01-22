import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";
import i18n from "./i18n";
import { I18nextProvider } from "react-i18next";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    // Temporarily disabled StrictMode to test reactions without double API calls
    // <React.StrictMode>
      <AuthProvider>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </AuthProvider>
    // </React.StrictMode>
  );
}