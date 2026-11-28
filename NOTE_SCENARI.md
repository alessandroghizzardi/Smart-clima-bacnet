# Note per il codice · Scenari (da rivedere)

## Motore scenari (server)
Uno scenario parte **solo quando lo si avvia** ("Avvia ora" o ▶ nella lista; gli scenari salvati non partono da soli). Da lì resta attivo e si ripete nei suoi giorni finché non lo si interrompe. "Avvia ora" fuori dai giorni o prima dell'ora di inizio parte subito dalla prima fase. Un solo scenario attivo alla volta: avviarne un altro apre il pannello "Cambiare scenario?", che con un tocco interrompe quello in corso, spegne le sue unità che il nuovo non usa (le altre passano subito al nuovo) e avvia il nuovo. Quando c'è uno scenario attivo il server esegue un ciclo di controllo ogni 5 minuti: legge le unità via BACnet, confronta con la fase corrente e scrive solo ciò che serve. Ogni lettura finisce nel registro. In sola lettura gli scenari sono solo consultabili e il motore resta in pausa; anche la ripartenza nei giorni previsti (orologio del server) avviene solo a scrittura attiva.

## Fasi a orario
Ogni fase ha: nome, temperatura target, 'fino a' (ora) e, a scelta, oscillazione lamelle; la modalità dello scenario è Raff., Risc., Vent. o Deum.; ogni fase può inoltre essere solo Vent. o solo Deum. (nome e orari, nessuna temperatura: le unità si accendono in quella modalità) oppure Spento.

**Selettore del tipo di fase** (stesse icone del selettore delle modalità; il server valida le stesse regole): in uno scenario Raff. o Risc. è attivo solo il tipo a temperatura dello scenario (l'altro è grigio), più Vent., Deum. e Spento. In uno scenario Vent. o Deum. sono attivi solo Deum., Vent. e Spento; Raff. e Risc. restano grigi (non esistono fasi a temperatura). Spento è disponibile solo dopo la prima fase. Passando a uno scenario Vent./Deum. le fasi a temperatura diventano del tipo dello scenario; tornando a Raff./Risc. diventano a temperatura con target di default. Auto non è disponibile. La prima fase ha anche l'ora di inizio (scelta nella fase, non nello scenario); ogni fase successiva parte quando finisce la precedente. Una fase può andare dalla sera alla mattina dopo (non serve che la fine sia 'dopo' l'inizio). I giorni (V S D…) si scelgono nel passo 1 e valgono per tutte le fasi. Cambio di fase: il ciclo da 5 min vede che l'ora è passata e applica la nuova fase (ritardo max 5 min). 'Salta alla fase 2' forza l'avanzamento subito.

## Fase 'Spegni impianto'
È un tipo di fase (ON/OFF nell'editor): nessun orario di fine, nessun target. Può essere una sola e l'ultima; parte quando finisce la fase precedente, spegne tutte le unità dello scenario. Lo scenario però **resta attivo** ("in attesa del prossimo avvio") e riparte da solo nel prossimo giorno previsto all'ora di inizio della prima fase, finché non lo si interrompe a mano. Vale anche se l'ultima fase è a orario e finisce senza una fase "Spegni". Un avvio a mano dopo la fine dell'ultima fase applica subito lo spegnimento e poi attende.

## Mantieni temperatura (opzionale, per fase)
Un solo flag nell'editor della fase, con tre soglie. Esempio riscaldamento, programma 20,0°: **target 20,5** · **mantenimento 18,0** · **ritorno 18,5**.
- Finché la stanza (temperatura letta dalla singola unità) è sotto il target, l'unità segue il programma (20,0°).
- Quando raggiunge il target (20,5) il setpoint dell'unità passa al mantenimento (18,0) e lì resta.
- Se la stanza scende fino al ritorno (18,5) l'unità torna al programma (20,0) finché non raggiunge di nuovo 20,5. Tra 18,5 e 20,5 nulla cambia (isteresi).
- Controllo per unità ogni 5 minuti; si scrive solo se il valore differisce.
- Variante **"si spegne"**: invece del setpoint di mantenimento, al target l'unità si spegne e si riaccende al ritorno (la temperatura di mantenimento non serve).
- Tutto è per singola unità: ognuna usa la temperatura della propria stanza, le altre non cambiano.

Raffreddamento: stessa logica con segni invertiti (programma 24 → target 23,5 · mantenimento 26,0 · ritorno 25,5).
Coerenza (validata da app e server): riscaldamento mantenimento ≤ ritorno < target e target ≥ temperatura della fase; raffreddamento specchiato. Solo per Raffreddamento e Riscaldamento. Gli scenari salvati col vecchio formato (Spinta iniziale / Mantenimento con soglia) vanno riaperti e salvati di nuovo: il vecchio mantenimento viene ignorato.

## Impianti dello scenario
Scelta per ambiente (lista a scorrimento) oppure per singole unità; salvata come elenco di unità (id) più nome gruppo. Il conteggio unità nelle card è calcolato, non salvato.

## Home scenari / dettaglio
Home: scenario in corso (nome, fase X di Y, giorni, n. unità, n. unità in mantenimento, barra avanzamento fino alla fine fase), altri scenari con tasto ▶ (avvia dopo conferma; se uno è già attivo apre "Cambiare scenario?"), 'Nuovo scenario'. Dettaglio di uno scenario fermo: riquadro "Non avviato" e 'Avvia ora'. Dettaglio di uno avviato: timeline fasi, stato per unità (in salita / a target / in mantenimento), 'Salta alla fase', 'Modifica', 'Ferma'. 'Ferma' chiede "Vuoi spegnere l'impianto?": spegni tutto (le unità dello scenario) oppure lascia così (restano come sono); in entrambi i casi lo scenario si interrompe subito.

## Dati / persistenza
Tabella scenari (nome, modalità, giorni, unità), fasi come JSON dentro lo scenario (tipo, nome, target, fino, mant:{target,temp,ritorno} oppure {target,spegni:true,ritorno}, oscillazione), tabella stato run (scenario, fase corrente, unità in mantenimento, ultimo controllo). Lo stato run sopravvive al riavvio del server: al riavvio riprende dal ciclo successivo.

## Header data/ora impianto
In prova sulla home scura: data e ora lette dall'impianto (non dal telefono), con pallino verde se l'ultima lettura è recente. Se la lettura è più vecchia di 10 min il pallino diventa ambra/rosso.

## Registro
- Conserva solo gli ultimi 30 giorni (potatura all'avvio e ogni 6 ore, indice su `ts`).
- `/api/log` è paginato a cursore (`?before=<id>&limit=30&q=<testo>`); in "Altro" scorre in una finestra propria, 30 voci per volta.
- I comandi sono scritti in modo leggibile ("Camera 1: spenta", "Cucina: setpoint 19 → 21 °C").

## Navigazione
Rotte con hash: `#/stato`, `#/grafico`, `#/scenari`, `#/scenari/<id>`, `#/ambienti`, `#/altro`, `#/unita/<id>`. Ricaricando si resta sulla stessa pagina; funzionano avanti/indietro del browser e il gesto indietro del telefono. Gli editor non hanno rotta propria: ricaricando si torna alla pagina di partenza.
