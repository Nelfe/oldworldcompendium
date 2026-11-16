# Old World Compendium

Aide-mémoire **non officiel** en français pour *Warhammer: The Old World*, sous forme de PWA installable et utilisable hors ligne.

- **Règles** : fiches résumées en français, mots-clés cliquables (aperçu au survol), lien vers la page officielle de chaque règle sur <https://tow.whfb.app/>.
- **Armées** : votre bibliothèque (armées, compositions et sous-factions, fiches d'unité avec profil, options chiffrées, équipement, règles, sorts), saisie à la main ou import/export JSON.
- **Listes** : constructeur de listes d'armée à partir de la bibliothèque (effectif, options, points calculés, limites par catégorie), copie en texte, export JSON.
- **Phases** : schéma du tour (les 4 phases et leurs étapes, mots-clés cliquables), détail de chaque étape, et rappels adaptés à la liste choisie (règles, sorts), dans votre tour comme dans celui de l'adversaire.

Les résumés sont rédigés librement ; ils ne remplacent pas le livre de règles. Les profils, coûts et sorts des unités ne sont pas fournis : ils sont à saisir ou à importer par l'utilisateur. Projet de fan, non affilié à Games Workshop.

## Utilisation

Aucune compilation : ce sont des fichiers statiques. Servez le dossier en **HTTPS** (GitHub Pages, Netlify…) puis installez l'app depuis le navigateur.

En local : `python3 -m http.server 8000` puis <http://localhost:8000>.

## Structure

- `index.html`, `style.css`, `app.js` : interface
- `data.js` : glossaire, phases et rappels (le fichier à enrichir)
- `sw.js`, `manifest.webmanifest`, `icons/` : PWA hors ligne
