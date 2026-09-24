import React from "react";
import { createRoot } from "react-dom/client";

const isSearchWindowMode = new URLSearchParams(window.location.search).get("mode") === "search";
document.documentElement.classList.toggle("search-window-root", isSearchWindowMode);
document.body.classList.toggle("search-window-root", isSearchWindowMode);
performance.mark(isSearchWindowMode ? "zc:search-bootstrap-start" : "zc:main-bootstrap-start");

const root = createRoot(document.getElementById("root")!);
if (isSearchWindowMode) {
  void import("./SearchApp").then(({ SearchApp }) => {
    root.render(<React.StrictMode><SearchApp /></React.StrictMode>);
  });
} else {
  void import("./App").then(({ App }) => {
    root.render(<React.StrictMode><App /></React.StrictMode>);
  });
}
