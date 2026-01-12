import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./index.css";
import "./i18n";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    // Temporarily disabled StrictMode to test reactions without double API calls
    // <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    // </React.StrictMode>
  );
}