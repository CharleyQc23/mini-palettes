// ============================================================
// 🔧 CONFIGURATION - Modifier selon la réglementation en vigueur
// ============================================================
const COOKIE_BANNER_ENABLED = false; // 👈 Mettre false pour désactiver le bandeau
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const cookieBanner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("accept-cookies");
  const refuseBtn = document.getElementById("refuse-cookies");

  if (!cookieBanner) return; // Sécurité si une page n'a pas de bandeau

  // Si le bandeau est désactivé, on le cache immédiatement et on arrête
  if (!COOKIE_BANNER_ENABLED) {
    cookieBanner.style.display = "none";
    return;
  }

  // Vérifie si l'utilisateur a déjà fait un choix
  if (localStorage.getItem("cookieChoice")) {
    cookieBanner.style.display = "none";
  }

  // Si l'utilisateur accepte
  acceptBtn.addEventListener("click", () => {
    localStorage.setItem("cookieChoice", "accepted");
    cookieBanner.style.display = "none";
    // 👉 Ici tu pourrais activer Google Analytics, Facebook Pixel, etc.
  });

  // Si l'utilisateur refuse
  refuseBtn.addEventListener("click", () => {
    localStorage.setItem("cookieChoice", "refused");
    cookieBanner.style.display = "none";
    // 👉 Ici, tu t'assures que rien ne traque l'utilisateur
  });
});