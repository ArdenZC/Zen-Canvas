import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const isSearchWindowMode = new URLSearchParams(window.location.search).get("mode") === "search";
document.documentElement.classList.toggle("search-window-root", isSearchWindowMode);
document.body.classList.toggle("search-window-root", isSearchWindowMode);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
