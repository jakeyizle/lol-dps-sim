import type { StatBlock } from "@lol/engine";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const num = (x: number) => (Math.round(x * 10) / 10).toString();

/** METRIC-007 / BUILD-008. */
export function StatsPanel(props: { stats: StatBlock }) {
  const s = props.stats;
  const rows: [string, string][] = [
    ["AD", num(s.attackDamage.total)],
    ["Bonus AD", num(s.attackDamage.bonus)],
    ["Attack speed", s.attackSpeed.toFixed(3)],
    ["Crit chance", pct(s.critChance)],
    ["Crit damage", pct(s.critDamage)],
    ["Armor pen", pct(s.armorPenPercent)],
    ["Lethality", num(s.lethality)],
    ["Magic pen", `${num(s.magicPenFlat)} | ${pct(s.magicPenPercent)}`],
    ["Ability haste", num(s.abilityHaste)],
    ["Health", num(s.health.total)],
    ["Mana", num(s.mana.total)],
    ["AP", num(s.abilityPower)],
  ];
  return (
    <section aria-label="Stats">
      <h3 className="mb-2 font-medium">Stats</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-600">{label}</dt>
            <dd className="text-right tabular-nums" data-stat={label}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
