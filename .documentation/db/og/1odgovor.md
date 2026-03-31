<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# PITANJA ZA RASPRAVU

Ovo su stvari koje nisu greške nego dizajnerske odluke koje trebam razumjeti prije nego predložim rješenja:

1. Jedan korisnik, više lockova? Može li korisnik lockati više sjedala istovremeno (npr. kupuje 4 karte za društvo)? Trenutno nema limita. Želite li application-level limit ili DB constraint na locked_by?

Vidio sam v2 i v3 SQL. Ovo je dobro pitanje jer otkriva **dva skrivena problema** u trenutnoj shemi — ne samo jedan.

***

## Analiza trenutnog stanja

`lock_seat_for_checkout()` u v3 prima `p_user_id` ali **ne sprema ga nigdje u tablicu**.  `occurrence_item_status` nema `locked_by` kolonu. To znači:[^1]

- Ne znaš tko drži koji lock
- Ne možeš osloboditi samo korisnikove lockove kad napusti checkout
- Ne možeš nametati nikakav limit čak ni da hoćeš
- Debug je nemoguć ("zašto je sjedalo A-5 zaključano?")

Znači odgovor na pitanje "treba li limit?" dolazi tek nakon što se doda `locked_by`.

***

## Preporuka: Application-level limit + `locked_by` kolona

**Ne DB constraint** (npr. `UNIQUE` ili `CHECK`), jer:

- Različiti eventi imaju različite logike — rock concert: max 6, VIP loža: max 20, standing: neograničeno
- DB constraint zahtijeva migraciju kad se limit promijeni
- Constraint koji broji redove zahtijeva trigger, što je overhead za svaki lock poziv

Umjesto toga: **limit provjerava `lock_seat_for_checkout()` funkcija sama**, a limit se može proslijediti kao parametar ili čitati iz konfiguracije.

***

## Konkretne izmjene za v4 delta

```sql
-- ============================================================
-- PROMJENA: Dodaj locked_by + max_locks_per_user u occurrence_item_status
-- ============================================================

ALTER TABLE occurrence_item_status
    ADD COLUMN locked_by UUID REFERENCES auth.users(id);

-- Indeks: brzo oslobađanje svih lockova jednog korisnika
CREATE INDEX idx_item_status_locked_by
    ON occurrence_item_status(locked_by, occurrence_id)
    WHERE status = 'locked';

-- ============================================================
-- NOVA FUNKCIJA: lock_seat_for_checkout (zamjena v3 verzije)
-- ============================================================
-- Promjene vs v3:
-- 1. Sprema locked_by
-- 2. Enforcea p_max_locks_per_user (0 = bez limita)
-- 3. Refresh: ako ISTI korisnik re-pozove za isto sjedalo,
--    produljuje timer umjesto da vraća FALSE

CREATE OR REPLACE FUNCTION lock_seat_for_checkout(
    p_occurrence_id     UUID,
    p_item_id           UUID,
    p_user_id           UUID,
    p_max_locks         INT DEFAULT 10   -- 0 = bez limita
) RETURNS JSONB AS $$
DECLARE
    v_current_status    item_availability;
    v_current_locked_by UUID;
    v_reserved_until    TIMESTAMPTZ;
    v_current_lock_count INT;
BEGIN
    -- Provjeri koliko lockova korisnik već ima za ovu izvedbu
    IF p_max_locks > 0 THEN
        SELECT COUNT(*)
        INTO v_current_lock_count
        FROM occurrence_item_status
        WHERE occurrence_id  = p_occurrence_id
          AND locked_by      = p_user_id
          AND status         = 'locked'
          AND reserved_until > NOW();

        IF v_current_lock_count >= p_max_locks THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'reason',  'max_locks_reached',
                'message', format('Možeš odabrati maksimalno %s sjedala odjednom.', p_max_locks)
            );
        END IF;
    END IF;

    -- Atomični lock na redak
    SELECT status, locked_by, reserved_until
    INTO v_current_status, v_current_locked_by, v_reserved_until
    FROM occurrence_item_status
    WHERE occurrence_id = p_occurrence_id
      AND item_id       = p_item_id
    FOR UPDATE;

    -- Ako redak ne postoji, kreiraj ga
    IF NOT FOUND THEN
        INSERT INTO occurrence_item_status
            (occurrence_id, item_id, status, locked_by, reserved_until, updated_at)
        VALUES
            (p_occurrence_id, p_item_id, 'locked', p_user_id, NOW() + INTERVAL '15 minutes', NOW());

        RETURN jsonb_build_object('success', TRUE, 'reason', 'locked_new');
    END IF;

    -- Refresh: isti korisnik, lock još aktivan ili upravo istekao
    IF v_current_locked_by = p_user_id AND v_current_status = 'locked' THEN
        UPDATE occurrence_item_status
        SET reserved_until = NOW() + INTERVAL '15 minutes',
            updated_at     = NOW()
        WHERE occurrence_id = p_occurrence_id AND item_id = p_item_id;

        RETURN jsonb_build_object('success', TRUE, 'reason', 'lock_refreshed');
    END IF;

    -- Preuzmi lock ako je istekao (bez obzira tko ga je držao)
    IF v_current_status = 'locked' AND v_reserved_until < NOW() THEN
        UPDATE occurrence_item_status
        SET status         = 'locked',
            locked_by      = p_user_id,
            reserved_until = NOW() + INTERVAL '15 minutes',
            updated_at     = NOW()
        WHERE occurrence_id = p_occurrence_id AND item_id = p_item_id;

        RETURN jsonb_build_object('success', TRUE, 'reason', 'expired_lock_taken');
    END IF;

    -- Slobodno sjedalo
    IF v_current_status = 'available' THEN
        UPDATE occurrence_item_status
        SET status         = 'locked',
            locked_by      = p_user_id,
            reserved_until = NOW() + INTERVAL '15 minutes',
            updated_at     = NOW()
        WHERE occurrence_id = p_occurrence_id AND item_id = p_item_id;

        RETURN jsonb_build_object('success', TRUE, 'reason', 'locked');
    END IF;

    -- Zauzeto (sold, reserved, locked od drugog korisnika)
    RETURN jsonb_build_object(
        'success', FALSE,
        'reason',  'seat_unavailable',
        'message', 'Sjedalo je zauzeto. Odaberite drugo.'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- NOVA FUNKCIJA: Oslobodi sve lockove korisnika
-- ============================================================
-- Poziva se kad korisnik:
-- A) Napusti checkout stranicu (frontend onUnmount/beforeunload)
-- B) Klikne "Odustani" na checkout stranici
-- C) Session istekne

CREATE OR REPLACE FUNCTION release_user_seat_locks(
    p_occurrence_id UUID,
    p_user_id       UUID
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET status         = 'available',
        locked_by      = NULL,
        reserved_until = NULL,
        updated_at     = NOW()
    WHERE occurrence_id = p_occurrence_id
      AND locked_by     = p_user_id
      AND status        = 'locked';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- IZMJENA: expire_seat_locks — čisti i locked_by
-- ============================================================

CREATE OR REPLACE FUNCTION expire_seat_locks()
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE occurrence_item_status
    SET status         = 'available',
        locked_by      = NULL,      -- NOVO: čisti i owner
        reserved_until = NULL,
        ticket_id      = NULL,
        updated_at     = NOW()
    WHERE status        = 'locked'
      AND reserved_until IS NOT NULL
      AND reserved_until < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```


***

## Kako to izgleda u checkout flowu

```
Korisnik odabire 4 sjedala za grupu:
  → POST /seats/lock  {seat: A-1}  → lock(max=10) → ✅ 1/10
  → POST /seats/lock  {seat: A-2}  → lock(max=10) → ✅ 2/10
  → POST /seats/lock  {seat: A-3}  → lock(max=10) → ✅ 3/10
  → POST /seats/lock  {seat: A-4}  → lock(max=10) → ✅ 4/10

  Frontend prikazuje: "4 sjedala odabrana • 14:32 preostalo"

Korisnik odustane:
  → POST /seats/release-all  {occurrence_id}
  → release_user_seat_locks() → 4 sjedala slobodna

Korisnik plati:
  → purchase endpoint kreira 4 ticketa
  → occurrence_item_status.status → 'sold', locked_by → NULL
```


***

## Gdje se postavlja limit (prijedlog)

Limit se ne hardkodira u bazu nego dolazi **iz event konfiguracije** — što znači dodati jedno polje:

```sql
ALTER TABLE event_occurrences
    ADD COLUMN max_seats_per_checkout INT DEFAULT 10;
```

Backend ga čita pri svakom lock pozivu i prosljeđuje u `lock_seat_for_checkout(p_max_locks => occurrence.max_seats_per_checkout)`. Za standing-only evente (stajaća mjesta bez sjedala) limit se ne primjenjuje uopće jer nema `occurrence_item_status` redaka.
<span style="display:none">[^2]</span>

<div align="center">⁂</div>

[^1]: 3ver.sql

[^2]: 2ver-2.sql

