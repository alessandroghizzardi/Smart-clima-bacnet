# Note per il codice · Scenari (da rivedere)

## Motore scenari (server)
Un solo scenario attivo alla volta: avviarne un altro interrompe quello in corso (con conferma). Quando c'è uno scenario attivo il server esegue un ciclo di controllo ogni 5 minuti: legge le unità via BACnet, confronta con la fase corrente e scrive solo ciò che serve. Ogni lettura finisce nel registro. In sola lettura gli scenari sono solo consultabili e il motore resta in pausa; l'avvio automatico a orario (orologio del server) avviene solo a scrittura attiva.

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
Raffreddamento: stessa logica con segni invertiti (programma 24 → target 23,5 · mantenimento 26,0 · ritorno 25,5).
Coerenza (validata da app e server): riscaldamento mantenimento ≤ ritorno < target e target ≥ temperatura della fase; raffreddamento specchiato. Solo per Raffreddamento e Riscaldamento. Gli scenari salvati col vecchio formato (Spinta iniziale / Mantenimento con soglia) vanno riaperti e salvati di nuovo: il vecchio mantenimento viene ignorato.

## Impianti dello scenario
Scelta per ambiente (lista a scorrimento) oppure per singole unità; salvata come elenco di unità (id) più nome gruppo. Il conteggio unità nelle card è calcolato, non salvato.

## Home scenari / dettaglio
Home: scenario in corso (nome, fase X di Y, giorni, n. unità, n. unità in mantenimento, barra avanzamento fino alla fine fase), altri scenari con tasto ▶ (avvia, chiede conferma se uno è già attivo), 'Nuovo scenario'. Dettaglio: timeline fasi, stato per unità (in salita / a target / in mantenimento), 'Salta alla fase', 'Modifica', 'Ferma'. 'Ferma' chiede "Vuoi spegnere l'impianto?": spegni tutto (le unità dello scenario) oppure lascia così (restano come sono); in entrambi i casi lo scenario si interrompe subito.

## Dati / persistenza
Tabella scenari (nome, modalità, giorni, unità), fasi come JSON dentro lo scenario (tipo, nome, target, fino, mant:{target,temp,ritorno}, oscillazione), tabella stato run (scenario, fase corrente, unità in mantenimento, ultimo controllo). Lo stato run sopravvive al riavvio del server: al riavvio riprende dal ciclo successivo.

## Header data/ora impianto
In prova sulla home scura: data e ora lette dall'impianto (non dal telefono), con pallino verde se l'ultima lettura è recente. Se la lettura è più vecchia di 10 min il pallino diventa ambra/rosso.

## Registro
- Conserva solo gli ultimi 30 giorni (potatura all'avvio e ogni 6 ore, indice su `ts`).
- `/api/log` è paginato a cursore (`?before=<id>&limit=30&q=<testo>`); in "Altro" scorre in una finestra propria, 30 voci per volta.
- I comandi sono scritti in modo leggibile ("Camera 1: spenta", "Cucina: setpoint 19 → 21 °C").
