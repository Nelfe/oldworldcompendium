# Old World Compendium

Aide-mémoire **non officiel** en français pour *Warhammer: The Old World*, sous forme de PWA installable et utilisable hors ligne.

- **Règles** : fiches résumées en français, mots-clés cliquables (aperçu au survol), lien vers la page officielle de chaque règle sur <https://tow.whfb.app/>.
- **Listes** : création de listes d'armée (unités, points, règles spéciales, contraintes de composition paramétrables), export/import JSON, copie en texte.
- **Phases** : choix d'une liste, puis rappels pour chaque phase, dans votre tour comme dans celui de l'adversaire.

Les résumés sont rédigés librement ; ils ne remplacent pas le livre de règles. Projet de fan, non affilié à Games Workshop.

## Utilisation

Aucune compilation : ce sont des fichiers statiques. Servez le dossier en **HTTPS** (GitHub Pages, Netlify…) puis installez l'app depuis le navigateur.

En local : `python3 -m http.server 8000` puis <http://localhost:8000>.

## Structure

- `index.html`, `style.css`, `app.js` : interface
- `data.js` : glossaire, phases et rappels (le fichier à enrichir)
- `sw.js`, `manifest.webmanifest`, `icons/` : PWA hors ligne
