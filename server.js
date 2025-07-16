require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const items = req.body.panier.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.nom,
          description: `Taille: ${item.taille}, Perso: ${item.personnalisation}` +
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
  success_url: 'https://charleyqc23.github.io/Mini-Palettes-Roses/success.html',
  cancel_url: 'https://charleyqc23.github.io/Mini-Palettes-Roses/cancel.html',
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Erreur création session Stripe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

const PORT = 4242;
app.listen(PORT, () => {
  console.log(`Serveur Stripe en écoute sur le port ${PORT}`);
});
