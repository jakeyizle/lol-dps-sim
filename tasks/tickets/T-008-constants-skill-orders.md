# T-008: Constants, skill orders and overrides

Status: ready
Milestone: M1
Scenarios: DATA-005, DATA-015, DATA-016
Depends on: T-004

## Notes

- `packages/data-pipeline/overrides/`: `constants.ts` (attack speed cap, base crit multiplier), `skill-orders.ts` (ability per level 1–18 per champion), and a generic deep-merge of per-entity value overrides applied after normalization.
- Attack speed cap: the reviewer found the wiki citing 3.003 and older sources 2.5; record the value with a comment naming its source and "verify in Practice Tool".
- Skill orders: the standard max order per champion (e.g. Jinx Q > W > E, R at 6/11/16); level 1–3 take one of each basic ability.
- Output `generated/<patch>/constants.json`; `skillOrder` stored on each champion.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
