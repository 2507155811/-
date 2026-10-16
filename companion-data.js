export const BACKUP_KEYS = [
  "momo-settings",
  "momo-appearance",
  "momo-memory",
  "momo-journal",
  "momo-care",
  "momo-planner",
  "momo-preferences",
  "momo-evolution",
  "momo-wardrobe",
];
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v, max) => typeof v === "string" && v.length <= max;
const num = (v, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(v) && v >= min && v <= max;
const date = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v));
export function validateRecord(key, v) {
  if (!object(v)) return false;
  switch (key) {
    case "momo-settings":
      return (
        text(v.name, 20) &&
        typeof v.quiet === "boolean" &&
        num(Number(v.size), 70, 130)
      );
    case "momo-appearance":
      return (
        Number.isInteger(v.model) &&
        num(v.model, 0, 2) &&
        ["builtin", "custom"].includes(v.activeAsset) &&
        ["cloud", "garden", "night"].includes(v.world) &&
        typeof v.accessory === "boolean" &&
        (v.family === undefined || ["dragon", "angel", "human"].includes(v.family))
      );
    case "momo-wardrobe":
      return ["stage","daily","sport","formal","elegant"].includes(v.outfit) && ["stage","long","bob","ponytail"].includes(v.hair) && typeof v.outerwear === "boolean";
    case "momo-evolution":
      return Number.isInteger(v.stage) && num(v.stage, 0, 3) && Number.isInteger(v.highest) && num(v.highest, v.stage, 3);
    case "momo-memory":
      return (
        text(v.notes, 10000) &&
        Array.isArray(v.messages) &&
        v.messages.length <= 20000 &&
        v.messages.every(
          (m) =>
            object(m) &&
            ["user", "assistant"].includes(m.role) &&
            text(m.text, 10000),
        )
      );
    case "momo-journal":
      return (
        date(v.first) &&
        date(v.day) &&
        Number.isInteger(v.touches) &&
        num(v.touches) &&
        Number.isInteger(v.total) &&
        num(v.total)
      );
    case "momo-care":
      return (
        num(v.snacks) &&
        num(v.pats) &&
        num(v.focusSessions) &&
        num(v.focusMinutes) &&
        Array.isArray(v.visits) &&
        v.visits.length <= 10000 &&
        v.visits.every(date)
      );
    case "momo-preferences":
      return (
        [15, 30, 60].includes(v.fps) &&
        typeof v.motion === "boolean" &&
        typeof v.speech === "boolean"
      );
    case "momo-planner":
      return (
        Array.isArray(v.tasks) &&
        v.tasks.length <= 1000 &&
        v.tasks.every(
          (t) =>
            object(t) &&
            text(t.id, 100) &&
            text(t.title, 200) &&
            typeof t.done === "boolean" &&
            typeof t.notified === "boolean" &&
            (t.due === null || num(t.due)),
        ) &&
        new Set(v.tasks.map((t) => t.id)).size === v.tasks.length &&
        object(v.focus) &&
        num(v.focus.remaining, 0, 7200000) &&
        num(v.focus.duration, 60000, 7200000) &&
        (v.focus.endsAt === null || num(v.focus.endsAt))
      );
    default:
      return false;
  }
}
export function readRecord(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return validateRecord(key, value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function createBackup() {
  const records = {};
  for (const key of BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const parsed = JSON.parse(value);
      if (!validateRecord(key, parsed))
        throw new Error("本地数据格式异常，无法生成完整备份");
      records[key] = parsed;
    }
  }
  return {
    app: "MOMO",
    version: 1,
    createdAt: new Date().toISOString(),
    records,
  };
}
export function parseBackup(raw) {
  const data = JSON.parse(raw);
  if (
    !object(data) ||
    data.app !== "MOMO" ||
    data.version !== 1 ||
    !object(data.records) ||
    !Object.keys(data.records).length
  )
    throw new Error("不是受支持的 MOMO 备份");
  for (const [key, value] of Object.entries(data.records)) {
    if (!BACKUP_KEYS.includes(key) || !validateRecord(key, value))
      throw new Error("备份包含不支持或损坏的数据");
  }
  return data;
}
// Preserve an undo snapshot and roll back all writes if quota or access fails.
export function restoreBackup(backup) {
  parseBackup(JSON.stringify(backup));
  const before = Object.fromEntries(
    BACKUP_KEYS.map((key) => [key, localStorage.getItem(key)]),
  );
  try {
    localStorage.setItem("momo-before-restore", JSON.stringify(before));
    for (const [key, value] of Object.entries(backup.records))
      localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    for (const [key, value] of Object.entries(before)) {
      try {
        value === null
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, value);
      } catch {}
    }
    throw error;
  }
}
export function undoRestore() {
  const previous = JSON.parse(localStorage.getItem("momo-before-restore"));
  if (
    !object(previous) ||
    BACKUP_KEYS.some(
      (key) =>
        !(key in previous) ||
        (previous[key] !== null &&
          !validateRecord(key, JSON.parse(previous[key]))),
    )
  )
    throw new Error("没有有效的恢复前快照");
  const current = Object.fromEntries(
    BACKUP_KEYS.map((key) => [key, localStorage.getItem(key)]),
  );
  try {
    for (const key of BACKUP_KEYS)
      previous[key] === null
        ? localStorage.removeItem(key)
        : localStorage.setItem(key, previous[key]);
  } catch (error) {
    for (const key of BACKUP_KEYS) {
      try {
        current[key] === null
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, current[key]);
      } catch {}
    }
    throw error;
  }
  localStorage.removeItem("momo-before-restore");
}
export function remainingFocus(focus, now = Date.now()) {
  return focus.endsAt === null
    ? focus.remaining
    : Math.max(0, focus.endsAt - now);
}
