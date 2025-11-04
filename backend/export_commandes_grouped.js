// --- export_commandes_grouped_summary.js ---
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ La variable d'environnement STRIPE_SECRET_KEY n'est pas définie !");
  process.exit(1);
}

async function exportOrdersSummaryCSV() {
  try {
    let allSessions = [];
    let starting_after = null;
    
    while (true) {
      const params = { limit: 100 };
if (starting_after && starting_after.length > 0) {
  params.starting_after = starting_after;
}
    
      const sessions = await stripe.checkout.sessions.list(params);
    
      allSessions = allSessions.concat(sessions.data);
    
      if (!sessions.has_more) break;
      starting_after = sessions.data[sessions.data.length - 1].id;
    }    

    console.log(`✅ ${allSessions.length} sessions récupérées`);

    // --- Regrouper les produits par nom + taille
    const summary = {}; // clé = nom + taille, valeur = {quantité totale, détails perso}

    for (const session of allSessions) {
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

        const key = `${nom} | ${taille}`;

        if (!summary[key]) {
          summary[key] = { total: 0, details: [] };
        }

        summary[key].total += quantite;
        if (nomPerso || numero) {
          summary[key].details.push(`"${nomPerso}" #${numero} x${quantite}`);
        }
      });
    }

    // --- Préparer CSV
    const header = ['Produit', 'Taille', 'Quantité Totale', 'Détails Personnalisés'];
    const rows = [header.join(',')];

    Object.entries(summary).forEach(([key, value]) => {
      const [nom, taille] = key.split(' | ');
      const details = value.details.join('; ');
      rows.push([nom, taille, value.total, details].map(v => `"${v}"`).join(','));
    });

    // --- Sauvegarde CSV
    const filename = `commandes_resumes_${Date.now()}.csv`;
    fs.writeFileSync(filename, rows.join('\n'));
    console.log(`✅ CSV résumé généré : ${filename}`);
  } catch (err) {
    console.error('❌ Erreur export commandes résumé:', err);
  }
}

// --- Exécution
exportOrdersSummaryCSV();
