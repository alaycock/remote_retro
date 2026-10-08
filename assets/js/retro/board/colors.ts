// Ported from the legacy services/color_picker.js. Seeded by group id so a
// group's colour is stable across clients and reloads.
export const PALETTE = [
  "#ff0029", "#377eb8", "#66a61e", "#984ea3", "#00d2d5", "#ff7f00", "#af8d00", "#7f80cd",
  "#b3e900", "#c42e60", "#a65628", "#f781bf", "#8dd3c7", "#bebada", "#fb8072", "#80b1d3",
  "#fdb462", "#fccde5", "#bc80bd", "#ffed6f", "#c4eaff", "#cf8c00", "#1b9e77", "#d95f02",
  "#e7298a", "#e6ab02", "#a6761d", "#0097ff", "#00d067", "#000000", "#969696",
] as const

export function colorFromSeed(seed: number, colors: readonly string[] = PALETTE): string {
  const n = Math.max(1, Math.trunc(Math.abs(seed)))
  return colors[(n - 1) % colors.length]
}
