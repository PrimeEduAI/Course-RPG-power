// 課程內容編輯器:編輯章節/知識點(裝備)與導演天賦(技能樹)
import {
  MODELS, BRANCH_COLORS, DEFAULT_CONTENT,
  type ContentData, type Chapter, type EquipItem, type TalentNode,
} from "./content.ts";
import { loadContent, saveContent } from "./contentStore.ts";

let data: ContentData = loadContent();
let dirty = false;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function markDirty() {
  dirty = true;
  $("#btn-save").classList.add("dirty");
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2400);
}

// ---------- 小工具:建 DOM ----------
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function textInput(value: string, placeholder: string, onInput: (v: string) => void, cls = ""): HTMLInputElement {
  const input = el("input", { type: "text", placeholder, class: cls });
  input.value = value;
  input.addEventListener("input", () => { onInput(input.value); markDirty(); });
  return input;
}

// ---------- 章節與知識點 ----------
function renderChapters() {
  const host = $("#chapters");
  host.innerHTML = "";

  data.chapters.forEach((ch, ci) => {
    const card = el("div", { class: "chapter-card" });

    const head = el("div", { class: "chapter-head" });
    head.append(
      textInput(ch.title, "章節標題(例:第一章 · 認識 AI 影片魔法)", (v) => (ch.title = v)),
      delBtn("刪除章節", () => {
        if (ch.items.length && !confirm(`要刪除「${ch.title || "未命名章節"}」和裡面 ${ch.items.length} 個知識點嗎?`)) return;
        data.chapters.splice(ci, 1);
        markDirty();
        renderChapters();
      })
    );
    card.append(head);

    ch.items.forEach((item, ii) => card.append(itemRow(ch, item, ii)));

    const addItem = el("button", { class: "btn-add" }, "➕ 新增知識點(裝備)");
    addItem.addEventListener("click", () => {
      ch.items.push({ id: uid("item"), icon: "⭐", name: "", knowledge: "", model: "badge" });
      markDirty();
      renderChapters();
    });
    card.append(addItem);

    host.append(card);
  });
}

function itemRow(ch: Chapter, item: EquipItem, ii: number): HTMLElement {
  const row = el("div", { class: "item-row" });

  const iconWrap = el("div", {});
  iconWrap.append(el("span", { class: "field-label" }, "圖示"));
  iconWrap.append(textInput(item.icon, "⭐", (v) => (item.icon = v), "icon-input"));

  const nameWrap = el("div", {});
  nameWrap.append(el("span", { class: "field-label" }, "裝備名稱"));
  nameWrap.append(textInput(item.name, "例:咒語之劍", (v) => (item.name = v)));

  const knowWrap = el("div", {});
  knowWrap.append(el("span", { class: "field-label" }, "知識點說明"));
  knowWrap.append(textInput(item.knowledge, "例:寫出好 Prompt", (v) => (item.knowledge = v)));

  const modelWrap = el("div", {});
  modelWrap.append(el("span", { class: "field-label" }, "3D 模型"));
  const select = el("select", {});
  for (const [key, info] of Object.entries(MODELS)) {
    const opt = el("option", { value: key }, info.label);
    if (key === item.model) opt.setAttribute("selected", "");
    select.append(opt);
  }
  select.addEventListener("change", () => { item.model = select.value; markDirty(); });
  modelWrap.append(select);

  row.append(
    iconWrap, nameWrap, knowWrap, modelWrap,
    delBtn("刪除", () => {
      ch.items.splice(ii, 1);
      markDirty();
      renderChapters();
    })
  );
  return row;
}

function delBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", { class: "btn-del" }, `🗑 ${label}`);
  b.addEventListener("click", onClick);
  return b;
}

// ---------- 天賦 ----------
const MAX_PER_BRANCH = 4;

function renderTalents() {
  // 根節點
  const rootHost = $("#root-talent");
  rootHost.innerHTML = "";
  const root = data.talents.find((t) => t.branch === "root");
  if (root) {
    const card = el("div", { class: "talent-card" });
    const head = el("div", { class: "branch-head" });
    const dot = el("span", { class: "branch-dot" });
    dot.style.background = BRANCH_COLORS.root;
    head.append(dot, el("b", {}, "根節點(技能樹底部)"));
    card.append(head, talentRow(root, false));
    rootHost.append(card);
  }

  // 三條分支
  const host = $("#branches");
  host.innerHTML = "";
  (["color", "shot", "rhythm"] as const).forEach((branch) => {
    const card = el("div", { class: "talent-card branch" });
    card.style.borderTopColor = BRANCH_COLORS[branch];

    const head = el("div", { class: "branch-head" });
    const dot = el("span", { class: "branch-dot" });
    dot.style.background = BRANCH_COLORS[branch];
    head.append(dot, textInput(data.branches[branch], "分支名稱", (v) => (data.branches[branch] = v)));
    card.append(head);

    const nodes = data.talents.filter((t) => t.branch === branch);
    nodes.forEach((n) => card.append(talentRow(n, true)));

    if (nodes.length < MAX_PER_BRANCH) {
      const add = el("button", { class: "btn-add" }, "➕ 新增天賦節點");
      add.addEventListener("click", () => {
        data.talents.push({ id: uid("t"), icon: "✨", name: "", desc: "", branch });
        markDirty();
        renderTalents();
      });
      card.append(add);
    }

    host.append(card);
  });
}

function talentRow(node: TalentNode, deletable: boolean): HTMLElement {
  const row = el("div", { class: "talent-row" });

  const iconWrap = el("div", {});
  iconWrap.append(el("span", { class: "field-label" }, "圖示"));
  iconWrap.append(textInput(node.icon, "✨", (v) => (node.icon = v), "icon-input"));

  const fields = el("div", { class: "talent-fields" });
  fields.append(
    textInput(node.name, "天賦名稱(例:色彩情緒)", (v) => (node.name = v)),
    textInput(node.desc, "一句話說明(例:顏色會說話)", (v) => (node.desc = v))
  );

  row.append(iconWrap, fields);
  if (deletable) {
    row.append(delBtn("刪除", () => {
      data.talents = data.talents.filter((t) => t.id !== node.id);
      markDirty();
      renderTalents();
    }));
  } else {
    row.append(el("span", {}));
  }
  return row;
}

// ---------- 動作 ----------
$("#btn-save").addEventListener("click", () => {
  saveContent(data);
  dirty = false;
  $("#btn-save").classList.remove("dirty");
  toast("💾 已儲存!冒險頁會自動更新");
});

$("#btn-restore").addEventListener("click", () => {
  if (!confirm("要把所有內容還原成預設課程嗎?(還原後記得按「儲存變更」才會生效)")) return;
  data = structuredClone(DEFAULT_CONTENT);
  markDirty();
  renderChapters();
  renderTalents();
  toast("↩️ 已還原預設,記得按「儲存變更」");
});

addEventListener("beforeunload", (e) => {
  if (dirty) e.preventDefault();
});

renderChapters();
renderTalents();
