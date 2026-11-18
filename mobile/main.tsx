import { createRoot } from "react-dom/client";
import "../src/styles.css";
import { OfflineStudioPage } from "../src/mobile/OfflineStudioPage";

const root = document.getElementById("root");
if (!root) throw new Error("Android studio root was not found");
createRoot(root).render(<OfflineStudioPage />);