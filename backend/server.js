require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// --- Servir le frontend (fichiers HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'frontend'))); // Assure-toi que ton dossier frontend est ici

// --- Endpoint pour créer la session Stripe
app.post('/create-checkout-session', async (req, res) => {
  try {
    const items = req.body.panier.map(item => ({
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
      line_items: items,
      mode: 'payment',
      // Met ici ton domaine Render pour redirection
      success_url: 'https://minipalettes.onrender.com/succes.html',
      cancel_url: 'https://minipalettes.onrender.com/cancel.html',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erreur création session Stripe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// --- Route fallback pour React/SPA ou fichiers non trouvés
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// --- Port dynamique pour Render
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
