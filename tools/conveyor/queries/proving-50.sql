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
      WHEN lower(j.subcategory) LIKE '%bipolar%' OR lower(j.subcategory) LIKE '%transistor%bj%' THEN 'bjt'
      WHEN lower(j.subcategory) LIKE '%mosfet%' THEN 'mosfet'
      WHEN lower(j.category) LIKE '%diode%' OR lower(j.subcategory) LIKE '%diode%' THEN 'diode'
    END AS conveyor_family
  FROM jlc_components AS j
  LEFT JOIN lcsc_components AS l ON l.lcsc = j.lcsc
  WHERE j.present = 1
    AND j.stock >= :stock_min
    AND j.datasheet <> ''
    AND (
      lower(j.subcategory) LIKE '%bipolar%'
      OR lower(j.subcategory) LIKE '%mosfet%'
      OR lower(j.category) LIKE '%diode%'
      OR lower(j.subcategory) LIKE '%diode%'
    )
    AND (
      lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%onsemi%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%vishay%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%nexperia%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%diodes incorporated%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%texas instruments%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%infineon%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%stmicroelectronics%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%toshiba%'
      OR lower(COALESCE(NULLIF(j.manufacturer, ''), l.manufacturer)) LIKE '%rohm%'
    )
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY conveyor_family
    ORDER BY popularity DESC, stock DESC, lcsc ASC
  ) AS family_rank
  FROM candidates
  WHERE conveyor_family IS NOT NULL
)
SELECT lcsc, mfr, manufacturer, category, subcategory, package, stock,
       popularity, description, datasheet, attributes, lcsc_attributes,
       conveyor_family
FROM ranked
WHERE family_rank <= 80
ORDER BY family_rank, CASE conveyor_family WHEN 'diode' THEN 1 WHEN 'bjt' THEN 2 ELSE 3 END,
         popularity DESC, stock DESC, lcsc ASC
