import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./storage.js";
import SpeechStudio from "./SpeechStudio.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SpeechStudio />
  </React.StrictMode>
);
