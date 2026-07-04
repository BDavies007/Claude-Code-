-- ════════════════════════════════════════════════════════════════════
-- Executive OS — seed data
--
-- Seeds a fully-populated demo environment for the CEO of LightSummit,
-- a clean-tech company. Running this creates a demo auth user you can
-- log in as:
--
--     email:    ceo@lightsummit.io
--     password: ExecutiveOS!2026
--
-- The seed is idempotent-ish: it deletes prior demo data for the demo
-- user before re-inserting, so it is safe to re-run in local dev.
-- ════════════════════════════════════════════════════════════════════

-- Fixed identifiers so the seed is deterministic.
-- Demo user id: 00000000-0000-0000-0000-0000000000c0
-- Company id:   00000000-0000-0000-0000-0000000000c1

-- ── 1. Demo auth user ───────────────────────────────────────────────
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-0000000000c0',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ceo@lightsummit.io',
  crypt('ExecutiveOS!2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Elena Marsh"}',
  now(), now()
)
on conflict (id) do nothing;

-- Required identity row for email/password login.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-0000000000c0',
  '00000000-0000-0000-0000-0000000000c0',
  '{"sub":"00000000-0000-0000-0000-0000000000c0","email":"ceo@lightsummit.io"}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

-- ── 2. Profile ──────────────────────────────────────────────────────
insert into public.profiles (id, full_name, title, company_name)
values (
  '00000000-0000-0000-0000-0000000000c0',
  'Elena Marsh', 'Founder & CEO', 'LightSummit'
)
on conflict (id) do update
  set full_name = excluded.full_name,
      title = excluded.title,
      company_name = excluded.company_name;

-- ── Clean prior demo data (safe re-run) ─────────────────────────────
delete from public.tasks         where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.decisions     where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.meetings      where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.contacts      where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.opportunities where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.risks         where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.daily_briefs  where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.ai_agents     where user_id = '00000000-0000-0000-0000-0000000000c0';
delete from public.companies     where user_id = '00000000-0000-0000-0000-0000000000c0';

-- ── 3. Companies ────────────────────────────────────────────────────
insert into public.companies (id, user_id, name, industry, website, location, size, description)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c0',
   'LightSummit', 'Clean Technology', 'https://lightsummit.io', 'Austin, TX', '120 employees',
   'LightSummit builds modular solar-plus-storage microgrids that bring resilient clean power to commercial and community sites.'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c0',
   'Helios Grid Partners', 'Energy Infrastructure', 'https://heliosgrid.example', 'Denver, CO', '400 employees',
   'Utility-scale developer and prospective channel partner for LightSummit microgrid deployments.'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c0',
   'Verdant Capital', 'Venture Capital', 'https://verdant.example', 'San Francisco, CA', '35 employees',
   'Climate-focused growth fund; lead investor conversations for LightSummit Series B.'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c0',
   'Northwind Logistics', 'Logistics & Warehousing', 'https://northwind.example', 'Reno, NV', '2,500 employees',
   'Large logistics operator piloting LightSummit microgrids across three distribution centres.');

-- ── 4. Contacts ─────────────────────────────────────────────────────
insert into public.contacts (user_id, company_id, full_name, role, email, phone, notes)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2',
   'Marcus Reed', 'VP Business Development', 'marcus.reed@heliosgrid.example', '+1-303-555-0142',
   'Champion for the channel partnership. Prefers concise, data-led updates.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c3',
   'Priya Nadar', 'Partner', 'priya@verdant.example', '+1-415-555-0173',
   'Leading Verdant''s diligence on the Series B. Focused on unit economics and gross margin trajectory.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4',
   'Dana Whitfield', 'Chief Operations Officer', 'dana.whitfield@northwind.example', '+1-775-555-0128',
   'Sponsor of the 3-site pilot. Cares most about uptime SLAs and installation timelines.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Sam Okafor', 'VP Engineering', 'sam.okafor@lightsummit.io', '+1-512-555-0119',
   'Owns the storage firmware roadmap and the Northwind deployment readiness.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Lena Alvarez', 'Chief Financial Officer', 'lena.alvarez@lightsummit.io', '+1-512-555-0155',
   'Runs the Series B model and board reporting.');

-- ── 5. Meetings ─────────────────────────────────────────────────────
insert into public.meetings (user_id, company_id, title, status, location, starts_at, ends_at, attendees, agenda)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c3',
   'Verdant Series B — diligence deep dive', 'scheduled', 'Video call',
   now() + interval '3 hours', now() + interval '4 hours',
   array['Priya Nadar','Lena Alvarez','Elena Marsh'],
   'Walk through updated unit economics, gross margin bridge, and use of proceeds.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4',
   'Northwind pilot — go/no-go review', 'scheduled', 'Reno DC-2',
   now() + interval '1 day 2 hours', now() + interval '1 day 3 hours',
   array['Dana Whitfield','Sam Okafor','Elena Marsh'],
   'Confirm commissioning date for the second site and review uptime data from site one.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2',
   'Helios channel partnership — terms', 'scheduled', 'Video call',
   now() + interval '2 days', now() + interval '2 days 1 hour',
   array['Marcus Reed','Elena Marsh'],
   'Align on revenue share and exclusivity window for the western region.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Weekly executive staff sync', 'completed', 'HQ — Summit Room',
   now() - interval '1 day', now() - interval '1 day' + interval '1 hour',
   array['Sam Okafor','Lena Alvarez','Elena Marsh'],
   'Ops, finance, and product status; Series B readiness.');

-- ── 6. Tasks ────────────────────────────────────────────────────────
insert into public.tasks (user_id, company_id, title, description, status, priority, due_date, assignee)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c3',
   'Finalise Series B data room', 'Upload refreshed financial model, cap table, and customer references.',
   'in_progress', 'critical', current_date + 1, 'Lena Alvarez'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4',
   'Approve Northwind site-2 commissioning plan', 'Sign off installation sequence and safety review.',
   'todo', 'high', current_date + 2, 'Sam Okafor'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2',
   'Draft Helios partnership term sheet', 'Revenue share, exclusivity window, and SLA commitments.',
   'todo', 'high', current_date + 4, 'Elena Marsh'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Review Q3 hiring plan', 'Prioritise field ops and firmware roles against runway.',
   'blocked', 'medium', current_date + 6, 'Elena Marsh'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Prepare board deck narrative', 'Tighten the growth story and Series B ask.',
   'todo', 'medium', current_date + 8, 'Elena Marsh'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Publish company all-hands recap', 'Summarise mission progress and Q3 goals.',
   'done', 'low', current_date - 2, 'Elena Marsh');

-- ── 7. Decisions ────────────────────────────────────────────────────
insert into public.decisions (user_id, company_id, title, context, options, decision, rationale, status, decided_at)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c3',
   'Set Series B raise target', 'Balancing runway, dilution, and growth ambition for 2026-2027.',
   'A) $30M · B) $45M · C) $60M', 'Raise $45M', 'Funds two years of runway plus western-region expansion without over-diluting founders.',
   'approved', current_date - 3),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2',
   'Channel vs. direct sales for western region', 'Helios offers reach but takes margin; direct preserves margin but is slower.',
   'A) Helios channel · B) Direct build-out · C) Hybrid', null, null,
   'proposed', null),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c1',
   'Storage cell supplier for 2026', 'Current supplier lead times are lengthening ahead of the Northwind ramp.',
   'A) Stay single-source · B) Dual-source', 'Dual-source', 'Reduces single-point supply risk ahead of scaling deployments.',
   'approved', current_date - 8);

-- ── 8. Opportunities ────────────────────────────────────────────────
insert into public.opportunities (user_id, company_id, name, stage, value, currency, probability, close_date, owner, notes)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c4',
   'Northwind — 3-site microgrid rollout', 'negotiation', 4200000, 'USD', 70, current_date + 21, 'Elena Marsh',
   'Pilot converting to full rollout pending site-2 uptime data.'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-0000000000c2',
   'Helios channel partnership', 'proposal', 8000000, 'USD', 45, current_date + 45, 'Elena Marsh',
   'Multi-year channel revenue; terms under negotiation.'),
  ('00000000-0000-0000-0000-0000000000c0', null,
   'Coastal Community College microgrid', 'qualified', 1350000, 'USD', 35, current_date + 60, 'Sam Okafor',
   'Resilience-focused campus deployment; grant funding in play.'),
  ('00000000-0000-0000-0000-0000000000c0', null,
   'Harbor Freight cold-storage pilot', 'prospect', 950000, 'USD', 20, current_date + 90, 'Elena Marsh',
   'Early conversation; strong fit for storage-heavy load profile.');

-- ── 9. Risks ────────────────────────────────────────────────────────
insert into public.risks (user_id, title, description, level, mitigation, is_open)
values
  ('00000000-0000-0000-0000-0000000000c0',
   'Series B timing vs. runway', 'Runway reaches ~7 months if the raise slips past Q3.',
   'high', 'Accelerate diligence; keep a bridge option warm with existing investors.', true),
  ('00000000-0000-0000-0000-0000000000c0',
   'Storage cell supply concentration', 'Single-source supplier lead times lengthening.',
   'medium', 'Dual-source decision approved; onboarding second supplier now.', true),
  ('00000000-0000-0000-0000-0000000000c0',
   'Northwind site-1 uptime variance', 'Two brief inverter faults could weaken the go/no-go case.',
   'medium', 'Firmware patch shipped; monitoring 14-day rolling uptime.', true);

-- ── 10. Daily brief (today) ─────────────────────────────────────────
insert into public.daily_briefs (user_id, brief_date, headline, summary, highlights)
values (
  '00000000-0000-0000-0000-0000000000c0', current_date,
  'Series B diligence and Northwind go/no-go headline the day',
  'Your morning is anchored by the Verdant diligence deep dive at midday — the refreshed unit economics and gross-margin bridge are the deciding artifacts, so make sure the data room is finalised beforehand. The Northwind pilot go/no-go is tomorrow; site-1 uptime is trending positive after the firmware patch, but two brief inverter faults are the one soft spot Dana will probe. On the pipeline, the Helios term sheet is the highest-leverage draft this week: landing exclusivity without over-committing on SLAs opens the western region. Watch item: runway compresses to roughly seven months if the raise slips past Q3 — keep the bridge option warm.',
  array[
    'Finalise the Series B data room before the midday Verdant call',
    'Prep answers on the two Northwind inverter faults ahead of tomorrow''s go/no-go',
    'Advance the Helios term sheet — exclusivity is the key lever',
    'Runway is the standing risk: protect the Q3 close'
  ]
);

-- ── 11. AI agents — the executive''s AI staff ────────────────────────
insert into public.ai_agents (user_id, name, role, description, status, accent, last_active)
values
  ('00000000-0000-0000-0000-0000000000c0', 'Amelia', 'Chief of Staff',
   'Orchestrates your day, drafts the daily brief, and keeps priorities aligned across the team.',
   'active', 'electric', now() - interval '12 minutes'),
  ('00000000-0000-0000-0000-0000000000c0', 'Atlas', 'Strategy & Decisions',
   'Frames major decisions, weighs options, and pressure-tests strategy against your goals.',
   'active', 'indigo', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000c0', 'Orbit', 'Relationships & CRM',
   'Tracks contacts and companies, surfaces who to reconnect with, and preps meeting context.',
   'active', 'sky', now() - interval '35 minutes'),
  ('00000000-0000-0000-0000-0000000000c0', 'Sentinel', 'Risk & Compliance',
   'Monitors operational, financial, and market risks and flags what needs attention.',
   'active', 'amber', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000c0', 'Forge', 'Execution & Tasks',
   'Turns decisions into tasks, chases owners, and keeps commitments moving to done.',
   'active', 'emerald', now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-0000000000c0', 'Vector', 'Growth & Pipeline',
   'Analyses opportunities, forecasts the pipeline, and highlights the highest-leverage deals.',
   'active', 'violet', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000c0', 'Pulse', 'Insights & Reporting',
   'Synthesises company metrics into board-ready insight and tracks progress to goals.',
   'idle', 'rose', now() - interval '6 hours');
