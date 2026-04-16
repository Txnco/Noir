How authority is modeled in your DB
The trick: everyone uses the exact same auth. Identity is decoupled from authority. A single human has one auth.users row + one profiles row forever — "being an admin" or "being an organizer" is just additional rows in other tables layered on top.

The mental model

auth.users         ← Supabase (email, password, JWT issuance) — same for all
    │
    ├── profiles                  ← everyone gets this (full_name, avatar, city…)
    │
    ├── user_platform_roles?      ← only if they have PLATFORM authority
    │       role ∈ {admin, staff, user}
    │
    └── organization_members[]    ← one row PER org they belong to
            {org_id, role ∈ {owner, admin, staff}, is_active}
Three independent "authority layers":

Layer	Table	Who has a row	What it grants
Identity	profiles	Everyone	Existence — you can log in
Platform	user_platform_roles	Very few (you, staff)	Power over the whole app
Organization	organization_members	Organizer/venue staff	Power scoped to one org
A normal user has only the first row. A club owner has rows in the first and third. You (platform admin) probably have all three.

Flow 1 — Normal user (Ana buys a ticket)
State in DB:


auth.users:                id=<ana-uuid>, email=ana@mail.com
profiles:                  id=<ana-uuid>, full_name='Ana Horvat'
user_platform_roles:       (no row)        ← implicit "user"
organization_members:      (no row)        ← belongs to no org
Sign-up flow:

Frontend: supabase.auth.signUp({ email, password, options: { data: { firstName: 'Ana', lastName: 'Horvat' } } })
Supabase creates auth.users row
on_auth_user_created trigger fires → profiles row auto-created
Done. Ana has ZERO authority beyond being authenticated.
Buying a ticket:

Ana logs in → Supabase JWT in httpOnly cookie
Browses events (public read, no auth needed)
Clicks "buy" → frontend calls backend with JWT → get_current_user decodes → CurrentUser(id=<ana-uuid>)
Backend inserts orders / tickets with user_id = <ana-uuid>
RLS enforces: Ana can only SELECT tickets where user_id = auth.uid()
What /auth/me returns for Ana:


{
  "id": "<ana-uuid>",
  "email": "ana@mail.com",
  "profile": { "full_name": "Ana Horvat", ... },
  "platform_role": "user",
  "memberships": []
}
Flow 2 — Organization member (Marko runs "Klub Boogaloo")
Marko is a regular user who ALSO runs a club. He signed up the exact same way Ana did. Authority was granted later.

State in DB:


auth.users:                id=<marko-uuid>, email=marko@boogaloo.hr
profiles:                  id=<marko-uuid>, full_name='Marko Kovač'
user_platform_roles:       (no row)
organizations:             id=<boogaloo-uuid>, name='Klub Boogaloo'
organization_members:      {org_id=<boogaloo-uuid>, user_id=<marko-uuid>,
                            role='owner', is_active=true}
How he got authority: a platform admin (you) ran once:


INSERT INTO organizations (name, slug, can_organize, can_own_venues)
VALUES ('Klub Boogaloo', 'boogaloo', true, true);

INSERT INTO organization_members (org_id, user_id, role, joined_at)
VALUES ('<boogaloo-uuid>', '<marko-uuid>', 'owner', NOW());
That's it. Marko is now an org owner — same login, extra row.

Creating an event:

Marko logs in → same JWT flow as Ana
Frontend calls POST /api/v1/events with { name, organizer_org_id: '<boogaloo-uuid>', ... }
Backend checks: does caller have org authority for this org?

roles = await get_org_roles(db, user.id)
# roles = {'<boogaloo-uuid>': 'owner'}
if roles.get(str(event.organizer_org_id)) not in ('owner', 'admin'):
    raise HTTPException(403, "Not a member of this org")
Insert event. Done.
Adding his employee Ivan as staff:


INSERT INTO organization_members (org_id, user_id, role)
VALUES ('<boogaloo-uuid>', '<ivan-uuid>', 'staff');
Ivan can now scan tickets at Boogaloo events, but can't touch Klub Tvornica's events because he has no row for that org. Scope is automatic.

What /auth/me returns for Marko:


{
  "id": "<marko-uuid>",
  "profile": { "full_name": "Marko Kovač", ... },
  "platform_role": "user",
  "memberships": [
    { "org_id": "<boogaloo-uuid>", "role": "owner", "is_active": true }
  ]
}
Key point: Marko's role is not global. He's "owner" of Boogaloo, "nobody" everywhere else. organization_members is a list, not a single field — he could own one club AND be staff at another venue:


organization_members:
  { org_id=<boogaloo-uuid>, user_id=<marko-uuid>, role='owner' }
  { org_id=<tvornica-uuid>, user_id=<marko-uuid>, role='staff' }
Flow 3 — Platform admin (you)
You are a normal user who ALSO has one extra row.

State in DB:


auth.users:                id=<tonco-uuid>, email=tonco@noir.hr
profiles:                  id=<tonco-uuid>, full_name='Tonco ...'
user_platform_roles:       { user_id=<tonco-uuid>, role='admin' }
organization_members:      (possibly some, if you also run an org)
How you got it (manually, once, to bootstrap):


INSERT INTO user_platform_roles (user_id, role)
VALUES ('<tonco-uuid>', 'admin');
Moderating a venue:

Log in → same JWT
Hit an admin-protected endpoint: Depends(require_platform_roles("admin"))
Backend queries user_platform_roles → finds role='admin' → allowed
You can now do platform-wide things: verify organizations, ban users, see cross-org analytics
What /auth/me returns:


{
  "id": "<tonco-uuid>",
  "profile": { ... },
  "platform_role": "admin",
  "memberships": []
}
The authorization check inside handlers
Platform-level (only admins/staff):


@router.delete("/venues/{id}")
async def force_delete_venue(
    id: UUID,
    _: CurrentUser = Depends(require_platform_roles("admin"))
):
    ...
Org-scoped (must be member of this specific org):


@router.post("/events")
async def create_event(
    payload: EventCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    roles = await get_org_roles(db, user.id)
    if roles.get(str(payload.organizer_org_id)) not in ("owner", "admin"):
        raise HTTPException(403, "Not authorized for this org")
    ...
Self-only (you can only touch your own stuff):


@router.get("/my/tickets")
async def my_tickets(user: CurrentUser = Depends(get_current_user), db = Depends(get_db)):
    result = await db.execute(select(Ticket).where(Ticket.user_id == user.id))
    return result.scalars().all()
And at the DB layer, RLS does the same check independently — even if someone bypasses the API, Postgres rejects the query.

Why this is powerful
One login, many hats. You don't need separate "admin login" and "customer login" URLs. The same JWT works everywhere; the backend just checks which rows exist.
Zero role explosion. Need a new org? Insert a row. Need to promote staff to admin? Update a row. No new tables, no new auth systems.
Revocation is trivial. Fire a staff member: UPDATE organization_members SET is_active = false WHERE .... They still have an account, they just lost scoped power.
Bootstrapping is self-referential. The FIRST platform admin is created manually in SQL. Everyone else gets promoted by someone who already has authority.
The whole system is: identity is universal, authority is a query.