try {
  const saved = localStorage.getItem("fgh.theme");
  if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark");
} catch {
  /* storage unavailable */
}
