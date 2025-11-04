// --- server.js (version optimisée avec ajout auto des produits sur Stripe) ---
const express = require('express');
const cors = require('cors');
const path = require('path');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ La variable d'environnement STRIPE_SECRET_KEY n'est pas définie !");
  process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

// --- Middleware
app.use(cors());
app.use(express.json());

// --- Servir le frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// --- Cache produits pour éviter les appels répétitifs à Stripe
let cacheProduits = [];

// --- Fonction utilitaire : trouve ou crée un produit et son prix
async function getOrCreateStripePrice(item) {
  const nomProduit = item.nom.trim();
  const montantCents = Math.round(item.prixUnitaire * 100);
  const description = `Taille: ${item.taille || 'N/A'} | ${item.personnalisation || 'Aucune personnalisation'}`;

  // Vérifie si le produit existe déjà dans le cache
  let produit = cacheProduits.find(p => p.name === nomProduit);

  // Si pas trouvé, le chercher sur Stripe
  if (!produit) {
    const produitsStripe = await stripe.products.list({ active: true, limit: 100 });
    produit = produitsStripe.data.find(p => p.name === nomProduit);

    // S'il n'existe toujours pas, on le crée
    if (!produit) {
      produit = await stripe.products.create({
        name: nomProduit,
        description: 'Produit ajouté automatiquement depuis Mini Palettes Roses',
        images: item.image ? [item.image] : [],
      });
    }

    // Met à jour le cache local
    cacheProduits.push(produit);
  }

  // Cherche un prix correspondant sur Stripe
  const prices = await stripe.prices.list({ product: produit.id, limit: 100 });
  let price = prices.data.find(p => p.unit_amount === montantCents && p.currency === 'cad');

  // Si aucun prix exact trouvé, on le crée
  if (!price) {
    price = await stripe.prices.create({
      product: produit.id,
      unit_amount: montantCents,
      currency: 'cad',
    });
  }

  return price.id;
}

// --- Endpoint Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const panier = req.body.panier;
    if (!Array.isArray(panier) || panier.length === 0) {
      return res.status(400).json({ error: 'Panier vide ou invalide.' });
    }

    // Crée les line_items dynamiquement
    const line_items = [];
    for (const item of panier) {
      const priceId = await getOrCreateStripePrice(item);
      line_items.push({
        price: priceId,
        quantity: item.quantite || 1,
      });
    }

    // Crée la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: `${req.protocol}://${req.get('host')}/confirmation.html`,
      cancel_url: `${req.protocol}://${req.get('host')}/panier.html`,
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('❌ Erreur création session Stripe:', err);
    res.status(500).json({ error: 'Erreur serveur Stripe' });
  }
});

// --- Fallback vers index.html
app.get('/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur le port ${PORT}`));
