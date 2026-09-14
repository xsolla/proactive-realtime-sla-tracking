const STATUS_LABELS = {
  on_track: "On track",
  at_risk: "At risk",
  breaching: "Breaching",
  met: "Met",
  breached: "Breached",
};

const cardsEl = document.getElementById("cards");
const emptyEl = document.getElementById("empty");
const updatedEl = document.getElementById("updated");
const liveDot = document.getElementById("live-dot");
const liveLabel = document.getElementById("live-label");

let latest = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${pad(minutes % 60)}m`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function remainingText(evaluation, resolved) {
  if (resolved) return STATUS_LABELS[evaluation.status];
  if (evaluation.remainingMs <= 0) {
    return `OVERDUE by ${formatDuration(evaluation.remainingMs)}`;
  }
  return `${formatDuration(evaluation.remainingMs)} left`;
}

function renderSummary(counts) {
  for (const [status, count] of Object.entries(counts)) {
    const el = document.querySelector(`.chip-count[data-count="${status}"]`);
    if (el) el.textContent = String(count);
  }
}

async function resolveCommitment(id, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/commitments/${id}/resolve`, { method: "POST" });
    if (res.ok) {
      const snapshot = await res.json();
      render(snapshot);
    } else {
      button.disabled = false;
    }
  } catch (err) {
    button.disabled = false;
  }
}

function createCard(item) {
  const { evaluation, partner } = item;
  const resolved = item.resolvedAt !== null;
  const pct = Math.min(100, Math.max(0, evaluation.percentUsed * 100));

  const card = document.createElement("article");
  card.className = `card status-${evaluation.status}`;

  const top = document.createElement("div");
  top.className = "card-top";
  top.innerHTML = `
    <span class="partner">${partner.name}
      <span class="tier tier--${partner.tier}">${partner.tier}</span>
    </span>
    <span class="badge badge--${evaluation.status}">${STATUS_LABELS[evaluation.status]}</span>
  `;

  const subject = document.createElement("div");
  subject.className = "subject";
  subject.textContent = item.subject;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <span class="priority">${item.priority}</span>
    <span>·</span>
    <span>budget ${item.targetMinutes}m</span>
    <span>·</span>
    <span>${Math.round(evaluation.percentUsed * 100)}% used</span>
  `;

  const progress = document.createElement("div");
  progress.className = "progress";
  const bar = document.createElement("div");
  bar.className = `progress-bar ${evaluation.status}`;
  bar.style.width = `${pct}%`;
  progress.appendChild(bar);

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const countdown = document.createElement("span");
  countdown.className = "countdown";
  if (!resolved && evaluation.remainingMs <= 0) countdown.classList.add("overdue");
  countdown.textContent = remainingText(evaluation, resolved);
  bottom.appendChild(countdown);

  if (resolved) {
    const tag = document.createElement("span");
    tag.className = "resolved-tag";
    tag.textContent = "Resolved";
    bottom.appendChild(tag);
  } else {
    const btn = document.createElement("button");
    btn.className = "resolve-btn";
    btn.textContent = "Resolve";
    btn.addEventListener("click", () => resolveCommitment(item.id, btn));
    bottom.appendChild(btn);
  }

  card.append(top, subject, meta, progress, bottom);
  return card;
}

function render(snapshot) {
  latest = snapshot;
  renderSummary(snapshot.counts);

  cardsEl.innerHTML = "";
  if (!snapshot.commitments.length) {
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
    for (const item of snapshot.commitments) {
      cardsEl.appendChild(createCard(item));
    }
  }

  const time = new Date(snapshot.now).toLocaleTimeString();
  updatedEl.textContent = `${snapshot.activeCount} active · updated ${time}`;
}

function setLive(state) {
  liveDot.classList.remove("is-live", "is-down");
  if (state === "live") {
    liveDot.classList.add("is-live");
    liveLabel.textContent = "live";
  } else if (state === "down") {
    liveDot.classList.add("is-down");
    liveLabel.textContent = "reconnecting…";
  } else {
    liveLabel.textContent = "connecting…";
  }
}

function connect() {
  const source = new EventSource("/api/stream");
  source.onopen = () => setLive("live");
  source.onmessage = (event) => {
    try {
      render(JSON.parse(event.data));
      setLive("live");
    } catch (err) {
      /* ignore malformed frame */
    }
  };
  source.onerror = () => {
    setLive("down");
    // EventSource auto-reconnects; nothing else to do.
  };
}

// Initial paint from a plain fetch, then switch to the live stream.
fetch("/api/state")
  .then((res) => res.json())
  .then(render)
  .catch(() => {});

connect();
