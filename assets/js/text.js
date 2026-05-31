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

function makeText(data) {
  const items = data.lookingForItems || [];
  const high = items.filter(item => item.priority === "high");
  const normal = items.filter(item => item.priority !== "high");

  const lines = [];

  lines.push("LF:");

  if (high.length) {
    lines.push("");
    lines.push("High priority:");
    for (const item of high) {
      lines.push(`- ${item.name}`);
    }
  }

  if (normal.length) {
    lines.push("");
    lines.push("Other:");
    for (const item of normal) {
      lines.push(`- ${item.name}`);
    }
  }

  lines.push("");
  lines.push("FT:");
  lines.push("");
  lines.push("Discord: @sic4rio_");

  return lines.join("\n");
}

async function init() {
  const data = await fetchJson("/data/trading.json", { lookingForItems: [] });
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