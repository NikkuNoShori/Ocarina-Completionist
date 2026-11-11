import type { ReactNode } from "react";

/**
 * Deep links to Zelda Wiki (zeldawiki.wiki) for item and song names in the checklist text.
 * Keys are the words as they appear in our text; values are wiki page titles.
 * `null` means the page name isn't certain (or the item is new in the remake), so the link
 * uses the wiki's "go" search, which opens the page if it exists and search results if not.
 */
const TERMS: Record<string, string | null> = {
  // Songs
  "Zelda's Lullaby": "Zelda's Lullaby", "Epona's Song": "Epona's Song", "Saria's Song": "Saria's Song",
  "Sun's Song": "Sun's Song", "Song of Time": "Song of Time", "Song of Storms": "Song of Storms",
  "Minuet of Forest": "Minuet of Forest", "Bolero of Fire": "Bolero of Fire", "Serenade of Water": "Serenade of Water",
  "Nocturne of Shadow": "Nocturne of Shadow", "Requiem of Spirit": "Requiem of Spirit", "Prelude of Light": "Prelude of Light",
  "Scarecrow's Song": "Scarecrow's Song",
  // Ocarinas
  "Ocarina of Time": "Ocarina of Time (Item)", "Fairy Ocarina": "Fairy Ocarina", "Ocarina": "Ocarina",
  // Weapons and tools
  "Kokiri Sword": "Kokiri Sword", "Master Sword": "Master Sword", "Biggoron's Sword": "Biggoron's Sword",
  "Deku Shield": "Deku Shield", "Hylian Shield": "Hylian Shield", "Mirror Shield": "Mirror Shield",
  "Fairy Slingshot": "Fairy Slingshot", "Fairy Bow": "Fairy Bow", "Boomerang": "Boomerang",
  "Hookshot": "Hookshot", "Longshot": "Longshot", "Megaton Hammer": "Megaton Hammer", "Lens of Truth": "Lens of Truth",
  "Bombchus": "Bombchu", "Bombs": "Bomb", "Bomb Bag": "Bomb Bag", "Quiver": "Quiver",
  "Deku Sticks": "Deku Stick", "Deku Stick": "Deku Stick", "Deku Nut": "Deku Nut", "Deku Seed Bag": "Deku Seed",
  // Clothing and upgrades
  "Kokiri Tunic": "Kokiri Tunic", "Goron Tunic": "Goron Tunic", "Zora Tunic": "Zora Tunic",
  "Iron Boots": "Iron Boots", "Hover Boots": "Hover Boots",
  "Goron's Bracelet": "Goron's Bracelet", "Silver Gauntlets": "Silver Gauntlets", "Golden Gauntlets": "Golden Gauntlets",
  "Silver Scale": "Silver Scale", "Golden Scale": "Golden Scale",
  "Adult's Wallet": "Adult's Wallet", "Giant's Wallet": "Giant's Wallet",
  // Magic
  "Din's Fire": "Din's Fire", "Farore's Wind": "Farore's Wind", "Nayru's Love": "Nayru's Love",
  "Magic Meter": "Magic Meter", "Double Magic": null, "Spin Attack": "Spin Attack",
  // Masks and trade items
  "Mask of Truth": "Mask of Truth", "Skull Mask": "Skull Mask", "Bunny Hood": "Bunny Hood", "Zelda's Letter": "Zelda's Letter",
  // Everything else
  "Empty Bottle": "Empty Bottle", "Magic Bean": "Magic Bean", "Bug": "Bug", "Cuccos": "Cucco", "Cucco": "Cucco",
  "Epona": "Epona", "Rupees": "Rupee", "Gold Skulltula tokens": "Gold Skulltula Token",
  "Spiritual Stones": "Spiritual Stone", "Echo Gem": null, "Big Poes": "Big Poe",
};

export function wikiUrl(term: string) {
  const title = TERMS[term];
  if (title === null || title === undefined)
    return `https://zeldawiki.wiki/w/index.php?search=${encodeURIComponent(term)}&title=Special%3ASearch&go=Go`;
  return `https://zeldawiki.wiki/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2C/g, ",")}`;
}

// Longest names first so "Ocarina of Time" wins over "Ocarina" and "Bomb Bag" over "Bombs"
const NAMES = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ANY = new RegExp(`(?<![\\w'])(${NAMES.map(esc).join("|")})(?![\\w'])`, "g");
const LEAD = new RegExp(`^(${NAMES.map(esc).join("|")})(?=[:(\\s]|$)`);

const A = ({ term }: { term: string }) => (
  <a className="wl" href={wikiUrl(term)} target="_blank" rel="noopener" title={`${term} on Zelda Wiki`}
    onClick={e => e.stopPropagation()}>{term}</a>
);

/** Every known item or song name in `text` becomes a Zelda Wiki link. */
export function linkify(text: string): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  ANY.lastIndex = 0;
  while ((m = ANY.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<A key={k++} term={m[1]} />);
    last = m.index + m[1].length;
  }
  if (!out.length) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Only an item name at the very start ("Kokiri Sword: in the chest…") becomes a link. */
export function linkifyLead(text: string): ReactNode {
  const m = text && LEAD.exec(text);
  if (!m) return text;
  return <><A term={m[1]} />{text.slice(m[1].length)}</>;
}
