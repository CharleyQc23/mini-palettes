// --- PANIER
let panier = JSON.parse(localStorage.getItem('panier')) || [];

// --- Mise à jour du nombre d'articles
function majNbItems() {
  // somme les quantités (sécurisé si quantite absent)
  const totalArticles = panier.reduce((acc, item) => acc + (Number(item.quantite) || 0), 0);
  const nbItems = document.getElementById('nb-items');
  if (nbItems) nbItems.textContent = totalArticles;
}


function animationPanier() {
  const compteur = document.getElementById('nb-items');
  const btnPanier = document.getElementById('btn-panier');
  if (!compteur || !btnPanier) return;
  compteur.classList.add('animate');
  setTimeout(() => compteur.classList.remove('animate'), 400);
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
const btnPanier = document.getElementById('btn-panier');
if (btnPanier) btnPanier.addEventListener('click', () => {
  document.getElementById('sidebar-panier').classList.toggle('open');
});
const btnFermerPanier = document.getElementById('btn-fermer-panier');
if (btnFermerPanier) btnFermerPanier.addEventListener('click', () => {
  document.getElementById('sidebar-panier').classList.remove('open');
});
const btnViderPanier = document.getElementById('vider-panier');
if (btnViderPanier) btnViderPanier.addEventListener('click', () => {
  if (confirm("Es-tu sûr(e) de vouloir vider ton panier ?")) {
    panier = [];
    localStorage.setItem('panier', JSON.stringify(panier));
    afficherPanier();
  }
});

// --- INITIALISATION
if (document.getElementById('liste-panier')) {
  afficherPanier();
}
if (document.getElementById('nb-items')) {
  majNbItems();
}

// Charger le nav partagé
const navContainer = document.getElementById('nav-container');
if (navContainer) {
  fetch('nav.html')
    .then(r => r.text())
    .then(html => {
      navContainer.outerHTML = html;

      // Sous-titre personnalisé par page
      const subtitle = document.body.dataset.subtitle;
      if (subtitle) {
        const el = document.getElementById('nav-subtitle');
        if (el) el.textContent = subtitle;
      }

      // Menu hamburger mobile
      const btnMenu = document.getElementById('btn-menu');
      const menuNav = document.getElementById('menu-nav');
      if (btnMenu && menuNav) {
        btnMenu.addEventListener('click', () => {
          const isOpen = menuNav.classList.toggle('open');
          btnMenu.classList.toggle('open', isOpen);
          btnMenu.setAttribute('aria-expanded', isOpen);
        });

        // Fermer le menu quand on clique sur un lien
        menuNav.querySelectorAll('.nav-link').forEach(link => {
          link.addEventListener('click', () => {
            menuNav.classList.remove('open');
            btnMenu.classList.remove('open');
            btnMenu.setAttribute('aria-expanded', 'false');
          });
        });
      }
    });
}

// Charger le footer partagé
const footerContainer = document.getElementById('footer-container');
if (footerContainer) {
  fetch('footer.html')
    .then(r => r.text())
    .then(html => { footerContainer.outerHTML = html; });
}
