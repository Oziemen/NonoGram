# Monogram hosten op Azure

Deze app is een **100% statische site** (HTML/CSS/JS, geen backend). Er valt
dus niets te "builden" en niets server-side te draaien — je hoeft alleen de
statische bestanden te serveren over **HTTPS** (verplicht voor de PWA /
service worker; Azure regelt HTTPS gratis).

> `server.js` is alleen een lokaal hulpmiddel om te ontwikkelen. Je hebt het
> **niet** nodig om te hosten (behalve bij Optie C hieronder).

---

## 1. Wat je deployt

Alleen deze bestanden/mappen (de "app-root" = de projectmap):

```
index.html
manifest.webmanifest
sw.js
staticwebapp.config.json      (alleen relevant voor Optie A)
icons/                         (icon-192/512/maskable/180 .png)
src/                           (core/*.js en ui/app.js + styles.css)
```

**Niet** nodig op de server (dev/CI-spullen): `node_modules/`,
`package.json`, `server.js`, `gen-icons.mjs`, `test/`, `.git/`. Ze kwaad
kunnen niet, maar zijn overbodig.

Er is **geen build-stap**: `output_location` blijft leeg, je publiceert de
root zoals hij is.

---

## 2. Optie A — Azure Static Web Apps  ⭐ (aanbevolen)

Waarom: gratis tier, automatische HTTPS, gratis SSL op je eigen domein,
CI/CD vanuit GitHub, en onze `staticwebapp.config.json` regelt de juiste
MIME-types en caching. Perfect voor een PWA.

### Via de Azure Portal (grafisch)

1. Portal → **Create a resource** → zoek **Static Web App** → *Create*.
2. Vul in:
   - **Subscription / Resource group**: kies of maak `rg-monogram`.
   - **Name**: `monogram`.
   - **Plan type**: **Free**.
   - **Region**: bijv. *West Europe*.
   - **Source**: **GitHub** → autoriseer → kies:
     - Organization: `Oziemen`
     - Repository: `NonoGram`
     - Branch: `claude/monogram-puzzle-game-4v6dm8` (of `main` na de merge)
   - **Build Details** → *Build Presets*: **Custom**
     - **App location**: `/`
     - **Api location**: *(leeg laten)*
     - **Output location**: *(leeg laten)*
3. **Review + create** → **Create**.

Azure commit nu automatisch een workflow-bestand
(`.github/workflows/azure-static-web-apps-*.yml`) naar je repo en start de
eerste deploy. Na ~1–2 min staat de app live op:

```
https://<willekeurige-naam>.azurestaticapps.net
```

### Via de Azure CLI (alternatief voor stap 1–3)

```bash
az login
az group create -n rg-monogram -l westeurope

az staticwebapp create \
  --name monogram \
  --resource-group rg-monogram \
  --source https://github.com/Oziemen/NonoGram \
  --branch claude/monogram-puzzle-game-4v6dm8 \
  --app-location "/" \
  --output-location "" \
  --login-with-github
```

Elke `git push` naar de gekozen branch = automatische her-deploy. Klaar.

---

## 3. Optie B — Azure Storage static website (goedkoopst)

Prima als je geen CI/CD wilt en de laagste kosten zoekt. Let op: de
`staticwebapp.config.json` werkt hier **niet** (dat is SWA-only), dus je zet
de content-types zelf goed. Custom-domein-HTTPS vereist Azure Front Door of
CDN (het standaard `*.web.core.windows.net`-adres is wél al HTTPS).

```bash
az login
az group create -n rg-monogram -l westeurope

# Storage-account
az storage account create \
  -n monogramsite$RANDOM -g rg-monogram -l westeurope \
  --sku Standard_LRS --kind StorageV2

# Zet de accountnaam die je koos in een variabele:
ACC=<jouw-accountnaam>

# Static website aanzetten
az storage blob service-properties update \
  --account-name $ACC --static-website \
  --index-document index.html --404-document index.html

# Bestanden uploaden naar de speciale $web-container
az storage blob upload-batch \
  -s . -d '$web' --account-name $ACC \
  --pattern "index.html" --pattern "sw.js" --pattern "manifest.webmanifest"
az storage blob upload-batch -s ./icons -d '$web/icons' --account-name $ACC
az storage blob upload-batch -s ./src   -d '$web/src'   --account-name $ACC
```

**Content-types goedzetten** (de CLI raadt `.webmanifest` fout — de rest gaat
meestal goed). Voer daarna uit:

```bash
az storage blob update --account-name $ACC -c '$web' -n manifest.webmanifest \
  --content-type "application/manifest+json"
az storage blob update --account-name $ACC -c '$web' -n sw.js \
  --content-type "text/javascript"
```

> Controleer dat `src/core/*.js` en `src/ui/app.js` als
> `text/javascript` (of `application/javascript`) geserveerd worden — anders
> weigert de browser de ES-modules. Zo niet, zet ze met dezelfde
> `az storage blob update ... --content-type "text/javascript"`.

Je site-URL vind je met:

```bash
az storage account show -n $ACC -g rg-monogram \
  --query "primaryEndpoints.web" -o tsv
```

Voor je **eigen domein met HTTPS** zet je er **Azure Front Door** (of Azure
CDN) voor; die levert het gratis managed certificaat.

---

## 4. Optie C — Azure App Service (draait `server.js` op Node)

Alleen als je liever een echte Node-webserver draait. Meer resources dan
nodig, maar het werkt en gebruikt de meegeleverde `server.js` (die luistert
op `process.env.PORT`).

```bash
az login
# Vanuit de projectmap:
az webapp up \
  --name monogram-app \
  --resource-group rg-monogram \
  --runtime "NODE:20-lts" \
  --sku F1 \
  --location westeurope

# Zorg dat de juiste startopdracht gebruikt wordt:
az webapp config set \
  --name monogram-app -g rg-monogram \
  --startup-file "node server.js"
```

Live op `https://monogram-app.azurewebsites.net`. HTTPS is standaard aan.

---

## 5. Eigen domein + HTTPS

- **Static Web Apps**: SWA-resource → **Custom domains** → domein toevoegen →
  de getoonde CNAME/TXT-records bij je DNS zetten → Azure levert automatisch
  een gratis SSL-certificaat.
- **Storage**: via **Azure Front Door** een custom domain koppelen (managed
  certificate).
- **App Service**: **Custom domains** → domein valideren → **App Service
  Managed Certificate** (gratis) aanmaken en binden.

---

## 6. Na de deploy testen

1. Open de HTTPS-URL op desktop → speel een level.
2. **PWA-check** (Chrome DevTools → *Application*):
   - *Manifest* toont naam + iconen zonder fouten.
   - *Service Workers* toont `sw.js` als **activated**.
3. **Installeren op je telefoon**:
   - **Android/Chrome**: menu (⋮) → *App installeren*.
   - **iOS/Safari**: deelknop → *Zet op beginscherm*.
4. Zet je telefoon in vliegtuigmodus en open de geïnstalleerde app → moet
   **offline** blijven werken.

---

## 7. Updates uitrollen

- **Optie A (SWA)**: gewoon `git push` naar de gekoppelde branch → automatische
  deploy.
- **Optie B (Storage)**: upload-commando's opnieuw draaien.
- **Optie C (App Service)**: `az webapp up` opnieuw.

De service worker heet `monogram-v1` (zie `sw.js`). Verhoog dat versienummer
(bijv. `monogram-v2`) wanneer je de app-bestanden wijzigt, zodat de oude
offline-cache wordt vervangen. Doordat `sw.js` met `cache-control: no-store`
wordt geserveerd (via `staticwebapp.config.json`), pikt de browser de nieuwe
service worker meteen op.
