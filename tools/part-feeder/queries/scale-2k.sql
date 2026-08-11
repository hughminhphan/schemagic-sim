WITH candidates AS (
  SELECT
    j.lcsc,
    j.mfr,
    COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer) AS manufacturer,
    j.category,
    j.subcategory,
    j.package,
    j.stock,
    j.preferred AS popularity,
    j.description,
    j.datasheet,
    j.attributes,
    l.attributes AS lcsc_attributes,
    CASE
      WHEN lower(j.subcategory) LIKE '%bipolar%'
        AND lower(j.subcategory) NOT LIKE '%digital transistor%' THEN 'bjt'
      WHEN lower(j.subcategory) LIKE '%mosfet%' THEN 'mosfet'
      WHEN lower(j.category) LIKE '%diode%'
        OR lower(j.subcategory) LIKE '%diode%' THEN 'diode'
    END AS conveyor_family
  FROM jlc_components AS j
  LEFT JOIN lcsc_components AS l ON l.lcsc = j.lcsc
  WHERE j.present = 1
    AND j.stock >= 5000
    AND j.datasheet <> ''
    AND (
      (
        lower(j.subcategory) LIKE '%bipolar%'
        AND lower(j.subcategory) NOT LIKE '%digital transistor%'
      )
      OR lower(j.subcategory) LIKE '%mosfet%'
      OR lower(j.category) LIKE '%diode%'
      OR lower(j.subcategory) LIKE '%diode%'
    )
    AND lower(j.category) NOT LIKE '%bridge%'
    AND lower(j.subcategory) NOT LIKE '%bridge%'
), ranked AS (
  SELECT
    *,
    COUNT(*) OVER (PARTITION BY conveyor_family) AS raw_family_count,
    ROW_NUMBER() OVER (
      PARTITION BY conveyor_family
      ORDER BY popularity DESC, stock DESC, lcsc ASC
    ) AS family_rank
  FROM candidates
  WHERE conveyor_family IS NOT NULL
)
SELECT *
FROM ranked
WHERE (conveyor_family = 'diode' AND family_rank <= 1200)
   OR (conveyor_family = 'mosfet' AND family_rank <= 900)
   OR (conveyor_family = 'bjt' AND family_rank <= 650)
ORDER BY conveyor_family ASC, family_rank ASC
