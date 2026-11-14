[out:json][timeout:180];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
(
  way["place"~"^(island|islet)$"](area.tr);
  relation["place"~"^(island|islet)$"](area.tr);
);
out geom;
