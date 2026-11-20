const DB_KEY = "focuslab_sessions_v1";
const TEST_KEY = "focuslab_test_v1";
const $ = (id) => document.getElementById(id);

function readSessions() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); }
  catch { return []; }
}
function writeSessions(items) { localStorage.setItem(DB_KEY, JSON.stringify(items)); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function renderDiary() {
  const items = readSessions();
  const total = items.reduce((sum, item) => sum + Number(item.minutes), 0);
  const avg = items.length ? (items.reduce((sum, item) => sum + Number(item.rating), 0) / items.length).toFixed(1) : "—";
  $("totalMinutes").textContent = total;
  $("totalSessions").textContent = items.length;
  $("averageRating").textContent = avg;
  const list = $("sessionList");
  if (!items.length) {
    list.innerHTML = '<p class="empty-state">Пока нет записей. Добавь первое занятие.</p>';
    return;
  }
  list.innerHTML = items.slice().reverse().map(item => `
    <div class="session-item">
      <div><strong>${escapeHtml(item.task)}</strong><small>${new Date(item.date).toLocaleString("ru-RU")} · оценка ${item.rating}/5</small></div>
      <b>${Number(item.minutes)} мин</b>
    </div>`).join("");
}
function addSession(item) {
  const items = readSessions();
  items.push({...item, date: new Date().toISOString()});
  writeSessions(items);
  renderDiary();
}
$("sessionForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  addSession({task: form.get("task").trim(), minutes: Number(form.get("minutes")), rating: Number(form.get("rating")), source: "manual"});
  event.currentTarget.reset();
  event.currentTarget.elements.minutes.value = 25;
});
$("clearHistory").addEventListener("click", () => {
  if (confirm("Удалить все записи дневника на этом устройстве?")) {
    writeSessions([]);
    renderDiary();
  }
});

const test = $("focusTest");
const selects = [...test.querySelectorAll("select")];
function updateProgress() {
  $("testProgress").textContent = `${selects.filter(s => s.value !== "").length} / 4`;
}
selects.forEach(s => s.addEventListener("change", updateProgress));
test.addEventListener("submit", event => {
  event.preventDefault();
  const score = selects.reduce((sum, s) => sum + Number(s.value), 0);
  const percent = Math.round(score / 12 * 100);
  let title, advice;
  if (percent >= 75) {
    title = "Хорошая субъективная оценка";
    advice = "Сохраняй удобный режим занятий и продолжай наблюдать за привычками.";
  } else if (percent >= 45) {
    title = "Есть пространство для улучшения";
    advice = "Попробуй короткие фокус-сессии и отключение необязательных уведомлений.";
  } else {
    title = "Стоит попробовать изменить режим";
    advice = "Начни с коротких интервалов по 10–15 минут и убери телефон из поля зрения.";
  }
  localStorage.setItem(TEST_KEY, JSON.stringify({score, percent, date: new Date().toISOString()}));
  $("testResult").hidden = false;
  $("testResult").innerHTML = `<strong>${percent}% — ${title}</strong>${advice}<br><small>Это ориентировочный результат самооценки, а не объективное измерение или диагноз.</small>`;
});
test.addEventListener("reset", () => {
  setTimeout(() => { updateProgress(); $("testResult").hidden = true; }, 0);
});

let selectedMinutes = 25;
let remaining = selectedMinutes * 60;
let timerId = null;
let running = false;
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function paintTimer() { $("timerDisplay").textContent = formatTime(remaining); }
function stopTimer() {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
  running = false;
  $("startTimer").textContent = "Начать";
}
function completeTimer() {
  stopTimer();
  $("timerHint").textContent = "Сессия завершена. Добавь её в дневник, чтобы сохранить результат.";
  if (selectedMinutes !== 5) {
    addSession({task: "Фокус-сессия (таймер)", minutes: selectedMinutes, rating: 4, source: "timer"});
  }
  $("timerCaption").textContent = "ВРЕМЯ ВЫШЛО";
}
document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    stopTimer();
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    selectedMinutes = Number(button.dataset.minutes);
    remaining = selectedMinutes * 60;
    $("timerCaption").textContent = selectedMinutes === 5 ? "КОРОТКИЙ ПЕРЕРЫВ" : selectedMinutes === 15 ? "ДЛИННЫЙ ПЕРЕРЫВ" : "ВРЕМЯ СОСРЕДОТОЧИТЬСЯ";
    $("timerHint").textContent = "Выбери задачу и убери лишние отвлечения.";
    paintTimer();
  });
});
$("startTimer").addEventListener("click", () => {
  if (running) { stopTimer(); return; }
  running = true;
  $("startTimer").textContent = "Пауза";
  timerId = setInterval(() => {
    remaining -= 1;
    paintTimer();
    if (remaining <= 0) completeTimer();
  }, 1000);
});
$("resetTimer").addEventListener("click", () => {
  stopTimer();
  remaining = selectedMinutes * 60;
  $("timerHint").textContent = "Таймер сброшен. Можно начать заново.";
  paintTimer();
});
$("exportData").addEventListener("click", () => {
  const items = readSessions();
  if (!items.length) { alert("В дневнике пока нет записей."); return; }
  const cols = ["task","minutes","rating","date","source"];
  const lines = [cols.join(";"), ...items.map(item => cols.map(key => `"${String(item[key] ?? "").replaceAll('"','""')}"`).join(";"))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "focuslab_sessions.csv"; a.click();
  URL.revokeObjectURL(url);
});
$("menuBtn").addEventListener("click", () => $("nav").classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a => a.addEventListener("click", () => $("nav").classList.remove("open")));
renderDiary();
paintTimer();
updateProgress();