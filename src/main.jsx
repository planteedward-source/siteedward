import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";
const root = document.getElementById("root");
const data = document.getElementById("public-data");
const app = (
  <App
    initialPath={location.pathname.replace(/\/$/, "") || "/"}
    initialPublicData={data ? JSON.parse(data.textContent) : undefined}
  />
);
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
