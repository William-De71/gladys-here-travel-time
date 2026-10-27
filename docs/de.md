# HERE Travel Time

## Überblick

Diese Integration verfolgt Ihre üblichen Strecken — Arbeit, Schule, Flughafen — mit den Fahrzeiten von HERE. Für jede Strecke liefert sie die Fahrzeit mit Live-Verkehr, die Verzögerung durch den Verkehr, die Entfernung und die Hauptstraßen, oder Linien und Zeiten im ÖPNV, und sie kann Ihre Szenen starten, wenn der Verkehr zunimmt oder sich die Route ändert.

- Jede Strecke wird zu einem **Gerät**: Fahrzeit, Fahrzeit ohne Verkehr und Verkehrsverzögerung (Auto, Lkw, Roller / Motorrad), Entfernung, Hauptstraßen oder Linien.
- Sechs Fortbewegungsarten: **Auto** (mit oder ohne Live-Verkehr), **Lkw**, **Roller / Motorrad**, **Fahrrad**, **zu Fuß**, **öffentliche Verkehrsmittel** (Linien, Umstiege, erste Abfahrt, Echtzeit-Verspätung).
- Strecken werden **nur an ihren Tagen und Uhrzeiten** gemessen, damit die Anfragen im kostenlosen Monatskontingent von HERE bleiben.
- **Szenen-Auslöser**: Die Route einer Strecke ändert sich, das Monatsbudget ist fast verbraucht, HERE lehnt den API-Schlüssel ab. **Szenen-Aktionen**: jetzt eine Route berechnen, jetzt eine Strecke messen.
- Drei **Dashboard-Widgets**: die Fahrzeiten der Strecken, eine Strecke, die Anfragen des Monats.

![Die drei Widgets der Integration: Fahrzeiten der Strecken, eine Strecke und Anfragen des Monats (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-here-travel-time/main/docs/assets/widgets.de.png)

Das Bild oben ist eine generierte Illustration, kein Screenshot. Nicht mit HERE verbunden; noch nicht mit einem echten API-Schlüssel getestet.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein **HERE-API-Schlüssel** (kostenlos im unten genannten Monatskontingent):
  1. Erstellen Sie ein Konto auf [platform.here.com](https://platform.here.com/) („Sign up“). Neue Konten sind im **Base-Tarif**: HERE verlangt bei der Anmeldung ein Zahlungsmittel und berechnet nur, was über das kostenlose Kontingent hinausgeht.
  2. Öffnen Sie den **Access Manager** über den Launcher (oben rechts), Tab **Apps**, dann **Register new app**; geben Sie einen Namen ein („Gladys“) und bestätigen Sie mit **Register**.
  3. In der App, Tab **Credentials**, wählen Sie **API Keys** und dann **Create API key**, und kopieren Sie den Schlüssel (höchstens zwei Schlüssel pro App).
- Die Zeitzone von Gladys richtig eingestellt (**Einstellungen > System**): Die Uhrzeiten der Strecken gelten in dieser Zeitzone.
- Um „zuhause“ als Ort zu nutzen: der Standort Ihres Hauses unter **Einstellungen > Häuser**. Die Integration fragt dafür bei der Installation die Berechtigung **Standort** an.

**Kosten.** HERE zählt eine Transaktion pro Anfrage und gewährt im Base-Tarif jeden Monat ein kostenloses Kontingent pro Anfrageart ([HERE-Preise](https://www.here.com/get-started/pricing), abgerufen am 26. Oktober 2026):

| Anfrageart                                           | Kostenlos pro Monat | Danach, pro 1.000 |
| ---------------------------------------------------- | ------------------- | ----------------- |
| Auto mit Live-Verkehr („Time-aware routing“)         | 5.000               | 2,92 USD          |
| Auto ohne Verkehr, Fahrrad, zu Fuß („Routing“)       | 30.000              | 0,88 USD          |
| Lkw                                                  | 5.000               | 2,92 USD          |
| Roller / Motorrad                                    | 5.000               | 2,92 USD          |
| Öffentliche Verkehrsmittel                           | 5.000               | 2,92 USD          |
| Geocodierung (eine Adresse in Koordinaten, einmalig) | 30.000              | 0,88 USD          |

Eine Autostrecke, die montags bis freitags von 6 bis 21 Uhr alle 15 Minuten gemessen wird, verbraucht etwa 1.300 Anfragen im Monat. Standardmäßig bleibt die Integration unter 90 % jedes kostenlosen Kontingents und misst seltener, statt es zu überschreiten. Das kostenlose Kontingent gehört zum HERE-Konto: Andere Apps des Kontos zählen mit.

## Konfiguration

Die Strecken werden nicht als JSON eingegeben: Jede ist ein kleines Formular hinter den Schaltflächen unten auf der Konfigurationsseite.

| Feld oder Schaltfläche        | Beschreibung                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HERE-API-Schlüssel            | Erforderlich. Von Gladys geheim gehalten, nie wieder angezeigt und nie in die Protokolle geschrieben.                                                                                                            |
| Standardintervall             | Minuten zwischen zwei Messungen einer Strecke ohne eigenes Intervall (5 bis 240, standardmäßig 15).                                                                                                              |
| Standard-Verzögerungsschwelle | Verkehrsverzögerung in Minuten, ab der eine Strecke in den Widgets rot erscheint (orange ab 3 Minuten). Standardmäßig 10.                                                                                        |
| Monatsbudget                  | Anteil des kostenlosen Kontingents jeder Anfrageart, den die Integration verbrauchen darf. Standardmäßig 90; über 100 berechnet HERE die zusätzlichen Anfragen.                                                  |
| Sprache der Texte             | Funktionsnamen, Routentexte, Szenen-Zusammenfassungen, Meldungen der Schaltflächen, bei HERE angefragte Sprache. **Wählen Sie sie vor dem Hinzufügen der Geräte**: Ein Gerät behält die Namen seiner Erstellung. |
| Strecke hinzufügen            | Name, Start, Ziel, Fortbewegungsart, Live-Verkehr (Auto), Maut / Autobahnen / Fähren meiden, Tage, Uhrzeiten („6-10, 16-20“, leer: 6-21), eigenes Intervall und eigene Schwelle. Die Orte werden sofort geprüft. |
| Strecke ändern                | Die Strecke über ihren Namen oder ihre Nummer (#2); nur ausgefüllte Felder ändern sich. 0 setzt Intervall oder Schwelle auf den Standard zurück.                                                                 |
| Strecke entfernen             | Die Strecke über ihren Namen oder ihre Nummer. Ihr Gerät bleibt in Gladys, bis Sie es löschen.                                                                                                                   |
| Strecken auflisten            | Jede Strecke mit ihrem Zeitplan, den geplanten Anfragen, ihrer letzten Messung und ihrem letzten Fehler, sowie die Anfragen des Monats.                                                                          |
| API-Schlüssel testen          | Berechnet einen kurzen Fußweg in Paris aus Koordinaten (eine „Routing“-Anfrage) und sagt, was zu korrigieren ist, wenn HERE den Schlüssel ablehnt.                                                               |

Start und Ziel akzeptieren:

- eine **Adresse** oder einen Ortsnamen („Hauptbahnhof, München“): HERE wandelt sie **einmal** in Koordinaten um (eine Geocodierungs-Anfrage), danach behält die Integration sie;
- **Koordinaten** „Breite, Länge“, wie `48.1402, 11.5600` (ohne Geocodierung);
- **zuhause** (oder `home`, `maison`, `domicile`, `casa`, `hogar`): das erste Haus von Gladys mit Standort;
- **@Name**: das Haus von Gladys mit diesem Namen, wie `@Chalet`.

## Verwendung

### Strecken

1. Fügen Sie den API-Schlüssel ein und drücken Sie **API-Schlüssel testen**.
2. Drücken Sie **Strecke hinzufügen** für jede übliche Strecke. Die Antwort zeigt die Orte so, wie HERE sie verstanden hat: Prüfen Sie sie. Standard ist eine Autostrecke werktags von 6 bis 21 Uhr alle 15 Minuten: Passen Sie Tage und Uhrzeiten an.
3. Die erste Messung kommt innerhalb einer Minute, wenn die Strecke in ihren Uhrzeiten ist. Außerhalb behält die Strecke ihre letzte Messung.

Eine **Auto**strecke nutzt standardmäßig Live-Verkehr. Schalten Sie **Live-Verkehr (Auto)** für eine Strecke ab, deren Verzögerung unwichtig ist: Sie zählt dann zu den 30.000 kostenlosen „Routing“-Anfragen statt zu den 5.000 „Routing mit Verkehr“. Eine **Roller / Motorrad**-Strecke nutzt Autobahnen, außer **Autobahnen meiden** ist aktiviert.

### Geräte

Öffnen Sie den Tab **Entdecken** und fügen Sie die gewünschten Strecken hinzu. Jedes Gerät hat:

- **Fahrzeit mit Verkehr** (Minuten; „Fahrzeit“ ohne Live-Verkehr). Im ÖPNV: von Tür zu Tür, vom ersten Aufbruch zu Fuß bis zur Ankunft, Wartezeiten inbegriffen;
- **Fahrzeit ohne Verkehr** und **Verkehrsverzögerung** (Minuten; Strecken mit Live-Verkehr);
- **Entfernung** (km) und **Route**: die Hauptstraßen (wie „A9, A99“), oder im ÖPNV die Linien und Zeiten (wie „Bus C1 → Métro B · 07:49–08:16“).

Die Werte folgen den Messungen der Strecke; Gladys speichert ihren Verlauf.

### Dashboard-Widgets

- **Fahrzeiten**: die Strecken mit Fahrzeit, Entfernung und Straßen oder Linien, ein Verzögerungs-Badge (grün, orange ab 3 Minuten, rot ab der Schwelle der Strecke; im ÖPNV die Zeit der ersten Abfahrt oder die gemeldete Echtzeit-Verspätung), ein Link zur Route auf HERE WeGo und **Alle aktualisieren**.
- **Strecke**: eine Strecke, aus den Geräten gewählt: bis zu vier Kacheln, Route, Zeiten im ÖPNV, letzte Messung, **Aktualisieren**.
- **HERE-Anfragen**: eine Anzeige je genutzter Anfrageart (höchstens fünf), was die Strecken im Monat planen, der Zustand des Schlüssels.

Eine Aktualisieren-Schaltfläche verbraucht eine Anfrage pro Strecke, keine für eine vor weniger als einer Minute gemessene Strecke.

### Szenen

Auslöser der Integration:

- **Die Route einer Strecke ändert sich**: Bei einer geplanten Messung führt die schnellste Route über andere Straßen (oder andere Linien) als bei der vorherigen. Variablen: Name, Route, vorherige Route, Fahrzeit, Verzögerung, Entfernung, Zusammenfassung.
- **Das Monatsbudget ist fast verbraucht**: Eine Anfrageart erreicht 80 %, dann 100 % ihres Budgets (jeweils einmal im Monat).
- **HERE lehnt den API-Schlüssel ab**: einmal, bis eine Anfrage wieder funktioniert; die Zusammenfassung sagt, was zu tun ist.

Für eine Schwelle („die Verzögerung übersteigt 10 Minuten“, „die Fahrzeit übersteigt 40 Minuten“) nutzen Sie den **Geräte-Auslöser** von Gladys auf der Funktion der Strecke.

Aktionen: **Route berechnen** (zwei beliebige Orte, jetzt) und **Strecke jetzt messen** (auch außerhalb ihrer Uhrzeiten). Beide liefern Fahrzeit, Fahrzeit ohne Verkehr, Verzögerung, Entfernung, Route, Abfahrts- und Ankunftszeit und einen Satz wie „Arbeit: 38 Min., davon 14 Min. Verkehr, 11,8 km über M6, A6.“ zum Versenden in einer Nachricht.

Beispiele:

- Wenn die Verzögerung von „Arbeit“ 10 Minuten übersteigt → die Zusammenfassung der Strecke senden.
- Jeden Werktag um 7:15 → „Büro (ÖPNV)“ jetzt messen → `{{0.0.summary}}` (Linien, erste Abfahrt, Umstiege, Verspätung) an die Familie senden.
- Wenn sich die Route von „Flughafen“ ändert → eine Nachricht senden: Unfall oder gesperrte Straße auf dem üblichen Weg.

### Transport

Die Integration nutzt die Server von HERE (Cloud): **Die Koordinaten Ihrer Strecken werden bei jeder Messung an HERE gesendet**, eine Adresse einmalig bei ihrer Geocodierung, mit Ihrem API-Schlüssel in der Anfrage. Die Strecken werden in der Konfiguration von Gladys gespeichert; die letzten Messungen, der Anfragezähler und die geocodierten Adressen im Volume `/data` der Integration.

## Fehlerbehebung

- **„HERE lehnt den API-Schlüssel ab“**: `API_KEY_INVALID` — kopieren Sie den Schlüssel erneut aus dem Tab Credentials der App (ein gelöschter oder deaktivierter Schlüssel wird ebenfalls abgelehnt); `API_KEY_MISSING` — kein Schlüssel kam bei HERE an; `FORBIDDEN` — der Schlüssel ist gültig, darf den Dienst aber nicht nutzen: Prüfen Sie, ob das Konto im Base-Tarif ist (Zahlungsmittel hinterlegt) und die App aktiviert ist. Die Integration versucht es stündlich erneut, und sofort nach **API-Schlüssel testen** oder einem neuen Schlüssel.
- **„HERE kennt die Adresse nicht“**: Ergänzen Sie Ort und Land oder geben Sie Koordinaten ein.
- **Eine Strecke hat keine Messung**: Prüfen Sie Tage und Uhrzeiten mit **Strecken auflisten** (die angezeigte Zeitzone muss Ihre sein) und den letzten Fehler. `noRouteFound`, `couldNotMatchOrigin`, `couldNotMatchDestination`: keine Straße für diese Art nahe einem Ort (setzen Sie den Punkt auf eine Straße); `noCoverage`, `noStationsFound`: keine ÖPNV-Daten rund um die Orte.
- **Seltenere Messungen als das Intervall**: „gestreckt … um im Budget zu bleiben“ in **Strecken auflisten** bedeutet, dass die Strecken dieser Anfrageart mehr als das Budget planen; reduzieren Sie Uhrzeiten, Strecken oder Intervall, oder erhöhen Sie das Budget.
- **„Die Anfragen des Monats sind verbraucht“**: Das Budget dieser Anfrageart ist erreicht; die betroffenen Strecken warten auf den nächsten Monat (UTC). Maßgeblich ist die Zählung von HERE auf platform.here.com.
- **429**: HERE begrenzt die Anfragen des Schlüssels; die Integration wartet 15 Minuten.
- Um ein Problem zu melden, geben Sie die Versionen von Gladys und der Integration, den Text von **Strecken auflisten** (Adressen gern ausblenden) und die Protokolle der Integration (Einstellungen → Überwachung) an. Fügen Sie nie Ihren API-Schlüssel ein.
