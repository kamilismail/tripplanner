---
change_id: trips-new-split
title: Split /trips into the trip list and a /trips/new generator
status: new
created: 2026-09-30
updated: 2026-09-30
archived_at: null
---

## Notes

Change B of two agreed with the user on 2026-09-30; change A is `auth-entry-redesign`. Start research and planning
only after A is implemented and archived: A sets the post-login / post-signup targets, the `/` redirect and the
smoke steps to `/trips`, and this change switches them to `/trips/new`.

Input decisions: `context/archive/2026-09-28-app-layout-redesign/change.md`, sections "Routing and pages" (`/trips`
list, `/trips/new` generator, post-accept highlight, room for a future `/trips/[id]`), "App header", "Empty state on
`/trips`", "Unsaved-plan warning", and "Deferred to separate changes".

This is a routing/flow change, not a restyle of an existing view, so it goes through the normal chain, not `/10x-ui`.
