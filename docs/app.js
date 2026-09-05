const fmtInt = new Intl.NumberFormat("en-US");
let projectSignature = "";
let loadedProjects = [];
let activeProjectFilter = "all";
let activeProjectIndex = 0;
let activeProjectId = "";
const visualizationSceneByProject = new Map();
let appConfig = {
  data_base_url: "data",
  grid_poll_ms: 5000,
  projects_poll_ms: 10000,
  github_url: "",
  stale_after_seconds: 180,
};

function cacheBusted(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

async function getJSON(url) {
  const response = await fetch(cacheBusted(url), { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

function dataURL(path) {
  const base = String(appConfig.data_base_url || "data").replace(/\/$/, "");
  return `${base}/${path}`;
}

function relativeURL(path, base) {
  return new URL(path, new URL(base, window.location.href)).toString();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function effectiveStatus(project) {
  const status = String(project.status || "unknown").toLowerCase();
  const updatedAt = Number(project.updated_at_unix || 0);
  const staleAfter = Number(appConfig.stale_after_seconds || 180);
  if ((status === "running" || status === "starting") &&
      updatedAt > 0 && (Date.now() / 1000 - updatedAt) > staleAfter) {
    return "stale";
  }
  return status;
}

function isRunningProject(project) {
  const status = effectiveStatus(project);
  return status === "running" || status === "starting";
}

function isCompletedProject(project) {
  return effectiveStatus(project) === "completed";
}

function formatBest(best) {
  if (!best) return { value: "—", unit: "", label: "Waiting for first result", status: "" };
  let value = best.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const decimals = Number.isInteger(best.decimals) ? best.decimals : 3;
    value = value.toFixed(Math.max(0, Math.min(9, decimals)));
  }
  return {
    value: displayValue(value),
    unit: String(best.unit || ""),
    label: displayValue(best.label || "Best result"),
    status: String(best.status || ""),
    help: String(best.help || ""),
  };
}

function renderMetric(metric) {
  const help = String(metric?.help || "");
  const helpAttributes = help
    ? ` tabindex="0" data-help="${escapeHTML(help)}" aria-haspopup="true"`
    : "";
  return `<div class="fact${help ? " has-help" : ""}"${helpAttributes}><span>${escapeHTML(metric?.label || "Metric")}</span><strong>${escapeHTML(displayValue(metric?.value))}</strong></div>`;
}

function renderProject(project) {
  const progress = project.progress || {};
  const current = Number(progress.current || 0);
  const total = Number(progress.total || 0);
  const percentage = total > 0 ? Math.min(100, current / total * 100) : 0;
  const throughput = Number(progress.throughput || 0);
  const best = formatBest(project.best);
  const status = effectiveStatus(project);
  const metrics = Array.isArray(project.metrics) ? project.metrics : [];
  const hasVisualization = Boolean(project.visualization?.code);

  const genericMetrics = [
    {
      label: progress.label || (progress.unit ? `${progress.unit} tested` : "Progress"),
      value: progress.display_value || (total ? `${fmtInt.format(current)} / ${fmtInt.format(total)}` : fmtInt.format(current)),
      help: progress.help || "",
    },
  ];
  if (progress.show_throughput !== false && (progress.throughput_unit || throughput > 0)) {
    genericMetrics.push({
      label: progress.throughput_label || "Throughput",
      value: `${throughput.toFixed(2)} ${progress.throughput_unit || "/ s"}`,
      help: progress.throughput_help || "",
    });
  }

  const visualizationHTML = hasVisualization ? `
    <div class="visualization-wrap" data-visualization="${escapeHTML(project.id)}">
      <div class="visualization-loading">Loading visualization…</div>
    </div>` : "";

  return `
    <article class="project-card ${hasVisualization ? "has-visualization" : "no-visualization"}" data-project="${escapeHTML(project.id)}">
      <div class="project-top">
        <div>
          <h3>${escapeHTML(project.title || project.id)}</h3>
          <p class="project-description">${escapeHTML(project.description || "")}</p>
        </div>
        <span class="status ${escapeHTML(status)}">${escapeHTML(status)}</span>
      </div>
      <div class="project-grid">
        ${visualizationHTML}
        <div class="best">
          <div class="best-headline${best.help ? " has-help" : ""}"${best.help ? ` tabindex="0" data-help="${escapeHTML(best.help)}" aria-haspopup="true"` : ""}>
            <div class="best-label">${escapeHTML(best.label)}</div>
            <div class="best-value">${escapeHTML(best.value)}${best.unit ? ` <small>${escapeHTML(best.unit)}</small>` : ""}</div>
          </div>
          ${best.status ? `<div class="result-status">${escapeHTML(best.status)}</div>` : ""}
          <div class="project-facts">
            ${[...genericMetrics, ...metrics].map(renderMetric).join("")}
          </div>
        </div>
      </div>
      <div class="progress-line"><div style="width:${percentage.toFixed(2)}%"></div></div>
    </article>`;
}

function base64UTF8(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function visualizationSource(project, initialScene = 0) {
  const visualization = project.visualization || {};
  const projectMetadata = { ...project };
  delete projectMetadata.visualization;
  const packed = base64UTF8({
    project: projectMetadata,
    code: String(visualization.code || ""),
    data: visualization.data ?? {},
    scene: Number.isInteger(initialScene) ? initialScene : 0,
  });

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
<style>html,body,#root{margin:0;width:100%;height:100%;min-height:280px;background:#0a1016;overflow:hidden}*{box-sizing:border-box}</style>
</head><body><div id="root"></div><script>
(function(){
  const binary=atob("${packed}");
  const bytes=Uint8Array.from(binary, c => c.charCodeAt(0));
  const payload=JSON.parse(new TextDecoder().decode(bytes));
  const root=document.getElementById("root");
  try {
    new Function("root", "project", "data", "initialScene", payload.code)(root, payload.project, payload.data, payload.scene);
  } catch (error) {
    root.innerHTML='<div style="height:280px;display:grid;place-items:center;color:#a98262;font:13px system-ui,sans-serif">Visualization error</div>';
    console.error(error);
  }
})();
<\/script></body></html>`;
}

function mountVisualization(project) {
  if (!project.visualization?.code) return;
  const target = document.querySelector(`[data-project="${CSS.escape(project.id)}"] [data-visualization]`);
  if (!target) return;

  const iframe = document.createElement("iframe");
  iframe.className = "project-visualization";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("title", `${project.title || project.id} visualization`);
  iframe.srcdoc = visualizationSource(project, visualizationSceneByProject.get(project.id) || 0);
  target.replaceChildren(iframe);
}


window.addEventListener("message", event => {
  const message = event.data;
  if (!message || message.type !== "alinoe-visualization-scene") return;
  const projectId = String(message.projectId || "");
  const scene = Number(message.scene);
  if (!projectId || !Number.isInteger(scene) || scene < 0 || scene > 15) return;
  visualizationSceneByProject.set(projectId, scene);
});

let helpTooltip = null;
let helpTarget = null;

function ensureHelpTooltip() {
  if (helpTooltip) return helpTooltip;
  helpTooltip = document.createElement("div");
  helpTooltip.id = "metricHelpTooltip";
  helpTooltip.className = "help-tooltip";
  helpTooltip.setAttribute("role", "tooltip");
  helpTooltip.hidden = true;
  document.body.appendChild(helpTooltip);
  return helpTooltip;
}

function positionHelpTooltip(target) {
  const tooltip = ensureHelpTooltip();
  const rect = target.getBoundingClientRect();
  const margin = 10;
  const maxLeft = Math.max(margin, window.innerWidth - tooltip.offsetWidth - margin);
  let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
  left = Math.max(margin, Math.min(maxLeft, left));
  let top = rect.top - tooltip.offsetHeight - margin;
  if (top < margin) top = rect.bottom + margin;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function showHelpTooltip(target) {
  const help = String(target?.dataset?.help || "").trim();
  if (!help) return;
  const tooltip = ensureHelpTooltip();
  helpTarget = target;
  tooltip.textContent = help;
  tooltip.hidden = false;
  target.setAttribute("aria-describedby", tooltip.id);
  requestAnimationFrame(() => positionHelpTooltip(target));
}

function hideHelpTooltip(target = null) {
  if (target && helpTarget && target !== helpTarget) return;
  if (helpTarget) helpTarget.removeAttribute("aria-describedby");
  helpTarget = null;
  if (helpTooltip) helpTooltip.hidden = true;
}

function installHelpTooltips() {
  ensureHelpTooltip();
  document.addEventListener("mouseover", event => {
    const target = event.target.closest?.(".has-help[data-help]");
    if (target) showHelpTooltip(target);
  });
  document.addEventListener("mouseout", event => {
    const target = event.target.closest?.(".has-help[data-help]");
    if (target && !target.contains(event.relatedTarget)) hideHelpTooltip(target);
  });
  document.addEventListener("focusin", event => {
    const target = event.target.closest?.(".has-help[data-help]");
    if (target) showHelpTooltip(target);
  });
  document.addEventListener("focusout", event => {
    const target = event.target.closest?.(".has-help[data-help]");
    if (target) hideHelpTooltip(target);
  });
  window.addEventListener("resize", () => {
    if (helpTarget && helpTooltip && !helpTooltip.hidden) positionHelpTooltip(helpTarget);
  });
  window.addEventListener("scroll", () => {
    if (helpTarget && helpTooltip && !helpTooltip.hidden) positionHelpTooltip(helpTarget);
  }, {passive: true});
}

function filteredProjects() {
  if (activeProjectFilter === "running") return loadedProjects.filter(isRunningProject);
  if (activeProjectFilter === "completed") return loadedProjects.filter(isCompletedProject);
  return loadedProjects;
}

function updateProjectCounts() {
  const running = loadedProjects.filter(isRunningProject).length;
  const completed = loadedProjects.filter(isCompletedProject).length;
  const total = loadedProjects.length;

  document.getElementById("gridProjectsRunning").textContent = fmtInt.format(running);
  document.getElementById("gridProjectsCompleted").textContent = fmtInt.format(completed);
  document.getElementById("filterAllCount").textContent = fmtInt.format(total);
  document.getElementById("filterRunningCount").textContent = fmtInt.format(running);
  document.getElementById("filterCompletedCount").textContent = fmtInt.format(completed);
}

function updateProjectNavigation(projects) {
  const previous = document.getElementById("projectPrevious");
  const next = document.getElementById("projectNext");
  const position = document.getElementById("projectPosition");
  const total = projects.length;

  if (position) {
    position.textContent = total ? `${activeProjectIndex + 1} / ${total}` : `0 / 0`;
  }

  const disabled = total <= 1;
  previous.disabled = disabled;
  next.disabled = disabled;
}

function renderProjects() {
  const track = document.getElementById("projectsTrack");
  const projects = filteredProjects();
  updateProjectCounts();

  document.querySelectorAll(".filter").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === activeProjectFilter);
  });

  if (!projects.length) {
    activeProjectIndex = 0;
    activeProjectId = "";
    updateProjectNavigation(projects);
    track.innerHTML = `<article class="project-card loading-card">No ${escapeHTML(activeProjectFilter === "all" ? "" : activeProjectFilter + " ")}projects yet.</article>`;
    return;
  }

  const rememberedIndex = projects.findIndex(project => project.id === activeProjectId);
  if (rememberedIndex >= 0) {
    activeProjectIndex = rememberedIndex;
  }
  if (activeProjectIndex < 0) activeProjectIndex = 0;
  if (activeProjectIndex >= projects.length) activeProjectIndex = projects.length - 1;

  const project = projects[activeProjectIndex];
  activeProjectId = project.id;
  updateProjectNavigation(projects);

  track.innerHTML = renderProject(project);
  mountVisualization(project);
}

async function loadProjects() {
  try {
    const indexUrl = dataURL("projects/index.json");
    const index = await getJSON(indexUrl);
    const loaded = await Promise.all((index.projects || []).map(async item => {
      const projectUrl = relativeURL(item.json, indexUrl);
      return getJSON(projectUrl);
    }));

    const signature = JSON.stringify(loaded);
    if (signature === projectSignature) {
      updateProjectCounts();
      return;
    }
    projectSignature = signature;
    loadedProjects = loaded;
    renderProjects();
  } catch (_) {
    loadedProjects = [];
    projectSignature = "";
    renderProjects();
  }
}

function updateGrid(grid) {
  document.getElementById("nodesOnline").textContent = fmtInt.format(grid.nodes_online || 0);
  document.getElementById("tasksComputing").textContent = fmtInt.format(grid.tasks_computing || 0);
  document.getElementById("tasksCompleted").textContent = fmtInt.format(grid.tasks_completed || 0);
  document.getElementById("tasksOpen").textContent = fmtInt.format(grid.tasks_open || 0);
  document.getElementById("projectsOnline").textContent = fmtInt.format(grid.projects_online || 0);
  document.getElementById("lastUpdate").textContent = grid.updated_at_unix
    ? new Date(grid.updated_at_unix * 1000).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"})
    : "—";

  const list = document.getElementById("nodeList");
  const nodes = grid.nodes || [];
  list.innerHTML = nodes.length ? nodes.map(node => `
    <span class="node ${escapeHTML(node.state)}" title="${escapeHTML(node.project || "idle")}">
      <i class="dot"></i>${escapeHTML(node.name)}
      ${node.state === "computing" ? `<span class="node-score">task #${escapeHTML(node.task_id)}</span>` : ""}
      <span class="node-score">${Number(node.score || 0)}%</span>
    </span>`).join("") : `<span class="muted">No nodes online.</span>`;
}

async function pollGrid() {
  try { updateGrid(await getJSON(dataURL("grid.json"))); } catch (_) {}
  setTimeout(pollGrid, Number(appConfig.grid_poll_ms || 5000));
}

function scrollProjects(direction) {
  const projects = filteredProjects();
  if (projects.length <= 1) return;

  activeProjectIndex += direction;
  if (activeProjectIndex < 0) activeProjectIndex = projects.length - 1;
  if (activeProjectIndex >= projects.length) activeProjectIndex = 0;

  activeProjectId = projects[activeProjectIndex].id;
  renderProjects();
}

async function loadConfig() {
  try {
    const config = await getJSON("config.json");
    appConfig = {...appConfig, ...config};
  } catch (_) {}

  if (appConfig.github_url) {
    const link = document.getElementById("githubLink");
    link.href = appConfig.github_url;
    link.hidden = false;
  }
}

async function startApp() {
  await loadConfig();
  installHelpTooltips();

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      activeProjectFilter = button.dataset.filter || "all";
      activeProjectIndex = 0;
      activeProjectId = "";
      renderProjects();
    });
  });
  document.getElementById("projectPrevious").addEventListener("click", () => scrollProjects(-1));
  document.getElementById("projectNext").addEventListener("click", () => scrollProjects(1));

  await loadProjects();
  pollGrid();
  setInterval(loadProjects, Number(appConfig.projects_poll_ms || 10000));
}

startApp();
