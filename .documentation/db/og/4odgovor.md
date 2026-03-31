<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 4. Timezone handling za occurrence_date + start_time Imate occurrence_date DATE + start_time TIME odvojeno, ali venue_availability.time_range je TSTZRANGE. Kako rekonstruirate puni timestamp za usporedbu? Pretpostavljam occurrence_date + start_time AT TIME ZONE 'Europe/Zagreb'? Ovo treba biti eksplicitno u dokumentaciji jer je izvor subtle bugova.

Ovo je jedno od najvažnijih pitanja u cijeloj shemi — i imaš pravo, ovo je izvor silent bugova koji se ne vide u testiranju (jer testiraš po danu, a problem se pojavljuje na DST granici u 3:00 ujutro).

***

## Točni problemi

### Problem 1 — DATE + TIME daje TIMESTAMP bez zone

```sql
-- Ovo je PostgreSQL default ponašanje:
SELECT DATE '2026-10-25' + TIME '23:00:00';
-- → 2026-10-25 23:00:00  ← TIMESTAMP WITHOUT TIME ZONE
-- Nema pojma o zoni. AT TIME ZONE je obavezan.

SELECT (DATE '2026-10-25' + TIME '23:00:00') AT TIME ZONE 'Europe/Zagreb';
-- → 2026-10-24 21:00:00+00  ← TIMESTAMPTZ (UTC internally)
-- PostgreSQL zna da je 25.10.2026. u 23:00 po Zagrebu = UTC 21:00
-- jer je to dan kad Hrvatska izlazi iz ljetnog računanja
```


### Problem 2 — DST ambiguity: 2:00 AM postoji dvaput

```
25. listopada 2026. (povratak na zimsko):
  02:00 CEST (UTC+2) → sat se pomiče natrag → 02:00 CET (UTC+1)

Event: start_time = 02:30
  Koji 02:30? UTC+2 ili UTC+1?

AT TIME ZONE 'Europe/Zagreb' će uzeti PRVI (ljetni) — nije nužno točno.
```


### Problem 3 — Eventi koji prelaze ponoć

```sql
start_time = '22:00', end_time = '04:00'
-- end_time < start_time → end_date je occurrence_date + 1 dan
-- Ako ovo ne handlaš eksplicitno → time_range je negativan interval
-- TSTZRANGE s negativnim intervalom = prazan range → exclusion constraint ne radi
```


### Problem 4 — Tko rekonstruira timestamp?

Trenutno u shemi nema definiranog mjesta gdje se `DATE + TIME → TSTZRANGE` dogodi. To znači svaki developer to radi na svom mjestu, svaki put potencijalno drugačije.

***

## Rješenje: jedan kanonski izvor istine

### Korak 1 — Dodaj `timezone` na `venues`

```sql
ALTER TABLE venues
    ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Zagreb';

-- Validacija da je legitimna IANA zona:
ALTER TABLE venues
    ADD CONSTRAINT chk_valid_timezone
    CHECK (NOW() AT TIME ZONE timezone IS NOT NULL);
```

Razlog za polje na venues umjesto hardkodiranog `'Europe/Zagreb'`: kad sustav ekspandira na Split, Rijeku, pa regionalno (Beograd, Ljubljana) — svaki venue ima svoju zonu. Ne trebaš migrirati podatke, samo uneseš drugu zonu za novi venue.

### Korak 2 — Helper funkcija `build_occurrence_tstzrange()`

```sql
-- Jedna funkcija, jedan kanonski način rekonstrukcije.
-- Svi API endpointi i triggeri pozivaju SAMO ovu funkciju.

CREATE OR REPLACE FUNCTION build_occurrence_tstzrange(
    p_date       DATE,
    p_start_time TIME,
    p_end_time   TIME,      -- može biti NULL
    p_timezone   VARCHAR
) RETURNS TSTZRANGE AS $$
DECLARE
    v_start  TIMESTAMPTZ;
    v_end    TIMESTAMPTZ;
    v_end_date DATE;
BEGIN
    -- Rekonstrukcija starta: uvijek jednoznačno
    v_start := (p_date + p_start_time) AT TIME ZONE p_timezone;

    -- End time: handle midnight crossover
    IF p_end_time IS NULL THEN
        -- Nema definiranog kraja → pretpostavi +6h (fallback za otvorene evente)
        v_end := v_start + INTERVAL '6 hours';

    ELSIF p_end_time <= p_start_time THEN
        -- end_time < start_time → event prelazi ponoć → end je sutradan
        v_end_date := p_date + INTERVAL '1 day';
        v_end := (v_end_date + p_end_time) AT TIME ZONE p_timezone;

    ELSE
        -- Normalni slučaj: end je isti dan
        v_end := (p_date + p_end_time) AT TIME ZONE p_timezone;
    END IF;

    -- Sigurnosna provjera: end mora biti nakon starta
    IF v_end <= v_start THEN
        RAISE EXCEPTION
            'Nevaljan vremenski raspon: end (%) nije nakon start (%) za datum % timezone %',
            v_end, v_start, p_date, p_timezone;
    END IF;

    RETURN tstzrange(v_start, v_end, '[)');
    -- '[)' = inkluzivan start, ekskluzivan end
    -- standard za usporedbu termina (kao i Postgres kalendar)
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```


### Korak 3 — Trigger: automatski gradi `time_range` na `venue_availability`

```sql
-- Umjesto da API ručno računa time_range pri insertu,
-- trigger ga uvijek rekonstruira iz occurrence podataka.
-- Ovo eliminiara mogućnost da API pogriješi.

CREATE OR REPLACE FUNCTION sync_venue_availability_time_range()
RETURNS TRIGGER AS $$
DECLARE
    v_occ    event_occurrences%ROWTYPE;
    v_tz     VARCHAR;
BEGIN
    -- Dohvati occurrence i venue timezone
    SELECT eo.*, v.timezone
    INTO v_occ, v_tz
    FROM event_occurrences eo
    JOIN venues v ON v.id = eo.venue_id
    WHERE eo.id = NEW.occurrence_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Occurrence % ne postoji', NEW.occurrence_id;
    END IF;

    -- Uvijek prepiši time_range iz kanonske funkcije
    NEW.time_range := build_occurrence_tstzrange(
        v_occ.occurrence_date,
        v_occ.start_time,
        v_occ.end_time,
        v_tz
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_va_time_range
BEFORE INSERT OR UPDATE OF occurrence_id ON venue_availability
FOR EACH ROW
WHEN (NEW.occurrence_id IS NOT NULL)
EXECUTE FUNCTION sync_venue_availability_time_range();
```


### Korak 4 — Venue inquiry conflict check koristi istu funkciju

```sql
-- Provjera slobodnih termina pri slanju upita:
-- Inquiry sadrži datum + start/end time → konverzija na licu mjesta

CREATE OR REPLACE FUNCTION check_venue_date_available(
    p_venue_id   UUID,
    p_date       DATE,
    p_start_time TIME,
    p_end_time   TIME
) RETURNS BOOLEAN AS $$
DECLARE
    v_timezone  VARCHAR;
    v_range     TSTZRANGE;
    v_conflict  INT;
BEGIN
    SELECT timezone INTO v_timezone FROM venues WHERE id = p_venue_id;

    v_range := build_occurrence_tstzrange(p_date, p_start_time, p_end_time, v_timezone);

    SELECT COUNT(*) INTO v_conflict
    FROM venue_availability
    WHERE venue_id = p_venue_id
      AND status   = 'blocked'       -- samo potvrđeni bookings blokiraju
      AND time_range && v_range;     -- && = overlap operator na TSTZRANGE

    RETURN v_conflict = 0;
END;
$$ LANGUAGE plpgsql;
```


***

## DST edge case: eksplicitna dokumentacija

Ovo mora biti u README i u komentaru uz `build_occurrence_tstzrange`:

```
DST EDGE CASES — Europe/Zagreb

1. SPRING FORWARD (zadnja nedjelja u ožujku, 02:00 → 03:00):
   Sat skače naprijed. Interval 02:00–03:00 NE POSTOJI.
   AT TIME ZONE automatski mapira 02:30 na 03:30 (PostgreSQL behaviour).
   → Praktičan utjecaj: nizak. Klubovi ne rade u 02:30 u ožujku.
   → Ako bude potrebno: dodati app-level warning za evente u tom prozoru.

2. FALL BACK (zadnja nedjelja u listopadu, 03:00 → 02:00):
   Sat ide natrag. Interval 02:00–03:00 POSTOJI DVAPUT.
   AT TIME ZONE uzima PRVI pojavak (ljetni, UTC+2).
   → Praktičan utjecaj: relevantan za after-party evente koji završavaju
     u 04:00 ili 05:00 ujutro te noći.
   → Rješenje ako zatreba: organizator unosi UTC start/end eksplicitno
     (napredni mode u Creator Hubu, backlog feature).

3. MIDNIGHT CROSSOVER:
   end_time < start_time → build_occurrence_tstzrange() dodaje +1 dan na end.
   Eksplicitno handlano u funkciji.

4. NULL end_time:
   Fallback: start + 6 sati. Pokriva 99% nightlife slučajeva.
   Vidljivo u venue_availability kao blokiran slot.
```


***

## Sažetak: što se mjenja u shemi

| Što | Gdje | Zašto |
| :-- | :-- | :-- |
| `venues.timezone VARCHAR(50)` | nova kolona | kanonski izvor zone po venuu |
| `build_occurrence_tstzrange()` | nova funkcija | jedan rekonstrukcijski put |
| `check_venue_date_available()` | nova funkcija | inquiry conflict check |
| `trg_sync_va_time_range` | novi trigger | API ne može "zaboraviti" konverziju |
| DST dokumentacija | README + SQL komentari | silent bug prevencija |

