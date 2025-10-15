const stripe = Stripe("pk_test_51RlJVvRajgyqcAklwomlIeHZmbovio5dknAXCQ2mCK7lzDjT8117DNBaFRRbu9S7xtruMHxerqNviVuYvJHZafx100ORhbe9DB");

// Détecte local ou prod
const BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:4242"
  : "https://www.minipalettes.ca"; // ← ton URL publique Render

document.getElementById("checkout-button").addEventListener("click", () => {
  const panier = JSON.parse(localStorage.getItem('panier')) || [];
  if (!panier.length) {
    alert("Le panier est vide !");
    return;
  }

  fetch(`${BACKEND_URL}/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ panier })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error("Erreur backend:", data.error);
      alert("Erreur lors du paiement !");
      return;
    }
    return stripe.redirectToCheckout({ sessionId: data.id });
  })
  .catch(err => {
    console.error("Erreur paiement:", err);
    alert("Erreur lors du paiement ! Regarde la console.");
  });
});
