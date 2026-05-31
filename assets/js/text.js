const lfText = document.querySelector("#lfText");
const copyAllBtn = document.querySelector("#copyAllBtn");

async function fetchJson(file, fallback = null) {
  try {
    const res = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load ${file}`);
    return await res.json();
  } catch {
    return fallback;
  }
}

function uniqueByName(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = String(item.name || "").toLowerCase();

    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

function getLfItems(data) {
  if (Array.isArray(data.lookingForItems)) {
    return uniqueByName(data.lookingForItems);
  }

  const items = [];

  for (const group of data.lookingFor || []) {
    for (const item of group.items || []) {
      const current = Number(item.current || 0);
      const needed = item.needed === "?" ? 999 : Number(item.needed || 0);

      if (current > 200) continue;
      if (needed !== 999 && current >= needed) continue;

      items.push({
        id: item.id,
        name: item.name,
        priority: item.priority || "normal"
      });
    }
  }

  return uniqueByName(items);
}

function getFtItems(data) {
  return uniqueByName(data.manualHave || [])
    .filter(item => item.status !== "reserved");
}

function makeText(data) {
  const lfItems = getLfItems(data);
  const ftItems = getFtItems(data);

  const high = lfItems.filter(item => item.priority === "high");
  const normal = lfItems.filter(item => item.priority !== "high");

  const lines = [];

  lines.push("lf some stuff");

  if (high.length) {
    lines.push("");
    lines.push("mainly looking for:");
    for (const item of high) {
      lines.push(`- ${item.name}`);
    }
  }

  if (normal.length) {
    lines.push("");
    lines.push("also need:");
    for (const item of normal) {
      lines.push(`- ${item.name}`);
    }
  }

  lines.push("");
  lines.push("ft:");

  if (ftItems.length) {
    for (const item of ftItems) {
      if (item.note) {
        lines.push(`- ${item.name} (${item.note})`);
      } else {
        lines.push(`- ${item.name}`);
      }
    }
  } else {
    lines.push("- open to offers");
  }

  lines.push("");
  lines.push("just dm me and we can figure something out");

  return lines.join("\n");
}

async function init() {
  const data = await fetchJson("/data/trading.json", { lookingForItems: [], manualHave: [] });
  const text = makeText(data);

  lfText.value = text;

  copyAllBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text);
    copyAllBtn.textContent = "Copied!";
    setTimeout(() => {
      copyAllBtn.textContent = "Copy";
    }, 1400);
  });
}

init();