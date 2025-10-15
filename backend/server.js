const express = require('express');
const cors = require('cors');
const path = require('path');

// ⚠️ Vérifie que STRIPE_SECRET_KEY est défini
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ La variable d'environnement STRIPE_SECRET_KEY n'est pas définie !");
  process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// --- Middleware
app.use(cors());          // Autorise toutes les origines
app.use(express.json());

// --- Servir le frontend
const frontendPath = path.join(__dirname, '../frontend'); // remonte d'un niveau depuis backend
app.use(express.static(frontendPath));

// --- Endpoint Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const panier = req.body.panier || [];
    if (!Array.isArray(panier) || panier.length === 0) {
      return res.status(400).json({ error: 'Panier vide ou invalide.' });
    }

    const line_items = panier.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.nom,
          description:
            `Taille: ${item.taille}, Perso: ${item.personnalisation}` +
            (item.nom_broderie ? `, Nom: ${item.nom_broderie}` : '') +
            (item.numero_broderie ? `, Numéro: ${item.numero_broderie}` : '')
        },
        unit_amount: Math.round(item.prixUnitaire * 100),
      },
      quantity: item.quantite,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/succes.html`,
      cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('Erreur création session Stripe:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Fallback pour toutes les autres routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Port
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));
