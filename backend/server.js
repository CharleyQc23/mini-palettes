// --- server.js (final avec dotenv et export CSV protégé) ---
require('dotenv').config(); // Charge les variables d'environnement depuis .env

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

// --- Mot de passe pour sécuriser l’export CSV
const EXPORT_PASSWORD = process.env.EXPORT_PASSWORD || 'Mini-MDP';

// --- Fonction utilitaire : trouve ou crée un produit et son prix
async function getOrCreateStripePrice(item) {
  const nomProduit = item.nom.trim();
  const montantCents = Math.round(item.prixUnitaire * 100);

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

    const line_items = [];
    for (const item of panier) {
      const priceId = await getOrCreateStripePrice(item);
      line_items.push({
        price: priceId,
        quantity: item.quantite || 1,
      });
    }

    // Préparer les metadata pour chaque item
    const metadata = {};
    panier.forEach((item, i) => {
      const n = i + 1;
      metadata[`item_${n}_nom`] = item.nom;
      metadata[`item_${n}_taille`] = item.taille || '';
      metadata[`item_${n}_quantite`] = item.quantite || 1;
      metadata[`item_${n}_nom_personnalise`] = item.nomBrode || '';
      metadata[`item_${n}_numero`] = item.numeroBrode || '';
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      metadata,
      success_url: `${req.protocol}://${req.get('host')}/confirmation.html`,
      cancel_url: `${req.protocol}://${req.get('host')}/panier.html`,
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('❌ Erreur création session Stripe:', err);
    res.status(500).json({ error: 'Erreur serveur Stripe' });
  }
});

// --- Endpoint pour exporter les commandes CSV (protégé par mot de passe)
app.get('/export-commandes', async (req, res) => {
  try {
    const password = req.query.password;
    if (password !== EXPORT_PASSWORD) {
      return res.status(401).send('❌ Mot de passe invalide');
    }

    let allSessions = [];
    let starting_after = null;

    console.log('🔹 Début récupération sessions Stripe...');

    // --- Récupérer toutes les sessions Checkout
    while (true) {
      const params = { limit: 100, expand: ['data.customer_details'] };
      if (starting_after && starting_after.length > 0) {
        params.starting_after = starting_after;
      }
      
      const sessions = await stripe.checkout.sessions.list(params);      

      allSessions = allSessions.concat(sessions.data);
      console.log(`➡️ Récupérées ${sessions.data.length} sessions (total: ${allSessions.length})`);

      if (!sessions.has_more) break;
      starting_after = sessions.data[sessions.data.length - 1].id;
    }

    console.log(`✅ Total sessions récupérées: ${allSessions.length}`);

    // --- Préparer CSV clients
    const clientHeader = ['Nom client','Email client','Produit','Taille','Quantité','Nom personnalisé','Numéro'];
    const clientRows = [clientHeader.join(',')];

    // --- Préparer CSV fournisseur
    const fournisseurSummary = {};
    const fournisseurHeader = ['Produit','Taille','Quantité Totale','Détails Personnalisés'];
    const fournisseurRows = [fournisseurHeader.join(',')];

    // --- Parcours des sessions
    for (const session of allSessions) {
      const customerName = session.customer_details?.name || 'Inconnu';
      const customerEmail = session.customer_details?.email || 'Inconnu';
      const metadata = session.metadata || {};

      const itemIndices = Object.keys(metadata)
        .map(k => k.match(/^item_(\d+)_nom$/))
        .filter(Boolean)
        .map(m => m[1])
        .sort((a, b) => a - b);

      itemIndices.forEach(i => {
        const nom = metadata[`item_${i}_nom`] || '';
        const taille = metadata[`item_${i}_taille`] || '';
        const quantite = parseInt(metadata[`item_${i}_quantite`] || 0, 10);
        const nomPerso = metadata[`item_${i}_nom_personnalise`] || '';
        const numero = metadata[`item_${i}_numero`] || '';

        // --- CSV clients
        clientRows.push([
          `"${customerName}"`,
          `"${customerEmail}"`,
          `"${nom}"`,
          `"${taille}"`,
          quantite,
          `"${nomPerso}"`,
          `"${numero}"`
        ].join(','));

        // --- CSV fournisseur
        const key = `${nom}|${taille}`;
        if (!fournisseurSummary[key]) {
          fournisseurSummary[key] = { total: 0, details: [] };
        }
        fournisseurSummary[key].total += quantite;
        if (nomPerso || numero) {
          fournisseurSummary[key].details.push(`"${nomPerso}" #${numero} x${quantite}`);
        }
      });
    }

    // --- Remplir CSV fournisseur
    Object.entries(fournisseurSummary).forEach(([key, value]) => {
      const [nom, taille] = key.split('|');
      const details = value.details.join('; ');
      fournisseurRows.push([nom, taille, value.total, `"${details}"`].join(','));
    });

    // --- Type de CSV à envoyer : clients ou fournisseur
    const type = req.query.type || 'clients';
    if (type === 'fournisseur') {
      res.setHeader('Content-disposition', `attachment; filename=commandes_fournisseur.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.send(fournisseurRows.join('\n'));
    } else {
      res.setHeader('Content-disposition', `attachment; filename=commandes_clients.csv`);
      res.setHeader('Content-Type', 'text/csv');
      res.send(clientRows.join('\n'));
    }

    console.log(`✅ Export CSV "${type}" généré avec succès`);
  } catch (err) {
    console.error('❌ Erreur export commandes via endpoint:', err);
    res.status(500).send(`Erreur serveur lors de l’export des commandes: ${err.message}`);
  }
});

// --- Fallback vers index.html pour toutes les autres routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Lancement serveur
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur le port ${PORT}`));
