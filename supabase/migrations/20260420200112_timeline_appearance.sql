-- Timeline appearance & layout settings. Users can now configure each lane's
-- dot color, row height, intra-lane grid, and the vertical anchor at which
-- dots are placed. Built-in lanes (Logos + Rhema, Prayer, Discipleship) are
-- editable too so users can fully personalize the canvas.

alter table public.timelines
  -- Null color = "use the client default" (built-in CSS var for built-in
  -- kinds, or a swatch from the custom palette for user-created lanes). A
  -- non-null value is a CSS color string (hex, rgb(), etc.) chosen by the
  -- user.
  add column if not exists color text,
  -- Row-height preset. Kept as an enum-ish text column instead of raw pixels
  -- so the UI can tweak exact pixel values later without a data migration.
  add column if not exists height_preset text not null default 'normal',
  -- Vertical day columns behind the dots.
  add column if not exists show_day_cells boolean not null default true,
  -- The vertical "today" marker column.
  add column if not exists show_today_highlight boolean not null default true,
  -- Number of evenly-spaced horizontal guide lines inside the plot region.
  -- 0 = none, 1 = single midline (the old "noon guide"), 2 = thirds, etc.
  add column if not exists grid_subdivisions integer not null default 1,
  -- Where (0..1, top-to-bottom) the plot band is anchored within the lane.
  -- 0.5 reproduces the pre-settings behavior (dots span the full plot band
  -- driven by time-of-day); lower values push dots toward the top, higher
  -- values toward the bottom.
  add column if not exists vertical_anchor double precision not null default 0.5;

-- Constraints live in their own statements so re-runs don't fail if a
-- previous partial migration already created the column without the check.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'timelines_height_preset_chk'
  ) then
    alter table public.timelines
      add constraint timelines_height_preset_chk
      check (height_preset in ('compact', 'normal', 'tall'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'timelines_grid_subdivisions_chk'
  ) then
    alter table public.timelines
      add constraint timelines_grid_subdivisions_chk
      check (grid_subdivisions between 0 and 8);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'timelines_vertical_anchor_chk'
  ) then
    alter table public.timelines
      add constraint timelines_vertical_anchor_chk
      check (vertical_anchor between 0 and 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'timelines_color_chk'
  ) then
    alter table public.timelines
      add constraint timelines_color_chk
      check (color is null or length(color) between 3 and 32);
  end if;
end $$;
