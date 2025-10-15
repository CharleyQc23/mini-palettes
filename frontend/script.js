// --- PANIER
let panier = JSON.parse(localStorage.getItem('panier')) || [];

// --- Mise à jour du nombre d'articles
function majNbItems() {
  // somme les quantités (sécurisé si quantite absent)
  const totalArticles = panier.reduce((acc, item) => acc + (Number(item.quantite) || 0), 0);
  document.getElementById('nb-items').textContent = totalArticles;
}


function animationPanier() {
  const compteur = document.getElementById('nb-items');
  const btnPanier = document.getElementById('btn-panier');

  // lance l'anim sur le compteur
  compteur.classList.add('animate');
  setTimeout(() => compteur.classList.remove('animate'), 400);

  // lance aussi l'anim sur le bouton
  btnPanier.classList.add('animate');
  setTimeout(() => btnPanier.classList.remove('animate'), 400);
}

// --- Affichage du panier
// helper pour échapper le HTML (sécurité)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function afficherPanier() {
  const liste = document.getElementById('liste-panier');
  liste.innerHTML = '';
  let total = 0;

  // normaliser le panier (dans le cas où un ancien format existe)
  panier = panier.map(item => {
    const quant = (item.quantite && Number(item.quantite)) ? Number(item.quantite) : 1;
    // si on a prixUnitaire on l'utilise, sinon on tente de le calculer à partir de prix actuel
    let prixUnitaire;
    if (item.prixUnitaire !== undefined && !isNaN(Number(item.prixUnitaire))) {
      prixUnitaire = Number(item.prixUnitaire);
    } else if (item.prix !== undefined && quant) {
      prixUnitaire = Number(item.prix) / quant;
    } else {
      prixUnitaire = 0;
    }
    const prixTotalItem = prixUnitaire * quant;
    return {
      ...item,
      quantite: quant,
      prixUnitaire: prixUnitaire,
      prix: prixTotalItem
    };
  });

  if (!panier || panier.length === 0) {
    liste.innerHTML = '<li style="text-align:center; color:#888;">Ton panier est vide 🛍️</li>';
    document.getElementById('total').textContent = '0.00';
    majNbItems();
    return;
  }

  panier.forEach((item, index) => {
    total += item.prix;
    const li = document.createElement('li');
    li.className = 'ligne-panier';
    li.innerHTML = `
      <div class="ligne-left">
        <div class="nom-produit"><strong>${escapeHtml(item.nom)}</strong></div>
        <div style="font-size:0.85rem; color:#666;">
          ${item.taille ? escapeHtml(item.taille) : ''} ${item.personnalisation ? ' • ' + escapeHtml(item.personnalisation) : ''}
        </div>
      </div>

      <div class="ligne-right">
        <div class="quantite-controls">
          <button class="btn-moins" data-index="${index}" aria-label="Réduire la quantité">➖</button>
          <input type="number" class="qte-input" data-index="${index}" value="${item.quantite}" min="1" />
          <button class="btn-plus" data-index="${index}" aria-label="Ajouter une quantité">➕</button>
        </div>

        <div class="prix-item">${item.prix.toFixed(2)} $</div>

        <button class="btn-supprimer" data-index="${index}" aria-label="Supprimer">🗑️</button>
      </div>
    `;
    liste.appendChild(li);
  });

  // listeners pour + / - / saisie / suppression

  // plus
  document.querySelectorAll('.btn-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.index, 10);
      if (!Number.isFinite(i)) return;
      panier[i].quantite = (Number(panier[i].quantite) || 0) + 1;
      panier[i].prix = panier[i].prixUnitaire * panier[i].quantite;
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier();
    });
  });

  // moins
  document.querySelectorAll('.btn-moins').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.index, 10);
      if (!Number.isFinite(i)) return;
      if ((panier[i].quantite || 0) > 1) {
        panier[i].quantite = panier[i].quantite - 1;
        panier[i].prix = panier[i].prixUnitaire * panier[i].quantite;
      } else {
        // si on arrive à 0 -> supprimer la ligne
        panier.splice(i, 1);
      }
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier();
    });
  });

  // saisie directe de la quantité
  document.querySelectorAll('.qte-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const i = parseInt(e.currentTarget.dataset.index, 10);
      if (!Number.isFinite(i)) return;
      let q = parseInt(e.currentTarget.value, 10);
      if (isNaN(q) || q < 1) q = 1;
      // limite raisonnable
      if (q > 99) q = 99;
      panier[i].quantite = q;
      panier[i].prix = panier[i].prixUnitaire * q;
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier();
    });
  });

  // suppression
  document.querySelectorAll('.btn-supprimer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.index, 10);
      if (!Number.isFinite(i)) return;
      panier.splice(i, 1);
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier();
    });
  });

  document.getElementById('total').textContent = total.toFixed(2);
  majNbItems();
}

// --- Sidebar panier
document.getElementById('btn-panier').addEventListener('click', () => {
  document.getElementById('sidebar-panier').classList.toggle('open');
});
document.getElementById('btn-fermer-panier').addEventListener('click', () => {
  document.getElementById('sidebar-panier').classList.remove('open');
});
document.getElementById('vider-panier').addEventListener('click', () => {
  if (confirm("Es-tu sûr(e) de vouloir vider ton panier ?")) {
    panier = [];
    localStorage.setItem('panier', JSON.stringify(panier));
    afficherPanier();
  }
});

// --- Bouton Payer avec Stripe
document.getElementById('payer').addEventListener('click', async () => {
  if (panier.length === 0) {
    alert("Ton panier est vide !");
    return;
  }

  try {
    const response = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panier: panier })
    });

    const session = await response.json();
    const stripe = Stripe('pk_test_51RlJVvRajgyqcAklwomlIeHZmbovio5dknAXCQ2mCK7lzDjT8117DNBaFRRbu9S7xtruMHxerqNviVuYvJHZafx100ORhbe9DB'); // clé publique

    const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
    if (error) alert("Erreur lors de la redirection vers Stripe.");
  } catch (err) {
    console.error(err);
    alert("Erreur serveur, impossible de créer la session de paiement.");
  }
});

// --- FICHE PRODUIT avec personnalisation Nom/Numéro
const params = new URLSearchParams(window.location.search);
const idProduit = params.get('id');

if (idProduit) {
  fetch('produits.json')
    .then(res => res.json())
    .then(produits => {
      if (!produits[idProduit]) {
        document.getElementById('fiche-produit').innerHTML = '<p>Produit introuvable.</p>';
        return;
      }

      const produit = produits[idProduit];
      const div = document.getElementById('fiche-produit');
      div.innerHTML = `
        <img src="${produit.image}" alt="${produit.nom}" />
        <h2>${produit.nom}</h2>
        <p><strong>${produit.prix.toFixed(2)} $</strong></p>

        <label for="taille">Choisis une grandeur :</label><br>
        <select id="taille">
          <option value="">-- Sélectionner --</option>
          <option value="X-Small">X-Small</option>
          <option value="Small">Small</option>
          <option value="Medium">Medium</option>
          <option value="Large">Large</option>
          <option value="X-Large">X-Large</option>
        </select><br><br>

        <label for="perso">Personnalisation :</label><br>
        <select id="perso">
          <option value="">-- Sélectionner --</option>
          <option value="Aucune|0">Aucune (0$)</option>
          <option value="Broderie NOM|7">Broderie NOM (+7.00 $)</option>
          <option value="Broderie NUMÉRO|5.5">Broderie NUMÉRO (+5.50 $)</option>
          <option value="Broderie NOM et NUMÉRO|10">Broderie NOM et NUMÉRO (+10.00 $)</option>
        </select><br><br>

        <div id="nom-broderie-container" style="display:none;">
          <label for="nom-broderie">Nom à broder :</label><br>
          <input type="text" id="nom-broderie" maxlength="20" placeholder="Ex: Emma" /><br><br>
        </div>

        <div id="numero-broderie-container" style="display:none;">
          <label for="numero-broderie">Numéro :</label><br>
          <input type="number" id="numero-broderie" min="0" placeholder="Ex: 23" /><br><br>
        </div>

        <label for="quantite">Quantité :</label><br>
        <input type="number" id="quantite" min="1" value="1" style="width: 60px;"><br><br>

        <button id="ajouter-panier" class="btn-ajouter" disabled>Ajouter au panier</button>
        <br><button class="btn-retour" onclick="window.location.href='index.html'">← Retour à l'accueil</button>
      `;

      const selectTaille = document.getElementById('taille');
      const selectPerso = document.getElementById('perso');
      const inputQuantite = document.getElementById('quantite');
      const boutonAjouter = document.getElementById('ajouter-panier');
      const nomContainer = document.getElementById('nom-broderie-container');
      const numeroContainer = document.getElementById('numero-broderie-container');
      const inputNom = document.getElementById('nom-broderie');
      const inputNumero = document.getElementById('numero-broderie');

      function checkReady() {
        const qte = parseInt(inputQuantite.value);
        let persoSelected = selectPerso.value !== '';
        let tailleSelected = selectTaille.value !== '';
        let nomOk = true, numeroOk = true;

        const persoText = selectPerso.value.split('|')[0];

        if (persoText.includes('NOM')) nomOk = inputNom.value.trim() !== '';
        if (persoText.includes('NUMÉRO')) numeroOk = inputNumero.value.trim() !== '';

        boutonAjouter.disabled = !(persoSelected && tailleSelected && qte >= 1 && nomOk && numeroOk);
      }

      selectPerso.addEventListener('change', () => {
        const persoText = selectPerso.value.split('|')[0];
        nomContainer.style.display = persoText.includes('NOM') ? 'block' : 'none';
        numeroContainer.style.display = persoText.includes('NUMÉRO') ? 'block' : 'none';
        checkReady();
      });

      [selectTaille, inputQuantite, inputNom, inputNumero].forEach(el => el.addEventListener('input', checkReady));

      boutonAjouter.addEventListener('click', () => {
        const taille = selectTaille.value;
        const [persoText, persoPrix] = selectPerso.value.split('|');
        const quantite = parseInt(inputQuantite.value);
        const prixUnitaire = produit.prix + parseFloat(persoPrix);
        const prixFinal = prixUnitaire * quantite;

        panier.push({
          nom: produit.nom,
          prix: prixFinal,
          taille: taille,
          personnalisation: persoText,
          quantite: quantite,
          prixUnitaire: prixUnitaire,
          nom_broderie: inputNom.value.trim(),
          numero_broderie: inputNumero.value.trim()
        });

        localStorage.setItem('panier', JSON.stringify(panier));
        afficherPanier();
        majNbItems();
        animationPanier();

        boutonAjouter.textContent = '✔️ Ajouté !';
        boutonAjouter.disabled = true;
        setTimeout(() => {
          boutonAjouter.textContent = 'Ajouter au panier';
          boutonAjouter.disabled = false;
        }, 1200);
      });

      checkReady();
    });
}

// --- INITIALISATION
afficherPanier();
majNbItems();
