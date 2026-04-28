-- PR-RESET-POLISH-01: Align exercise_templates.duration_sec with SSOT catalog/manifest (60s).
-- Scoped to reset_v1 R01–R10 canonical ids only (no M01–M48, no broad R% pattern).

UPDATE public.exercise_templates
SET duration_sec = 60
WHERE scoring_version = 'reset_v1'
  AND id IN (
    'R01_STERNOCLEIDOMASTOID_STRETCH',
    'R02_QUADRICEPS_STRETCH',
    'R03_HAMSTRING_STRETCH',
    'R04_SEATED_PIRIFORMIS_STRETCH',
    'R05_GLUTEUS_MAXIMUS_STRETCH',
    'R06_SUPINE_PIRIFORMIS_STRETCH',
    'R07_CAT_COW_SPINE_STRETCH',
    'R08_FOAM_ROLLER_LAT_STRETCH',
    'R09_LONGITUDINAL_FOAM_ROLLER_CHEST_OPENER',
    'R10_LEVATOR_SCAPULAE_UPPER_TRAP_STRETCH'
  );
