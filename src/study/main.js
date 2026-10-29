import { createApp } from "vue";
import App from "./App.vue";
import { getBundledGlossary } from "./snapshot.js";
import "../shared/styles.css";

try {
  createApp(App, { glossary: getBundledGlossary() }).mount("#app");
} catch (error) {
  console.error(error);
  const alert = document.createElement("p");
  alert.className = "error-banner";
  alert.setAttribute("role", "alert");
  alert.textContent = `No s'ha pogut carregar el glossari incorporat: ${error.message}`;
  document.querySelector("#app").replaceChildren(alert);
}
