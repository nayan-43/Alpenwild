const accentReplacements = {
  Æ: "AE",
  æ: "ae",
  Ð: "D",
  ð: "d",
  Ø: "O",
  ø: "o",
  Þ: "TH",
  þ: "th",
  ß: "s",
  Ł: "L",
  ł: "l",
  Œ: "OE",
  œ: "oe",
  Ĳ: "IJ",
  ĳ: "ij",
  Ŋ: "N",
  ŋ: "n",
};

export function slugifyCategoryName(value) {
  let title = String(value)
    .replace(/<[^>]*>/g, "")
    .replace(
      /[ÆæÐðØøÞþßŁłŒœĲĳŊŋ]/g,
      (character) => accentReplacements[character],
    )
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  title = title.replace(/%([a-fA-F0-9]{2})/g, "---$1---");
  title = title.replace(/%/g, "");
  title = title.replace(/---([a-fA-F0-9]{2})---/g, "%$1");
  title = title
    .toLowerCase()
    .replace(/&.+?;/g, "")
    .replace(/\./g, "-")
    .replace(/[\u00a0\u2013\u2014]/g, "-")
    .replace(/[¡¿«»‹›‘’“”‚‛„‟©®°…™]/g, "")
    .replace(/×/g, "x")
    .replace(/€/g, "E")
    .replace(/£/g, "");

  title = title.replace(/[^\x00-\x7f]/g, (character) =>
    encodeURIComponent(character).replace(/%[a-fA-F0-9]{2}/g, (octet) =>
      octet.toLowerCase(),
    ),
  );

  return title
    .replace(/[^%a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
