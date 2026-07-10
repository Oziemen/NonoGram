# 🧩 Monogram

Een complete **nonogram / picross** puzzel — in Japan bekend als een logische
tekenpuzzel. Vul de vakjes in op basis van de cijferaanwijzingen naast elke rij
en kolom en onthul de verborgen afbeelding.

De hele app draait in de browser, **zonder externe dependencies** en zonder
build-stap.

## ✨ Functies

- **12 handgemaakte puzzels** in drie moeilijkheidsgraden (5×5, 10×10, 15×15),
  elk gegarandeerd puur-logisch en uniek oplosbaar.
- **Dagelijkse puzzel** — elke dag dezelfde uitdaging voor iedereen.
- **Willekeurige puzzel** — vers gegenereerd en gegarandeerd oplosbaar.
- **Vullen / kruisen**, slepen om te tekenen (met as-vergrendeling voor rechte
  lijnen), en volledige touch-ondersteuning.
- **Toetsenbordbesturing**: pijltjes om te navigeren, `spatie` om te vullen,
  `x` om te kruisen.
- Automatisch **doorstrepen** van voltooide rijen/kolommen en van de resterende
  vakjes bij een afgeronde lijn.
- **Hint**, **ongedaan maken**, **wissen** en een live voortgangsbalk.
- **Timer** met opslag van je beste tijd per puzzel.
- **Voortgang opslaan** (voltooide puzzels + halverwege gestopte spellen) via
  `localStorage`.
- **Licht/donker thema** en aan/uit te zetten **geluidseffecten** (Web Audio).
- Feestelijke **win-animatie** met confetti.
- Volledig **responsive** — werkt op desktop en mobiel.

## 🚀 Starten

```bash
npm start
```

Open daarna <http://localhost:8080> in je browser. (Een andere poort kan met
`node server.js 3000`.)

> De app gebruikt ES-modules, dus hij moet via een webserver geladen worden —
> rechtstreeks `index.html` openen vanaf schijf werkt niet in de meeste
> browsers.

## 🧪 Tests

De volledige spellogica is losgekoppeld van de UI en wordt getest met de
ingebouwde testrunner van Node (geen dependencies):

```bash
npm test
```

Dit controleert onder andere:

- correcte berekening van rij- en kolomaanwijzingen,
- de constraint-propagatie-**solver**,
- dat **elke** puzzel in de bibliotheek een unieke, logisch oplosbare
  oplossing heeft,
- de generator voor willekeurige puzzels,
- winst- en voortgangsdetectie.

## 🗂️ Structuur

```
index.html            App-shell
server.js             Kleine statische webserver (geen dependencies)
src/
  core/
    nonogram.js        Pure spellogica: aanwijzingen, solver, generator
    puzzles.js         Puzzelbibliotheek (pixel-tekeningen)
  ui/
    app.js             Game-controller (DOM, interactie, opslag)
    styles.css         Vormgeving + thema's
test/
  nonogram.test.js     Unit-tests voor de core
```

## 🎮 Hoe speel je?

De getallen naast een rij of kolom geven de lengtes van de aaneengesloten
gevulde reeksen aan, in volgorde. Tussen twee reeksen zit minstens één leeg
vakje. Gebruik logica (niet gokken!) om te bepalen welke vakjes gevuld moeten
worden. Markeer zeker-lege vakjes met een kruisje om overzicht te houden.

Veel plezier! 🎉
