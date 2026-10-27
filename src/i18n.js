// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature names, widget contents, scene summaries, messages of the
// Configuration screen. Vocabulary of the Gladys interface: appareil / Gerät /
// dispositivo, scène / Szene / escena, Découverte / Entdecken / Descubrir.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // travel modes
  mode_car: { en: 'Car', fr: 'Voiture', de: 'Auto', es: 'Coche' },
  mode_truck: { en: 'Truck', fr: 'Camion', de: 'Lkw', es: 'Camión' },
  mode_scooter: {
    en: 'Scooter / motorcycle',
    fr: 'Scooter / moto',
    de: 'Roller / Motorrad',
    es: 'Scooter / moto',
  },
  mode_bicycle: { en: 'Bicycle', fr: 'Vélo', de: 'Fahrrad', es: 'Bicicleta' },
  mode_pedestrian: { en: 'Walking', fr: 'À pied', de: 'Zu Fuß', es: 'A pie' },
  mode_transit: {
    en: 'Public transport',
    fr: 'Transports en commun',
    de: 'Öffentliche Verkehrsmittel',
    es: 'Transporte público',
  },
  days_every_day: { en: 'every day', fr: 'tous les jours', de: 'täglich', es: 'todos los días' },
  days_weekdays: {
    en: 'Monday to Friday',
    fr: 'du lundi au vendredi',
    de: 'Montag bis Freitag',
    es: 'de lunes a viernes',
  },
  days_weekend: {
    en: 'weekends',
    fr: 'le week-end',
    de: 'am Wochenende',
    es: 'los fines de semana',
  },
  days_mon_sat: {
    en: 'Monday to Saturday',
    fr: 'du lundi au samedi',
    de: 'Montag bis Samstag',
    es: 'de lunes a sábado',
  },
  sku_time_aware: {
    en: 'Time-aware routing',
    fr: 'Routage avec trafic',
    de: 'Routing mit Verkehr',
    es: 'Rutas con tráfico',
  },
  sku_routing: { en: 'Routing', fr: 'Routage', de: 'Routing', es: 'Rutas' },
  sku_truck: { en: 'Truck', fr: 'Camion', de: 'Lkw', es: 'Camión' },
  sku_scooter: { en: 'Scooter', fr: 'Scooter', de: 'Roller', es: 'Scooter' },
  sku_transit: {
    en: 'Public transit',
    fr: 'Transports en commun',
    de: 'ÖPNV',
    es: 'Transporte público',
  },
  sku_geocode: { en: 'Geocoding', fr: 'Géocodage', de: 'Geocodierung', es: 'Geocodificación' },
  // short names of the SKUs, for the gauges (24 characters with the budget)
  skuShort_time_aware: { en: 'Traffic', fr: 'Trafic', de: 'Verkehr', es: 'Tráfico' },
  skuShort_routing: { en: 'Routing', fr: 'Routage', de: 'Routing', es: 'Rutas' },
  skuShort_truck: { en: 'Truck', fr: 'Camion', de: 'Lkw', es: 'Camión' },
  skuShort_scooter: { en: 'Scooter', fr: 'Scooter', de: 'Roller', es: 'Scooter' },
  skuShort_transit: { en: 'Transit', fr: 'Transports', de: 'ÖPNV', es: 'Transporte' },
  skuShort_geocode: { en: 'Geocoding', fr: 'Géocodage', de: 'Geocoding', es: 'Geocodif.' },
  noLiveTraffic: {
    en: 'no live traffic',
    fr: 'sans trafic en temps réel',
    de: 'ohne Live-Verkehr',
    es: 'sin tráfico en tiempo real',
  },

  // features
  featureDurationTraffic: {
    en: 'Travel time with traffic',
    fr: 'Durée avec trafic',
    de: 'Fahrzeit mit Verkehr',
    es: 'Duración con tráfico',
  },
  featureDuration: { en: 'Travel time', fr: 'Durée du trajet', de: 'Fahrzeit', es: 'Duración' },
  featureDurationNoTraffic: {
    en: 'Travel time without traffic',
    fr: 'Durée sans trafic',
    de: 'Fahrzeit ohne Verkehr',
    es: 'Duración sin tráfico',
  },
  featureDelay: {
    en: 'Traffic delay',
    fr: 'Retard dû au trafic',
    de: 'Verkehrsverzögerung',
    es: 'Retraso por tráfico',
  },
  featureDistance: { en: 'Distance', fr: 'Distance', de: 'Entfernung', es: 'Distancia' },
  featureRoute: { en: 'Route', fr: 'Itinéraire', de: 'Route', es: 'Ruta' },

  // units and times
  unitMin: { en: 'min', fr: 'min', de: 'Min.', es: 'min' },
  unitKm: { en: 'km', fr: 'km', de: 'km', es: 'km' },
  unitMi: { en: 'mi', fr: 'mi', de: 'mi', es: 'mi' },
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },
  viaRoute: { en: 'via {route}', fr: 'par {route}', de: 'über {route}', es: 'por {route}' },
  delayBadge: { en: '+{n} min', fr: '+{n} min', de: '+{n} Min.', es: '+{n} min' },
  onTime: { en: 'Fluid', fr: 'Fluide', de: 'Frei', es: 'Fluido' },
  offHours: { en: 'Off hours', fr: 'Hors plage', de: 'Außer Zeit', es: 'Fuera de hora' },
  noReading: { en: 'No reading', fr: 'Aucune mesure', de: 'Kein Wert', es: 'Sin dato' },
  leaveAt: { en: 'At {time}', fr: 'À {time}', de: 'Um {time}', es: 'A las {time}' },
  transitLine: {
    en: 'First departure {departure}, arrival {arrival}, {changes} change(s)',
    fr: 'Premier départ {departure}, arrivée {arrival}, {changes} correspondance(s)',
    de: 'Erste Abfahrt {departure}, Ankunft {arrival}, {changes} Umstieg(e)',
    es: 'Primera salida {departure}, llegada {arrival}, {changes} transbordo(s)',
  },
  timesValue: {
    en: '{departure} → {arrival}, {changes} change(s)',
    fr: '{departure} → {arrival}, {changes} corresp.',
    de: '{departure} → {arrival}, {changes} Umstieg(e)',
    es: '{departure} → {arrival}, {changes} transb.',
  },

  // summaries (scene variables and outputs)
  summaryTraffic: {
    en: '{name}: {duration} min, {delay} min of traffic, {distance} km{route}.',
    fr: '{name} : {duration} min, dont {delay} min de trafic, {distance} km{route}.',
    de: '{name}: {duration} Min., davon {delay} Min. Verkehr, {distance} km{route}.',
    es: '{name}: {duration} min, {delay} min de tráfico, {distance} km{route}.',
  },
  summaryNoDelay: {
    en: '{name}: {duration} min, traffic is fluid, {distance} km{route}.',
    fr: '{name} : {duration} min, trafic fluide, {distance} km{route}.',
    de: '{name}: {duration} Min., freie Fahrt, {distance} km{route}.',
    es: '{name}: {duration} min, tráfico fluido, {distance} km{route}.',
  },
  summaryNoTraffic: {
    en: '{name}: {duration} min, {distance} km{route}.',
    fr: '{name} : {duration} min, {distance} km{route}.',
    de: '{name}: {duration} Min., {distance} km{route}.',
    es: '{name}: {duration} min, {distance} km{route}.',
  },
  summaryTransit: {
    en: '{name}: {duration} min, {lines}, first departure at {departure}, arrival at {arrival} ({changes} change(s)){late}, {distance} km.',
    fr: '{name} : {duration} min, {lines}, premier départ à {departure}, arrivée à {arrival} ({changes} correspondance(s)){late}, {distance} km.',
    de: '{name}: {duration} Min., {lines}, erste Abfahrt um {departure}, Ankunft um {arrival} ({changes} Umstieg(e)){late}, {distance} km.',
    es: '{name}: {duration} min, {lines}, primera salida a las {departure}, llegada a las {arrival} ({changes} transbordo(s)){late}, {distance} km.',
  },
  summaryTransitLate: {
    en: ', {n} min late',
    fr: ', {n} min de retard',
    de: ', {n} Min. Verspätung',
    es: ', {n} min de retraso',
  },
  summaryWalk: {
    en: '{name}: {duration} min on foot, no line is faster, {distance} km.',
    fr: '{name} : {duration} min à pied, aucune ligne n’est plus rapide, {distance} km.',
    de: '{name}: {duration} Min. zu Fuß, keine Linie ist schneller, {distance} km.',
    es: '{name}: {duration} min a pie, ninguna línea es más rápida, {distance} km.',
  },
  summaryRouteSuffix: {
    en: ' via {route}',
    fr: ' par {route}',
    de: ' über {route}',
    es: ' por {route}',
  },
  routeChangedSummary: {
    en: '{name}: the fastest route now goes via {route} (was {previous}): {duration} min.',
    fr: '{name} : l’itinéraire le plus rapide passe maintenant par {route} (au lieu de {previous}) : {duration} min.',
    de: '{name}: Die schnellste Route führt jetzt über {route} (statt {previous}): {duration} Min.',
    es: '{name}: la ruta más rápida pasa ahora por {route} (antes {previous}): {duration} min.',
  },
  budgetWarningSummary: {
    en: 'HERE Travel Time: {used} of the {budget} “{sku}” requests of the month are used.',
    fr: 'HERE Travel Time : {used} des {budget} requêtes « {sku} » du mois sont utilisées.',
    de: 'HERE Travel Time: {used} der {budget} Anfragen „{sku}“ des Monats sind verbraucht.',
    es: 'HERE Travel Time: se han usado {used} de las {budget} solicitudes «{sku}» del mes.',
  },
  budgetExhaustedSummary: {
    en: 'HERE Travel Time: the {budget} “{sku}” requests of the month are used, the trips concerned wait for next month.',
    fr: 'HERE Travel Time : les {budget} requêtes « {sku} » du mois sont utilisées, les trajets concernés attendent le mois prochain.',
    de: 'HERE Travel Time: Die {budget} Anfragen „{sku}“ des Monats sind verbraucht, die betroffenen Strecken warten auf den nächsten Monat.',
    es: 'HERE Travel Time: se han usado las {budget} solicitudes «{sku}» del mes, los trayectos afectados esperan al mes que viene.',
  },
  apiErrorSummary: {
    en: 'HERE Travel Time: HERE refuses the API key ({reason}). {hint}',
    fr: 'HERE Travel Time : HERE refuse la clé d’API ({reason}). {hint}',
    de: 'HERE Travel Time: HERE lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'HERE Travel Time: HERE rechaza la clave de API ({reason}). {hint}',
  },

  // what to do about a refused key
  hint_API_KEY_MISSING: {
    en: 'Type your HERE API key in the configuration.',
    fr: 'Saisissez votre clé d’API HERE dans la configuration.',
    de: 'Geben Sie Ihren HERE-API-Schlüssel in der Konfiguration ein.',
    es: 'Escriba su clave de API de HERE en la configuración.',
  },
  hint_API_KEY_INVALID: {
    en: 'Check the key: copy it again from platform.here.com (Access Manager → Apps → your app → Credentials → API Keys); a deleted or disabled key is refused too.',
    fr: 'Vérifiez la clé : copiez-la de nouveau depuis platform.here.com (Access Manager → Apps → votre application → Credentials → API Keys) ; une clé supprimée ou désactivée est refusée aussi.',
    de: 'Prüfen Sie den Schlüssel: Kopieren Sie ihn erneut von platform.here.com (Access Manager → Apps → Ihre App → Credentials → API Keys); ein gelöschter oder deaktivierter Schlüssel wird ebenfalls abgelehnt.',
    es: 'Compruebe la clave: cópiela de nuevo desde platform.here.com (Access Manager → Apps → su aplicación → Credentials → API Keys); una clave eliminada o desactivada también se rechaza.',
  },
  hint_FORBIDDEN: {
    en: 'The key is valid but not allowed to use this service: check that your HERE account is on the Base plan (payment method entered) and that the app of the key is enabled.',
    fr: 'La clé est valide mais n’a pas le droit d’utiliser ce service : vérifiez que votre compte HERE est sur le plan Base (moyen de paiement saisi) et que l’application de la clé est active.',
    de: 'Der Schlüssel ist gültig, darf diesen Dienst aber nicht nutzen: Prüfen Sie, ob Ihr HERE-Konto im Base-Tarif ist (Zahlungsmittel hinterlegt) und die App des Schlüssels aktiviert ist.',
    es: 'La clave es válida pero no puede usar este servicio: compruebe que su cuenta HERE está en el plan Base (método de pago introducido) y que la aplicación de la clave está activa.',
  },
  hint_default: {
    en: 'Check the key and the HERE account on platform.here.com.',
    fr: 'Vérifiez la clé et le compte HERE sur platform.here.com.',
    de: 'Prüfen Sie den Schlüssel und das HERE-Konto auf platform.here.com.',
    es: 'Compruebe la clave y la cuenta HERE en platform.here.com.',
  },

  // connection status (Configuration screen)
  statusNoKey: {
    en: 'Type your HERE API key, then add a trip with “Add a trip”.',
    fr: 'Saisissez votre clé d’API HERE, puis ajoutez un trajet avec « Ajouter un trajet ».',
    de: 'Geben Sie Ihren HERE-API-Schlüssel ein und fügen Sie dann mit „Strecke hinzufügen“ eine Strecke hinzu.',
    es: 'Escriba su clave de API de HERE y añada un trayecto con «Añadir un trayecto».',
  },
  statusEmpty: {
    en: 'No trip yet: use “Add a trip”.',
    fr: 'Aucun trajet pour l’instant : utilisez « Ajouter un trajet ».',
    de: 'Noch keine Strecke: Verwenden Sie „Strecke hinzufügen“.',
    es: 'Todavía no hay trayectos: use «Añadir un trayecto».',
  },
  statusOk: {
    en: '{count} trip(s). This month: {usage}.',
    fr: '{count} trajet(s). Ce mois-ci : {usage}.',
    de: '{count} Strecke(n). Diesen Monat: {usage}.',
    es: '{count} trayecto(s). Este mes: {usage}.',
  },
  statusUsage: {
    en: '{used} / {budget} “{sku}” requests',
    fr: '{used} / {budget} requêtes « {sku} »',
    de: '{used} / {budget} Anfragen „{sku}“',
    es: '{used} / {budget} solicitudes «{sku}»',
  },
  statusNoUsage: {
    en: 'no request yet',
    fr: 'aucune requête pour l’instant',
    de: 'noch keine Anfrage',
    es: 'ninguna solicitud todavía',
  },
  statusKeyError: {
    en: 'HERE refuses the API key ({reason}). {hint}',
    fr: 'HERE refuse la clé d’API ({reason}). {hint}',
    de: 'HERE lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'HERE rechaza la clave de API ({reason}). {hint}',
  },

  // configuration buttons
  added: {
    en: 'Added: {line}\nNow open the Discover tab to add it as a device.',
    fr: 'Ajouté : {line}\nOuvrez maintenant l’onglet Découverte pour l’ajouter comme appareil.',
    de: 'Hinzugefügt: {line}\nÖffnen Sie jetzt den Tab Entdecken, um sie als Gerät hinzuzufügen.',
    es: 'Añadido: {line}\nAbra ahora la pestaña Descubrir para añadirlo como dispositivo.',
  },
  edited: {
    en: 'Changed: {line}',
    fr: 'Modifié : {line}',
    de: 'Geändert: {line}',
    es: 'Modificado: {line}',
  },
  placesLine: {
    en: '\nFrom: {from}\nTo: {to}',
    fr: '\nDépart : {from}\nArrivée : {to}',
    de: '\nStart: {from}\nZiel: {to}',
    es: '\nOrigen: {from}\nDestino: {to}',
  },
  editedFeatures: {
    en: '\nThe travel mode or the live traffic changes the features: click “Update” on the Discover tab.',
    fr: '\nLe mode de déplacement ou le trafic en temps réel change les fonctionnalités : cliquez sur « Mettre à jour » dans l’onglet Découverte.',
    de: '\nDie Fortbewegungsart oder der Live-Verkehr ändert die Funktionen: Klicken Sie im Tab Entdecken auf „Aktualisieren“.',
    es: '\nEl modo de transporte o el tráfico en tiempo real cambia las funciones: pulse «Actualizar» en la pestaña Descubrir.',
  },
  removed: {
    en: 'Removed: {name}. Its device stays in Gladys until you delete it.',
    fr: 'Supprimé : {name}. Son appareil reste dans Gladys jusqu’à ce que vous le supprimiez.',
    de: 'Entfernt: {name}. Sein Gerät bleibt in Gladys, bis Sie es löschen.',
    es: 'Eliminado: {name}. Su dispositivo permanece en Gladys hasta que lo elimine.',
  },
  listEmpty: {
    en: 'No trip yet: use “Add a trip”.',
    fr: 'Aucun trajet pour l’instant : utilisez « Ajouter un trajet ».',
    de: 'Noch keine Strecke: Verwenden Sie „Strecke hinzufügen“.',
    es: 'Todavía no hay trayectos: use «Añadir un trayecto».',
  },
  listHeader: {
    en: '{count} trip(s), timezone {timezone}. This month: {usage}.',
    fr: '{count} trajet(s), fuseau horaire {timezone}. Ce mois-ci : {usage}.',
    de: '{count} Strecke(n), Zeitzone {timezone}. Diesen Monat: {usage}.',
    es: '{count} trayecto(s), zona horaria {timezone}. Este mes: {usage}.',
  },
  listLine: {
    en: '#{n} {name} — {mode}{avoid}, {days}, {hours}, every {interval} min (≈ {planned} requests a month) — last reading: {last}',
    fr: '#{n} {name} — {mode}{avoid}, {days}, {hours}, toutes les {interval} min (≈ {planned} requêtes par mois) — dernière mesure : {last}',
    de: '#{n} {name} — {mode}{avoid}, {days}, {hours}, alle {interval} Min. (≈ {planned} Anfragen im Monat) — letzte Messung: {last}',
    es: '#{n} {name} — {mode}{avoid}, {days}, {hours}, cada {interval} min (≈ {planned} solicitudes al mes) — última medida: {last}',
  },
  listStretched: {
    en: ' (stretched from {interval} min to stay within the budget)',
    fr: ' (allongé depuis {interval} min pour rester dans le budget)',
    de: ' (von {interval} Min. gestreckt, um im Budget zu bleiben)',
    es: ' (alargado desde {interval} min para no salir del presupuesto)',
  },
  listError: {
    en: ' — last error: {message}',
    fr: ' — dernière erreur : {message}',
    de: ' — letzter Fehler: {message}',
    es: ' — último error: {message}',
  },
  avoidTolls: { en: 'no tolls', fr: 'sans péage', de: 'ohne Maut', es: 'sin peajes' },
  avoidHighways: {
    en: 'no motorways',
    fr: 'sans autoroute',
    de: 'ohne Autobahn',
    es: 'sin autopistas',
  },
  avoidFerries: { en: 'no ferries', fr: 'sans ferry', de: 'ohne Fähre', es: 'sin ferris' },
  testOk: {
    en: 'The key works. Test walk, Eiffel Tower → Louvre: {duration} min, {distance} km (1 request “{sku}”).',
    fr: 'La clé fonctionne. Trajet de test à pied, tour Eiffel → Louvre : {duration} min, {distance} km (1 requête « {sku} »).',
    de: 'Der Schlüssel funktioniert. Testweg zu Fuß, Eiffelturm → Louvre: {duration} Min., {distance} km (1 Anfrage „{sku}“).',
    es: 'La clave funciona. Ruta de prueba a pie, torre Eiffel → Louvre: {duration} min, {distance} km (1 solicitud «{sku}»).',
  },

  // errors
  errorName: {
    en: 'The name is required (at most {max} characters).',
    fr: 'Le nom est obligatoire ({max} caractères au maximum).',
    de: 'Der Name ist erforderlich (höchstens {max} Zeichen).',
    es: 'El nombre es obligatorio ({max} caracteres como máximo).',
  },
  errorOrigin: {
    en: 'The starting point is required (an address, “latitude, longitude”, “home” or “@house name”, at most {max} characters).',
    fr: 'Le départ est obligatoire (une adresse, « latitude, longitude », « maison » ou « @nom de la maison », {max} caractères au maximum).',
    de: 'Der Startpunkt ist erforderlich (eine Adresse, „Breite, Länge“, „zuhause“ oder „@Name des Hauses“, höchstens {max} Zeichen).',
    es: 'El origen es obligatorio (una dirección, «latitud, longitud», «casa» o «@nombre de la casa», {max} caracteres como máximo).',
  },
  errorDestination: {
    en: 'The destination is required (an address, “latitude, longitude”, “home” or “@house name”, at most {max} characters).',
    fr: 'L’arrivée est obligatoire (une adresse, « latitude, longitude », « maison » ou « @nom de la maison », {max} caractères au maximum).',
    de: 'Das Ziel ist erforderlich (eine Adresse, „Breite, Länge“, „zuhause“ oder „@Name des Hauses“, höchstens {max} Zeichen).',
    es: 'El destino es obligatorio (una dirección, «latitud, longitud», «casa» o «@nombre de la casa», {max} caracteres como máximo).',
  },
  errorSamePlace: {
    en: 'The starting point and the destination are the same.',
    fr: 'Le départ et l’arrivée sont identiques.',
    de: 'Startpunkt und Ziel sind gleich.',
    es: 'El origen y el destino son iguales.',
  },
  errorChoice: {
    en: 'Unknown choice: {value}.',
    fr: 'Choix inconnu : {value}.',
    de: 'Unbekannte Auswahl: {value}.',
    es: 'Opción desconocida: {value}.',
  },
  errorHours: {
    en: 'Hours not understood: write ranges such as “6-10, 16-20” or “7:30-9” (four at most; “0-24”: all day).',
    fr: 'Heures non comprises : écrivez des plages comme « 6-10, 16-20 » ou « 7:30-9 » (quatre au maximum ; « 0-24 » : toute la journée).',
    de: 'Uhrzeiten nicht verstanden: Schreiben Sie Bereiche wie „6-10, 16-20“ oder „7:30-9“ (höchstens vier; „0-24“: ganzer Tag).',
    es: 'Horas no entendidas: escriba franjas como «6-10, 16-20» o «7:30-9» (cuatro como máximo; «0-24»: todo el día).',
  },
  errorInterval: {
    en: 'The interval is a whole number of minutes from {min} to {max}.',
    fr: 'L’intervalle est un nombre entier de minutes de {min} à {max}.',
    de: 'Das Intervall ist eine ganze Zahl von Minuten von {min} bis {max}.',
    es: 'El intervalo es un número entero de minutos de {min} a {max}.',
  },
  errorThreshold: {
    en: 'The delay threshold is a whole number of minutes from {min} to {max}.',
    fr: 'Le seuil de retard est un nombre entier de minutes de {min} à {max}.',
    de: 'Die Verzögerungsschwelle ist eine ganze Zahl von Minuten von {min} bis {max}.',
    es: 'El umbral de retraso es un número entero de minutos de {min} a {max}.',
  },
  errorTarget: {
    en: 'Which trip? Type its name or its number (#2).',
    fr: 'Quel trajet ? Saisissez son nom ou son numéro (#2).',
    de: 'Welche Strecke? Geben Sie ihren Namen oder ihre Nummer ein (#2).',
    es: '¿Qué trayecto? Escriba su nombre o su número (#2).',
  },
  errorAmbiguous: {
    en: 'Several trips are called “{query}”: use their number ({numbers}).',
    fr: 'Plusieurs trajets s’appellent « {query} » : utilisez leur numéro ({numbers}).',
    de: 'Mehrere Strecken heißen „{query}“: Verwenden Sie ihre Nummer ({numbers}).',
    es: 'Varios trayectos se llaman «{query}»: use su número ({numbers}).',
  },
  errorNotFound: {
    en: 'No trip “{query}”: see “List the trips”.',
    fr: 'Aucun trajet « {query} » : voir « Lister les trajets ».',
    de: 'Keine Strecke „{query}“: siehe „Strecken auflisten“.',
    es: 'Ningún trayecto «{query}»: vea «Listar los trayectos».',
  },
  errorFull: {
    en: 'At most {max} trips.',
    fr: '{max} trajets au maximum.',
    de: 'Höchstens {max} Strecken.',
    es: '{max} trayectos como máximo.',
  },
  errorSave: {
    en: 'Gladys could not save the trips: {message}',
    fr: 'Gladys n’a pas pu enregistrer les trajets : {message}',
    de: 'Gladys konnte die Strecken nicht speichern: {message}',
    es: 'Gladys no pudo guardar los trayectos: {message}',
  },
  errorBudget: {
    en: 'The {budget} “{sku}” requests of the month are used: next readings next month (or raise the budget in the configuration).',
    fr: 'Les {budget} requêtes « {sku} » du mois sont utilisées : prochaines mesures le mois prochain (ou augmentez le budget dans la configuration).',
    de: 'Die {budget} Anfragen „{sku}“ des Monats sind verbraucht: nächste Messungen im nächsten Monat (oder erhöhen Sie das Budget in der Konfiguration).',
    es: 'Se han usado las {budget} solicitudes «{sku}» del mes: próximas medidas el mes que viene (o aumente el presupuesto en la configuración).',
  },
  errorAddress: {
    en: 'HERE does not know the address “{address}”: add the town and the country, or type “latitude, longitude”.',
    fr: 'HERE ne connaît pas l’adresse « {address} » : ajoutez la ville et le pays, ou saisissez « latitude, longitude ».',
    de: 'HERE kennt die Adresse „{address}“ nicht: Ergänzen Sie Ort und Land oder geben Sie „Breite, Länge“ ein.',
    es: 'HERE no conoce la dirección «{address}»: añada la ciudad y el país, o escriba «latitud, longitud».',
  },
  errorNoHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses, or type an address.',
    fr: 'Aucune maison de Gladys n’a d’emplacement : réglez-le dans Paramètres → Maisons, ou saisissez une adresse.',
    de: 'Kein Haus von Gladys hat einen Standort: Legen Sie ihn unter Einstellungen → Häuser fest oder geben Sie eine Adresse ein.',
    es: 'Ninguna casa de Gladys tiene ubicación: configúrela en Ajustes → Casas, o escriba una dirección.',
  },
  errorUnknownHouse: {
    en: 'No house of Gladys is called “{name}”.',
    fr: 'Aucune maison de Gladys ne s’appelle « {name} ».',
    de: 'Kein Haus von Gladys heißt „{name}“.',
    es: 'Ninguna casa de Gladys se llama «{name}».',
  },
  errorHouseNoLocation: {
    en: 'The house “{name}” has no location: set it in Settings → Houses.',
    fr: 'La maison « {name} » n’a pas d’emplacement : réglez-le dans Paramètres → Maisons.',
    de: 'Das Haus „{name}“ hat keinen Standort: Legen Sie ihn unter Einstellungen → Häuser fest.',
    es: 'La casa «{name}» no tiene ubicación: configúrela en Ajustes → Casas.',
  },
  errorTrip: {
    en: 'HERE found no route for this trip: check the places and the travel mode ({message}).',
    fr: 'HERE n’a trouvé aucun itinéraire pour ce trajet : vérifiez les lieux et le mode de déplacement ({message}).',
    de: 'HERE hat keine Route für diese Strecke gefunden: Prüfen Sie die Orte und die Fortbewegungsart ({message}).',
    es: 'HERE no encontró ninguna ruta para este trayecto: compruebe los lugares y el modo de transporte ({message}).',
  },
  errorQuota: {
    en: 'HERE limits the requests of the key (429): the integration waits 15 minutes.',
    fr: 'HERE limite les requêtes de la clé (429) : l’intégration attend 15 minutes.',
    de: 'HERE begrenzt die Anfragen des Schlüssels (429): Die Integration wartet 15 Minuten.',
    es: 'HERE limita las solicitudes de la clave (429): la integración espera 15 minutos.',
  },
  errorUnreachable: {
    en: 'HERE cannot be reached: {message}',
    fr: 'HERE est injoignable : {message}',
    de: 'HERE ist nicht erreichbar: {message}',
    es: 'No se puede acceder a HERE: {message}',
  },
  errorTooSoon: {
    en: 'Read {n} s ago: the reading is kept to save requests.',
    fr: 'Mesuré il y a {n} s : la mesure est gardée pour économiser les requêtes.',
    de: 'Vor {n} s gemessen: Die Messung wird behalten, um Anfragen zu sparen.',
    es: 'Medido hace {n} s: se conserva la medida para ahorrar solicitudes.',
  },
  errorUnknownDevice: {
    en: 'This device is not one of the trips of the integration.',
    fr: 'Cet appareil n’est pas un des trajets de l’intégration.',
    de: 'Dieses Gerät ist keine Strecke der Integration.',
    es: 'Este dispositivo no es uno de los trayectos de la integración.',
  },

  // widgets
  widgetNoKey: {
    en: 'Type your HERE API key in the configuration of the integration.',
    fr: 'Saisissez votre clé d’API HERE dans la configuration de l’intégration.',
    de: 'Geben Sie Ihren HERE-API-Schlüssel in der Konfiguration der Integration ein.',
    es: 'Escriba su clave de API de HERE en la configuración de la integración.',
  },
  widgetEmpty: {
    en: 'No trip yet: add one with “Add a trip” in the configuration of the integration.',
    fr: 'Aucun trajet pour l’instant : ajoutez-en un avec « Ajouter un trajet » dans la configuration de l’intégration.',
    de: 'Noch keine Strecke: Fügen Sie eine mit „Strecke hinzufügen“ in der Konfiguration der Integration hinzu.',
    es: 'Todavía no hay trayectos: añada uno con «Añadir un trayecto» en la configuración de la integración.',
  },
  widgetChooseTrip: {
    en: 'Choose a trip in the settings of the widget.',
    fr: 'Choisissez un trajet dans les réglages du widget.',
    de: 'Wählen Sie eine Strecke in den Einstellungen des Widgets.',
    es: 'Elija un trayecto en los ajustes del widget.',
  },
  widgetUnknownTrip: {
    en: 'This trip no longer exists: choose another one in the settings of the widget.',
    fr: 'Ce trajet n’existe plus : choisissez-en un autre dans les réglages du widget.',
    de: 'Diese Strecke gibt es nicht mehr: Wählen Sie eine andere in den Einstellungen des Widgets.',
    es: 'Este trayecto ya no existe: elija otro en los ajustes del widget.',
  },
  widgetNoReading: {
    en: 'No reading yet: the trip is read on its days and hours ({days}, {hours}), or with the button.',
    fr: 'Aucune mesure pour l’instant : le trajet est mesuré sur ses jours et heures ({days}, {hours}), ou avec le bouton.',
    de: 'Noch keine Messung: Die Strecke wird an ihren Tagen und Stunden gemessen ({days}, {hours}) oder mit der Schaltfläche.',
    es: 'Todavía no hay medida: el trayecto se mide en sus días y horas ({days}, {hours}), o con el botón.',
  },
  tripsCaption: {
    en: 'Updated {updated}',
    fr: 'Mis à jour {updated}',
    de: 'Aktualisiert {updated}',
    es: 'Actualizado {updated}',
  },
  tileDuration: { en: 'Travel time', fr: 'Durée', de: 'Fahrzeit', es: 'Duración' },
  tileDelay: { en: 'Traffic delay', fr: 'Retard trafic', de: 'Verzögerung', es: 'Retraso' },
  tileNoTraffic: {
    en: 'Without traffic',
    fr: 'Sans trafic',
    de: 'Ohne Verkehr',
    es: 'Sin tráfico',
  },
  tileDistance: { en: 'Distance', fr: 'Distance', de: 'Entfernung', es: 'Distancia' },
  statusRoute: { en: 'Route', fr: 'Itinéraire', de: 'Route', es: 'Ruta' },
  statusMode: { en: 'Travel mode', fr: 'Mode', de: 'Fortbewegung', es: 'Modo' },
  statusTimes: { en: 'Times', fr: 'Horaires', de: 'Zeiten', es: 'Horario' },
  statusUpdated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  statusSchedule: { en: 'Read', fr: 'Mesuré', de: 'Gemessen', es: 'Medido' },
  statusError: {
    en: 'Last error',
    fr: 'Dernière erreur',
    de: 'Letzter Fehler',
    es: 'Último error',
  },
  buttonRefresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  buttonRefreshAll: {
    en: 'Refresh all',
    fr: 'Tout actualiser',
    de: 'Alle aktualisieren',
    es: 'Actualizar todo',
  },
  toastRefreshed: {
    en: 'Refreshed: {summary}',
    fr: 'Actualisé : {summary}',
    de: 'Aktualisiert: {summary}',
    es: 'Actualizado: {summary}',
  },
  toastRefreshedAll: {
    en: '{count} trip(s) refreshed.',
    fr: '{count} trajet(s) actualisé(s).',
    de: '{count} Strecke(n) aktualisiert.',
    es: '{count} trayecto(s) actualizado(s).',
  },
  budgetCaption: {
    en: 'Budget: {percent} % of the free monthly usage',
    fr: 'Budget : {percent} % de l’usage mensuel gratuit',
    de: 'Budget: {percent} % des monatlichen Gratiskontingents',
    es: 'Presupuesto: {percent} % del uso mensual gratuito',
  },
  budgetPlannedLabel: {
    en: 'Planned a month',
    fr: 'Prévu par mois',
    de: 'Geplant pro Monat',
    es: 'Previsto al mes',
  },
  gaugeLabel: {
    en: '{sku} of {budget}',
    fr: '{sku} sur {budget}',
    de: '{sku} von {budget}',
    es: '{sku} de {budget}',
  },
  budgetPlanned: {
    en: '{count} {sku}',
    fr: '{count} {sku}',
    de: '{count} {sku}',
    es: '{count} {sku}',
  },
  budgetNothingPlanned: { en: 'nothing', fr: 'rien', de: 'nichts', es: 'nada' },
  budgetKey: { en: 'API key', fr: 'Clé d’API', de: 'API-Schlüssel', es: 'Clave de API' },
  budgetKeyOk: { en: 'Accepted', fr: 'Acceptée', de: 'Akzeptiert', es: 'Aceptada' },
  budgetKeyUnknown: {
    en: 'Not used yet',
    fr: 'Pas encore utilisée',
    de: 'Noch nicht genutzt',
    es: 'Aún sin usar',
  },
  budgetKeyRefused: { en: 'Refused', fr: 'Refusée', de: 'Abgelehnt', es: 'Rechazada' },
  budgetKeyMissing: { en: 'Missing', fr: 'Manquante', de: 'Fehlt', es: 'Falta' },
  budgetPaused: {
    en: 'Paused (429)',
    fr: 'En pause (429)',
    de: 'Pausiert (429)',
    es: 'En pausa (429)',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('minutesAgo', 'fr', { n: 3 }); // -> 'il y a 3 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string|Function} key - The TEXTS key, or `(language) => string`.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusEmpty');
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function' ? key(language) : t(key, language, values),
    ]),
  );
}

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A number written in a language ("4 500", "4,500", "12,5").
 * @param {number} n - The number.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const formatNumber = (n, language) =>
  new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1 }).format(n);

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) return t('never', language);
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return t('justNow', language);
  if (minutes < 60) return t('minutesAgo', language, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('hoursAgo', language, { n: hours });
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description The month of an instant, as a title: "October 2026".
 * @param {string} month - "YYYY-MM".
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function formatMonth(month, language) {
  const [year, number] = month.split('-').map(Number);
  const text = new Intl.DateTimeFormat(locale(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  return text.charAt(0).toLocaleUpperCase(locale(language)) + text.slice(1);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatNumber, ago, formatMonth };
