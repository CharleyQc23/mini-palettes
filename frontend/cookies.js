const COOKIE_BANNER_ENABLED = false;

(function() {
  // Injecter le HTML du bandeau une seule fois
  if (!document.getElementById('cookie-banner')) {
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <p>Nous utilisons des cookies conformément à la Loi 25 sur la protection des renseignements personnels des citoyens du Québec.
        <a href="politique.html" class="cookie-link">En savoir plus</a>
      </p>
      <div class="cookie-buttons">
        <button id="accept-cookies" class="btn-cookie">Accepter</button>
        <button id="refuse-cookies" class="btn-cookie refuse">Seulement les témoins nécessaires</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  if (!COOKIE_BANNER_ENABLED) {
    document.getElementById('cookie-banner').style.display = 'none';
    return;
  }

  if (localStorage.getItem('cookieChoice')) {
    document.getElementById('cookie-banner').style.display = 'none';
    return;
  }

  document.getElementById('accept-cookies').addEventListener('click', () => {
    localStorage.setItem('cookieChoice', 'accepted');
    document.getElementById('cookie-banner').style.display = 'none';
  });

  document.getElementById('refuse-cookies').addEventListener('click', () => {
    localStorage.setItem('cookieChoice', 'refused');
    document.getElementById('cookie-banner').style.display = 'none';
  });
})();
