let panier = JSON.parse(localStorage.getItem('panier')) || [];

function majNbItems() {
  const totalArticles = panier.reduce((acc, item) => acc + item.quantite, 0);
  document.getElementById('nb-items').textContent = totalArticles;
}

function afficherPanier() {
  const liste = document.getElementById('liste-panier');
  liste.innerHTML = '';
  let total = 0;

  if (panier.length === 0) {
    liste.innerHTML = '<li style="text-align:center; color:#888;">Ton panier est vide 🛍️</li>';
    document.getElementById('total').textContent = '0.00';
    majNbItems();
    return;
  }

  panier.forEach((item, index) => {
    const prixTotalItem = item.quantite * item.prixUnitaire;
    total += prixTotalItem;

    const li = document.createElement('li');
    li.innerHTML = `
      ${item.nom} (${item.taille}, ${item.personnalisation})<br>
      <label>Quantité :
        <input type="number" min="1" max="10" value="${item.quantite}" data-index="${index}" class="quantite-input" style="width: 60px; margin: 5px 0;">
      </label><br>
      <strong>${prixTotalItem.toFixed(2)} $</strong>
      <button class="btn-supprimer" data-index="${index}">🗑️</button>
    `;
    liste.appendChild(li);
  });

  document.getElementById('total').textContent = total.toFixed(2);
  majNbItems();

  // 🗑️ Suppression
  document.querySelectorAll('.btn-supprimer').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.index);
      panier.splice(i, 1);
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier(); // Recharge après suppression
    });
  });

  // 🔁 Modification de quantités
  document.querySelectorAll('.quantite-input').forEach(input => {
    input.addEventListener('change', e => {
      const i = parseInt(e.target.dataset.index);
      let qte = parseInt(e.target.value);

      if (isNaN(qte) || qte < 1) qte = 1;
      if (qte > 10) qte = 10;

      input.value = qte; // Corrige si out of bounds
      panier[i].quantite = qte;
      panier[i].prix = panier[i].prixUnitaire * qte;
      localStorage.setItem('panier', JSON.stringify(panier));
      afficherPanier(); // Recharge après mise à jour
    });
  });
}

// --- Événements sidebar
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
document.getElementById('payer').addEventListener('click', () => {
  window.location.href = 'confirmation.html';
});

// --- Charger produit si page produit
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

        <label for="quantite">Quantité :</label><br>
        <input type="number" id="quantite" min="1" value="1" style="width: 60px;"><br><br>

        <button id="ajouter-panier" class="btn-ajouter" disabled>Ajouter au panier</button>
        <br><button class="btn-retour" onclick="window.location.href='index.html'">← Retour à l'accueil</button>
      `;

      const selectTaille = document.getElementById('taille');
      const selectPerso = document.getElementById('perso');
      const inputQuantite = document.getElementById('quantite');
      const boutonAjouter = document.getElementById('ajouter-panier');

      function checkReady() {
        const qte = parseInt(inputQuantite.value);
        boutonAjouter.disabled = (selectTaille.value === '' || selectPerso.value === '' || !qte || qte < 1);
      }

      selectTaille.addEventListener('change', checkReady);
      selectPerso.addEventListener('change', checkReady);
      inputQuantite.addEventListener('input', checkReady);

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
          prixUnitaire: prixUnitaire
        });

        localStorage.setItem('panier', JSON.stringify(panier));
        afficherPanier();
        majNbItems();

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

// --- Initialisation
afficherPanier();
majNbItems();
