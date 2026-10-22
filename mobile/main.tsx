import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MobileApp } from "../src/mobile/App";
import "../src/styles.css";

document.documentElement.classList.add("dark");
const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");
createRoot(root).render(<StrictMode><MobileApp /></StrictMode>);
