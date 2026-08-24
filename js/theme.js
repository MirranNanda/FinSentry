// Applies a persisted light/dark override as early as possible to avoid a flash,
// and wires up the toggle button once the DOM is ready.

(function () {
  const saved = localStorage.getItem("finsentry-theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  }
})();

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const current = () => document.documentElement.getAttribute("data-theme");
  const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

  function render() {
    const active = current() || (systemPrefersDark() ? "dark" : "light");
    btn.textContent = active === "dark" ? "☀︎ Light" : "☾ Dark";
  }

  btn.addEventListener("click", () => {
    const next = (current() || (systemPrefersDark() ? "dark" : "light")) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("finsentry-theme", next);
    render();
  });

  render();
}

document.addEventListener("DOMContentLoaded", initThemeToggle);
