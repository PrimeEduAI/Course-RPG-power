import { BRANCH_COLORS, type ContentData } from "./content.ts";
import { talentLayout, levelFor, totalExp } from "./contentStore.ts";
import type { Progress } from "./state.ts";

export interface UICallbacks {
  onEquipToggle: (id: string, on: boolean) => void;
  onTalentToggle: (id: string, on: boolean) => void;
  onReset: () => void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}

export function updateHud(exp: number, total: number) {
  $("#level-title").textContent = levelFor(exp, total);
  $("#exp-text").textContent = `${exp} / ${total}`;
  $<HTMLDivElement>("#exp-fill").style.width = total > 0 ? `${(exp / total) * 100}%` : "0%";
}

export function setupUI(content: ContentData, progress: Progress, cb: UICallbacks) {
  // ---------- 背包清單 ----------
  const bagList = $("#bag-list");
  bagList.innerHTML = "";
  for (const ch of content.chapters) {
    const title = document.createElement("div");
    title.className = "chapter-title";
    title.textContent = ch.title;
    bagList.appendChild(title);

    for (const item of ch.items) {
      const row = document.createElement("div");
      row.className = "equip-item";
      row.dataset.id = item.id;
      row.innerHTML = `
        <div class="equip-icon"></div>
        <div class="equip-info">
          <div class="equip-name"></div>
          <div class="equip-knowledge"></div>
        </div>
        <div class="equip-check"></div>`;
      (row.querySelector(".equip-icon") as HTMLElement).textContent = item.icon;
      (row.querySelector(".equip-name") as HTMLElement).textContent = item.name;
      (row.querySelector(".equip-knowledge") as HTMLElement).textContent = item.knowledge;
      if (progress.equips.includes(item.id)) {
        row.classList.add("owned");
        row.querySelector(".equip-check")!.textContent = "✓";
      }
      row.addEventListener("click", () => {
        const on = !row.classList.contains("owned");
        row.classList.toggle("owned", on);
        row.querySelector(".equip-check")!.textContent = on ? "✓" : "";
        cb.onEquipToggle(item.id, on);
      });
      bagList.appendChild(row);
    }
  }

  // ---------- 技能樹 SVG ----------
  const layout = talentLayout(content);
  const posOf = new Map(layout.map((p) => [p.node.id, p]));

  const svgNS = "http://www.w3.org/2000/svg";
  const treeHost = $("#talent-tree");
  treeHost.innerHTML = "";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 720 460");

  // 分支標籤
  const branchLabels: [string, number, string][] = [
    [`🌈 ${content.branches.color}`, 130, BRANCH_COLORS.color],
    [`🎬 ${content.branches.shot}`, 360, BRANCH_COLORS.shot],
    [`🎵 ${content.branches.rhythm}`, 590, BRANCH_COLORS.rhythm],
  ];
  for (const [label, x, color] of branchLabels) {
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", "24");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("style", `fill:${color};font-size:15px;font-weight:800;font-family:var(--font)`);
    t.textContent = label;
    svg.appendChild(t);
  }

  // 連線(先畫,壓在節點下面)
  const linkEls = new Map<string, SVGLineElement>();
  for (const p of layout) {
    if (!p.parentId) continue;
    const parent = posOf.get(p.parentId);
    if (!parent) continue;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", String(parent.x));
    line.setAttribute("y1", String(parent.y));
    line.setAttribute("x2", String(p.x));
    line.setAttribute("y2", String(p.y));
    line.classList.add("talent-link");
    svg.appendChild(line);
    linkEls.set(p.node.id, line);
  }

  const talentOn = new Set(progress.talents);

  function refreshLinks() {
    for (const p of layout) {
      const line = linkEls.get(p.node.id);
      if (!line || !p.parentId) continue;
      const lit = talentOn.has(p.node.id) && talentOn.has(p.parentId);
      line.classList.toggle("on", lit);
      line.style.stroke = lit ? BRANCH_COLORS[p.node.branch] : "";
    }
  }

  for (const p of layout) {
    const node = p.node;
    const g = document.createElementNS(svgNS, "g");
    g.classList.add("talent-node");
    g.setAttribute("transform", `translate(${p.x},${p.y})`);
    const color = BRANCH_COLORS[node.branch];

    const halo = document.createElementNS(svgNS, "circle");
    halo.classList.add("halo");
    halo.setAttribute("r", "30");
    halo.setAttribute("stroke", color);
    g.appendChild(halo);

    const bg = document.createElementNS(svgNS, "circle");
    bg.classList.add("bg");
    bg.setAttribute("r", "24");
    g.appendChild(bg);

    const icon = document.createElementNS(svgNS, "text");
    icon.classList.add("icon");
    icon.setAttribute("text-anchor", "middle");
    icon.setAttribute("y", "7");
    icon.textContent = node.icon;
    g.appendChild(icon);

    const label = document.createElementNS(svgNS, "text");
    label.classList.add("label");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("y", "44");
    label.textContent = node.name;
    g.appendChild(label);

    const titleEl = document.createElementNS(svgNS, "title");
    titleEl.textContent = node.desc;
    g.appendChild(titleEl);

    function paint(on: boolean) {
      g.classList.toggle("on", on);
      bg.style.stroke = on ? color : "";
      bg.style.fill = on ? "#3a2c78" : "";
      icon.style.opacity = on ? "1" : "0.35";
    }
    paint(talentOn.has(node.id));

    g.addEventListener("click", () => {
      const on = !talentOn.has(node.id);
      if (on) talentOn.add(node.id);
      else talentOn.delete(node.id);
      paint(on);
      refreshLinks();
      cb.onTalentToggle(node.id, on);
    });

    svg.appendChild(g);
  }
  refreshLinks();
  treeHost.appendChild(svg);

  // ---------- 面板開關 ----------
  $("#btn-bag").addEventListener("click", () => $("#bag-panel").classList.toggle("hidden"));
  $("#btn-talent").addEventListener("click", () => $("#talent-overlay").classList.toggle("hidden"));
  document.querySelectorAll<HTMLElement>(".panel-close").forEach((btn) =>
    btn.addEventListener("click", () => $(`#${btn.dataset.close}`).classList.add("hidden"))
  );
  // 點技能樹外側暗處也可關閉
  $("#talent-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) $("#talent-overlay").classList.add("hidden");
  });

  $("#btn-reset").addEventListener("click", () => {
    if (confirm("要開始新的冒險嗎?所有進度會清空!")) cb.onReset();
  });

  updateHud(progress.equips.length + progress.talents.length, totalExp(content));
}
