// --- server.js ---
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const fs = require('fs');

// Vérifie la clé Stripe
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
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// --- Cache produits pour éviter les appels répétitifs à Stripe
let cacheProduits = [];

// --- Mot de passe pour sécuriser l’export CSV
const EXPORT_PASSWORD = process.env.EXPORT_PASSWORD || 'Mini-MDP';

// --- Fonction utilitaire pour échapper les champs CSV
const escapeCSV = (text) => {
  if (!text) return '';
  return `"${String(text).replace(/"/g, '""')}"`;
};

// --- Fonction utilitaire : trouve ou crée un produit et son prix
async function getOrCreateStripePrice(item) {
  const nomProduit = item.nom.trim();
  const montantCents = Math.round(item.prixUnitaire * 100);

  let produit = cacheProduits.find(p => p.name === nomProduit);

  if (!produit) {
    const produitsStripe = await stripe.products.list({ active: true, limit: 100 });
    produit = produitsStripe.data.find(p => p.name === nomProduit);

    if (!produit) {
      produit = await stripe.products.create({
        name: nomProduit,
        description: 'Produit ajouté automatiquement depuis Mini Palettes Roses',
        images: item.image ? [item.image] : [],
      });
    }

    cacheProduits.push(produit);
  }

  const prices = await stripe.prices.list({ product: produit.id, limit: 100 });
  let price = prices.data.find(p => p.unit_amount === montantCents && p.currency === 'cad');

  if (!price) {
    price = await stripe.prices.create({
      product: produit.id,
      unit_amount: montantCents,
      currency: 'cad',
    });
  }

  return price.id; // retourne directement l'ID
}

// --- Endpoint Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { panier } = req.body;
    if (!panier || panier.length === 0) return res.status(400).json({ error: 'Panier vide' });

    // Préparer les lignes pour Stripe
    const line_items = await Promise.all(panier.map(async item => {
      const priceId = await getOrCreateStripePrice(item);
      return {
        price: priceId,
        quantity: item.quantite,
      };
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: 'https://www.minipalettes.ca/confirmation.html',
      cancel_url: 'https://www.minipalettes.ca/panier.html',
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('❌ Erreur création session Stripe:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création de la session' });
  }
});

// --- Endpoint pour exporter les commandes CSV
app.get('/export-commandes', async (req, res) => {
  try {
    const password = req.query.password;
    if (password !== EXPORT_PASSWORD) return res.status(401).send('❌ Mot de passe invalide');

    let allSessions = [];
    let starting_after = null;

    console.log('🔹 Début récupération sessions Stripe...');

    while (true) {
      const params = { limit: 100, expand: ['data.customer_details'] };
      if (starting_after) params.starting_after = starting_after;

      const sessions = await stripe.checkout.sessions.list(params);
      allSessions = allSessions.concat(sessions.data);

      console.log(`➡️ Récupérées ${sessions.data.length} sessions (total: ${allSessions.length})`);

      if (!sessions.has_more) break;
      starting_after = sessions.data[sessions.data.length - 1].id;
    }

    console.log(`✅ Total sessions récupérées: ${allSessions.length}`);

    // --- Préparer CSV
    const clientHeader = ['Nom client','Email client','Produit','Taille','Quantité','Nom personnalisé','Numéro'];
    const fournisseurHeader = ['Produit','Taille','Quantité Totale','Détails Personnalisés'];

    const clientRows = [clientHeader.map(escapeCSV).join(',')];
    const fournisseurRows = [fournisseurHeader.map(escapeCSV).join(',')];
    const fournisseurSummary = {};

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

        // CSV clients
        clientRows.push([
          customerName, customerEmail, nom, taille, quantite, nomPerso, numero
        ].map(escapeCSV).join(','));

        // CSV fournisseur
        const key = `${nom}|${taille}`;
        if (!fournisseurSummary[key]) fournisseurSummary[key] = { total: 0, details: [] };
        fournisseurSummary[key].total += quantite;
        if (nomPerso || numero) fournisseurSummary[key].details.push(`${nomPerso} #${numero} x${quantite}`);
      });
    }

    Object.entries(fournisseurSummary).forEach(([key, value]) => {
      const [nom, taille] = key.split('|');
      const details = value.details.join('; ');
      fournisseurRows.push([nom, taille, value.total, details].map(escapeCSV).join(','));
    });

    // Choisir le type
    const type = req.query.type || 'clients';
    const csvContent = type === 'fournisseur' ? fournisseurRows : clientRows;

    res.setHeader('Content-disposition', `attachment; filename=commandes_${type}.csv`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');

    // Ajout BOM pour Excel
    res.send('\uFEFF' + csvContent.join('\n'));

    console.log(`✅ Export CSV "${type}" généré avec succès`);
  } catch (err) {
    console.error('❌ Erreur export commandes:', err);
    res.status(500).send(`Erreur serveur lors de l’export des commandes: ${err.message}`);
  }
});

// --- Fallback vers index.html pour toutes les autres routes (après API)
app.use((req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html introuvable');
  }
});

// --- Lancement serveur
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Serveur en écoute sur le port ${PORT}`));
