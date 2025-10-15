const stripe = Stripe("pk_test_51RlJVvRajgyqcAklwomlIeHZmbovio5dknAXCQ2mCK7lzDjT8117DNBaFRRbu9S7xtruMHxerqNviVuYvJHZafx100ORhbe9DB");

document.getElementById("checkout-button").addEventListener("click", async () => {
  try {
    const panier = JSON.parse(localStorage.getItem('panier') || '[]');
    if (panier.length === 0) {
      alert("Votre panier est vide !");
      return;
    }

    const response = await fetch("https://mini-palettes-roses.onrender.com/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panier })
    });

    const data = await response.json();

    if (data.id) {
      const result = await stripe.redirectToCheckout({ sessionId: data.id });
      if (result.error) {
        console.error("Erreur redirection Stripe:", result.error.message);
        alert("Erreur lors du paiement : " + result.error.message);
      }
    } else {
      console.error("Erreur serveur Stripe:", data);
      alert("Erreur lors du paiement.");
    }

  } catch (err) {
    console.error("Erreur fetch Stripe:", err);
    alert("Erreur lors du paiement.");
  }
});
