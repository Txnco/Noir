<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 2. Što se dešava s bundle-om kad su SVE izvedbe otkazane? Trigger postavlja status na partially_refunded, ali kad padne zadnja izvedba, status bi trebao biti refunded (full refund). Treba li trigger to detektirati, ili je to app-level logika?

Ovo je čisto arhitekturno pitanje bez potrebe za pretragom — imam cijeli kontekst iz prethodnih fajlova.

***

## Problem precizno

Trenutni trigger u v3 uvijek radi ovo:[^1]

```
occurrence cancelled → bundle.status = 'partially_refunded'
```

Ali postoje **dva scenarija** koja trigger ne razlikuje:


| Scenarij | Što se dogodilo | Ispravan status |
| :-- | :-- | :-- |
| Pada 1 od 3 izvedbe | 2 izvedbe još aktivne | `partially_refunded` ✅ |
| Pada zadnja izvedba | 0 izvedbi aktivno | `refunded` ❌ (trigger piše `partially_refunded`) |
| Pada 1 od 3, ali 1 je već bila skenirana | 1 izvedba aktivna, 1 iskorištena | `partially_refunded` ✅ |
| Padaju zadnje 2 odjednom | 0 izvedbi aktivno | `refunded` ❌ |


***

## Preporuka: Trigger rješava ovo, ne app

**Razlog:** u istoj DB transakciji u kojoj se occurrence status mijenja u `cancelled`, trigger već drži sve zaključane retke. Ako to prepustimo app razini, postoji prozor između triggera i app provjere gdje bundle pokazuje krivi status — malen, ali moguć.

Provjera je jedna linija: `COUNT(aktivnih izvedbi u bundleu) == 0`.

***

## Konkretni fix unutar `handle_occurrence_cancellation()`

Jedina izmjena je unutar `FOR v_bundle IN ... LOOP` — **nakon** što se bundle ažurira na `partially_refunded`, dodaje se provjera:

```sql
-- (unutar LOOP-a, iza UPDATE ticket_bundles SET status = 'partially_refunded')

-- Provjeri jesu li SVE izvedbe u bundleu sada otkazane
DECLARE
    v_active_occurrence_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_active_occurrence_count
    FROM bundle_type_occurrences bto
    JOIN event_occurrences eo ON eo.id = bto.occurrence_id
    WHERE bto.bundle_type_id = v_bundle.bundle_type_id
      AND eo.status != 'cancelled';

    -- Ako nula aktivnih izvedbi → puni refund
    IF v_active_occurrence_count = 0 THEN
        UPDATE ticket_bundles
        SET status     = 'refunded',
            updated_at = NOW()
        WHERE id = v_bundle.bundle_id;
    END IF;
END;
```


***

## Edge case koji treba razmotriti

Postoji jedan scenarij koji trenutna shema ne pokriva dobro:

```
Bundle ima 3 izvedbe: Petak, Subota, Nedjelja
Korisnik je bio na Petku (scanned) → bundle = 'partially_used'
Subota pada → bundle = 'partially_refunded'
Nedjelja pada → trigger pita: ima li aktivnih izvedbi?
```

`COUNT(eo.status != 'cancelled')` vraća **0** (Petak je `completed`, Subota i Nedjelja su `cancelled`).

Trigger bi postavio `refunded` — ali korisnik je **već iskoristio Petak**, dakle nije puni refund. Ispravni status je `partially_refunded` (korisnik dobiva refund samo za Subotu i Nedjelju).

**Fix:** provjera ne smije biti "jesu li sve cancelled" nego "ima li još izvedbi koje nisu ni cancelled ni completed":

```sql
SELECT COUNT(*)
INTO v_active_occurrence_count
FROM bundle_type_occurrences bto
JOIN event_occurrences eo ON eo.id = bto.occurrence_id
WHERE bto.bundle_type_id = v_bundle.bundle_type_id
  AND eo.status NOT IN ('cancelled', 'completed');
  -- completed = izvedba je prošla, skeniranja su bila

-- Uz dodatnu provjeru: je li itko od ticketa bio scanned?
-- Ako DA → 'partially_refunded' (nije full refund jer je nešto iskorišteno)
-- Ako NE → 'refunded' (ništa nije iskorišteno, puni povrat)

DECLARE
    v_used_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_used_count
    FROM tickets
    WHERE bundle_id   = v_bundle.bundle_id
      AND status      = 'scanned';

    IF v_active_occurrence_count = 0 THEN
        IF v_used_count = 0 THEN
            -- Ništa nije iskorišteno, puni refund
            UPDATE ticket_bundles
            SET status = 'refunded', updated_at = NOW()
            WHERE id = v_bundle.bundle_id;
        ELSE
            -- Nešto je bilo iskorišteno, ostaje partially_refunded
            -- (status je već postavljen ranije u loopu)
            NULL;
        END IF;
    END IF;
END;
```


***

## Finalna logika u jednoj tablici

| Aktivnih izvedbi | Skeniranih ulaznica | Finalni status |
| :--: | :--: | :-- |
| > 0 | bilo što | `partially_refunded` |
| 0 | 0 | `refunded` (puni povrat) |
| 0 | > 0 | `partially_refunded` (nešto iskorišteno) |

Ovo ostaje u triggeru — atomično, bez prozora za race condition, i ne zahtijeva nikakvu app-level post-processing logiku.

<div align="center">⁂</div>

[^1]: 3ver.sql

