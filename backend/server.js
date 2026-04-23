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
// --- Mot de passe pour sécuriser l’export CSV
const EXPORT_PASSWORD = process.env.EXPORT_PASSWORD || 'Mini-MDP';

// --- Fonction utilitaire pour échapper les champs CSV
const escapeCSV = (text) => {
  if (!text) return '';
  return `"${String(text).replace(/"/g, '""')}"`;
};


// --- Endpoint Stripe Checkout
// --- Endpoint Stripe Checkout simplifié et debug ---
app.post("/create-checkout-session", async (req, res) => {
  try {
    const panier = req.body.panier;
    console.log("📦 Panier reçu :", JSON.stringify(panier, null, 2));

    if (!panier || !Array.isArray(panier) || panier.length === 0) {
      return res.status(400).json({ error: "Panier vide ou invalide" });
    }

    const line_items = panier.map((item, idx) => {
      if (!item.nom || typeof item.nom !== "string") {
        throw new Error(`Item #${idx} invalide : nom manquant ou non-string => ${JSON.stringify(item)}`);
      }
      if (typeof item.prixUnitaire !== "number" || isNaN(item.prixUnitaire)) {
        throw new Error(`Item #${idx} invalide : prixUnitaire invalide => ${JSON.stringify(item)}`);
      }
      if (typeof item.quantite !== "number" || !Number.isInteger(item.quantite) || item.quantite <= 0) {
        throw new Error(`Item #${idx} invalide : quantite invalide => ${JSON.stringify(item)}`);
      }

      return {
        price_data: {
          currency: 'cad',
          product_data: { name: item.nom },
          unit_amount: Math.round(item.prixUnitaire * 100),
        },
        quantity: item.quantite,
      };
    });

    console.log("➡️ Line items prêts :", line_items);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.BASE_URL || 'http://localhost:4242'}/succes.html`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:4242'}/boutique.html`,
    });

    console.log("✅ Session Stripe créée :", session.id);
    res.json({ id: session.id });
  } catch (err) {
    console.error("❌ Erreur création session :", err);
    if (err.raw) {
      // Pour Stripe, err.raw contient souvent le détail exact
      console.error("💡 Détails Stripe :", err.raw);
    }
    res.status(500).json({ error: err.message });    
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
