let hourlyRate = 0;
let startTime = null;
let elapsed = 0; // current session seconds
let timerId = null;

// Start timer
function startTimer() {
  if (timerId) return; // already running
  const rateInput = document.getElementById('hourlyRate');
  hourlyRate = Number(rateInput.value) || 0;
  startTime = Date.now();
  timerId = setInterval(update, 1000);
  update();
}

// Stop timer and save session
function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  if (startTime) {
    elapsed += Math.floor((Date.now() - startTime) / 1000);
    saveSession(elapsed);
  }
  elapsed = 0;
  startTime = null;
}

// Update current earning display
function update() {
  if (!startTime) return;
  const totalSeconds = elapsed + Math.floor((Date.now() - startTime) / 1000);
  const earned = (hourlyRate / 3600) * totalSeconds;
  document.getElementById('current').textContent = earned.toFixed(2) + '円';

  const data = JSON.parse(localStorage.getItem('timeData') || '{}');
  const now = new Date();
  const yearKey = now.getFullYear().toString();
  const monthKey = `${yearKey}-${now.getMonth() + 1}`;
  const weekKey = `${yearKey}-W${getWeekNumber(now)}`;

  displayTotals(data, totalSeconds);
  checkReminders((data[yearKey] || 0) + totalSeconds);
}

// Helpers for week number (ISO week)
function getWeekNumber(date) {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// Save session seconds to localStorage for year/month/week
function saveSession(seconds) {
  const data = JSON.parse(localStorage.getItem('timeData') || '{}');
  const now = new Date();
  const yearKey = now.getFullYear().toString();
  const monthKey = `${yearKey}-${now.getMonth() + 1}`;
  const weekKey = `${yearKey}-W${getWeekNumber(now)}`;

  data[yearKey] = (data[yearKey] || 0) + seconds;
  data[monthKey] = (data[monthKey] || 0) + seconds;
  data[weekKey] = (data[weekKey] || 0) + seconds;

  localStorage.setItem('timeData', JSON.stringify(data));
  displayTotals(data);
  checkReminders(data[yearKey]);
}

// Display totals for current year/month/week
function displayTotals(data, extraSec = 0) {
  const now = new Date();
  const yearKey = now.getFullYear().toString();
  const monthKey = `${yearKey}-${now.getMonth() + 1}`;
  const weekKey = `${yearKey}-W${getWeekNumber(now)}`;

  const yearSec = (data[yearKey] || 0) + extraSec;
  const monthSec = (data[monthKey] || 0) + extraSec;
  const weekSec = (data[weekKey] || 0) + extraSec;

  document.getElementById('yearTotal').textContent = ((hourlyRate / 3600) * yearSec).toFixed(2) + '円';
  document.getElementById('monthTotal').textContent = ((hourlyRate / 3600) * monthSec).toFixed(2) + '円';
  document.getElementById('weekTotal').textContent = ((hourlyRate / 3600) * weekSec).toFixed(2) + '円';
}

// Reminders based on yearly earnings
function checkReminders(yearSec) {
  const earned = (hourlyRate / 3600) * yearSec;
  if (earned >= 1500000) {
    alert('年間収入が150万円を超えました。確定申告の要否を確認してください。');
  } else if (earned >= 1300000) {
    alert('年間収入が130万円を超えました。社会保険の扶養判定に注意してください。');
  } else if (earned >= 1030000) {
    alert('年間収入が103万円を超えました。扶養控除への影響にご注意ください。');
  }
}

// Load totals on page load
window.addEventListener('DOMContentLoaded', () => {
  const data = JSON.parse(localStorage.getItem('timeData') || '{}');
  const rateInput = document.getElementById('hourlyRate');
  hourlyRate = Number(rateInput.value) || 0;
  displayTotals(data);

  document.getElementById('startBtn').addEventListener('click', startTimer);
  document.getElementById('stopBtn').addEventListener('click', stopTimer);
});
