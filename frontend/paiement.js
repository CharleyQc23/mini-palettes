// --- paiement.js ---
const stripe = Stripe("pk_live_51RlJVlDmX69ZLUq0eiZ3Vi6R2Nk7SOrHcCQ16fqpmRsWJWULAj4GPRtmYCmRLEJ5X2JW9XfFY3E0ZjA3Jmu0IFmG00Cmh7Km7v");

// --- Détection de l'environnement
const BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:4242"
  : "https://www.minipalettes.ca"; // ← ton URL Render ou domaine réel

// --- Bouton de paiement
document.getElementById("checkout-button").addEventListener("click", async () => {
  const panier = JSON.parse(localStorage.getItem("panier")) || [];

  if (!panier.length) {
    alert("Le panier est vide !");
    return;
  }

  // --- Nettoyage du panier avant envoi (prévention erreurs)
  const panierNettoye = panier.map(item => ({
    nom: item.nom,
    taille: item.taille || "",
    prixUnitaire: Number(item.prixUnitaire) || 0,
    quantite: Number(item.quantite) || 1,
    personnalisation: item.personnalisation || "Aucune personnalisation",
    image: item.image || "", // facultatif si tu veux afficher les visuels sur Stripe
  }));

  try {
    const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panier: panierNettoye }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Erreur backend:", data.error);
      alert("Erreur lors de la création du paiement !");
      return;
    }

    // --- Redirection vers Stripe Checkout
    const result = await stripe.redirectToCheckout({ sessionId: data.id });
    if (result.error) {
      console.error(result.error.message);
      alert("Erreur lors de la redirection Stripe !");
    }
  } catch (err) {
    console.error("Erreur de paiement:", err);
    alert("Erreur lors du paiement. Vérifie la console pour plus de détails.");
  }
});
