let hourlyRate = 0;
let startTime = null;
let timerId = null;
let userId = null;
let idToken = null;
let data = { totals: {}, records: [] };

function getWeekNumber(date) {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function computeTotals(records) {
  const totals = {};
  records.forEach(rec => {
    const start = new Date(rec.start);
    const yearKey = start.getFullYear().toString();
    const monthKey = `${yearKey}-${start.getMonth() + 1}`;
    const weekKey = `${yearKey}-W${getWeekNumber(start)}`;
    totals[yearKey] = (totals[yearKey] || 0) + rec.seconds;
    totals[monthKey] = (totals[monthKey] || 0) + rec.seconds;
    totals[weekKey] = (totals[weekKey] || 0) + rec.seconds;
  });
  return totals;
}

function displayTotals(totals, extra = 0) {
  const now = new Date();
  const yearKey = now.getFullYear().toString();
  const monthKey = `${yearKey}-${now.getMonth() + 1}`;
  const weekKey = `${yearKey}-W${getWeekNumber(now)}`;
  const yearSec = (totals[yearKey] || 0) + extra;
  const monthSec = (totals[monthKey] || 0) + extra;
  const weekSec = (totals[weekKey] || 0) + extra;
  document.getElementById('yearTotal').textContent = ((hourlyRate / 3600) * yearSec).toFixed(2) + '円';
  document.getElementById('monthTotal').textContent = ((hourlyRate / 3600) * monthSec).toFixed(2) + '円';
  document.getElementById('weekTotal').textContent = ((hourlyRate / 3600) * weekSec).toFixed(2) + '円';
  checkReminders(yearSec);
}

function renderHistory() {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '';
  data.records.forEach((rec, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(rec.start).toLocaleString()}</td>` +
                   `<td>${new Date(rec.end).toLocaleString()}</td>` +
                   `<td>${rec.rate}</td>` +
                   `<td>${rec.seconds}</td>` +
                   `<td><button data-edit="${idx}">編集</button> <button data-del="${idx}">削除</button></td>`;
    tbody.appendChild(tr);
  });
}

async function sendData() {
  if (!userId || !idToken) return;
  await fetch(`/data/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken
    },
    body: JSON.stringify(data)
  });
}

async function loadData() {
  if (!userId || !idToken) return;
  const res = await fetch(`/data/${encodeURIComponent(userId)}`, {
    headers: { 'Authorization': 'Bearer ' + idToken }
  });
  if (res.ok) {
    data = await res.json();
  }
  if (!data.records) data.records = [];
  if (!data.totals) data.totals = {};
  displayTotals(data.totals);
  renderHistory();
}

function startTimer() {
  if (timerId || !userId) return;
  hourlyRate = Number(document.getElementById('hourlyRate').value) || 0;
  startTime = Date.now();
  timerId = setInterval(update, 1000);
  update();
}

function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const record = {
    start: new Date(startTime).toISOString(),
    end: new Date().toISOString(),
    seconds,
    rate: hourlyRate
  };
  data.records.push(record);
  if (data.records.length > 100) data.records = data.records.slice(-100);
  data.totals = computeTotals(data.records);
  sendData();
  renderHistory();
  displayTotals(data.totals);
  startTime = null;
}

function update() {
  if (!startTime) return;
  const sec = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('current').textContent = ((hourlyRate / 3600) * sec).toFixed(2) + '円';
  displayTotals(data.totals, sec);
}

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

function editRecord(index) {
  const rec = data.records[index];
  const startStr = prompt('開始時刻を入力 (YYYY-MM-DD HH:MM)', rec.start.replace('T', ' ').slice(0,16));
  const endStr = prompt('終了時刻を入力 (YYYY-MM-DD HH:MM)', rec.end.replace('T', ' ').slice(0,16));
  const rate = Number(prompt('時給を入力', rec.rate));
  if (!startStr || !endStr || !rate) return;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start) || isNaN(end) || end <= start) return;
  rec.start = start.toISOString();
  rec.end = end.toISOString();
  rec.rate = rate;
  rec.seconds = Math.floor((end - start) / 1000);
  data.totals = computeTotals(data.records);
  sendData();
  renderHistory();
  displayTotals(data.totals);
}

function deleteRecord(index) {
  if (!confirm('この記録を削除しますか?')) return;
  data.records.splice(index, 1);
  data.totals = computeTotals(data.records);
  sendData();
  renderHistory();
  displayTotals(data.totals);
}

function undoLast() {
  if (data.records.length === 0) return;
  if (!confirm('直前のセッションを取り消しますか?')) return;
  data.records.pop();
  data.totals = computeTotals(data.records);
  sendData();
  renderHistory();
  displayTotals(data.totals);
}

function exportCsv() {
  const lines = ['date,start,end,seconds,amount'];
  data.records.forEach(rec => {
    const start = new Date(rec.start).toISOString();
    const end = new Date(rec.end).toISOString();
    const earned = (rec.rate / 3600) * rec.seconds;
    lines.push(`${start.slice(0,10)},${start},${end},${rec.seconds},${earned}`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'history.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'history.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleLogin(event) {
  const detail = event.detail;
  if (detail && detail.user) {
    userId = detail.user;
    idToken = detail.authorization ? detail.authorization.id_token : null;
    localStorage.setItem('userId', userId);
    if (idToken) localStorage.setItem('idToken', idToken);
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainSection').style.display = 'block';
    document.getElementById('userInfo').textContent = 'ようこそ ' + userId + ' さん';
    loadData();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  hourlyRate = Number(document.getElementById('hourlyRate').value) || 0;
  userId = localStorage.getItem('userId');
  idToken = localStorage.getItem('idToken');

  if (userId && idToken) {
    document.getElementById('mainSection').style.display = 'block';
    document.getElementById('userInfo').textContent = 'ようこそ ' + userId + ' さん';
    loadData();
  } else {
    document.getElementById('loginSection').style.display = 'block';
  }

  if (window.AppleID) {
    AppleID.auth.init({
      clientId: 'com.example.web',
      scope: 'name email',
      redirectURI: location.href,
      usePopup: true
    });
  }

  document.addEventListener('AppleIDSignInOnSuccess', handleLogin);
  document.getElementById('startBtn').addEventListener('click', startTimer);
  document.getElementById('stopBtn').addEventListener('click', stopTimer);
  document.getElementById('undoBtn').addEventListener('click', undoLast);
  document.getElementById('historyBtn').addEventListener('click', () => {
    const sec = document.getElementById('historySection');
    sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
    renderHistory();
  });
  document.getElementById('historyBody').addEventListener('click', e => {
    if (e.target.dataset.edit) {
      editRecord(Number(e.target.dataset.edit));
    } else if (e.target.dataset.del) {
      deleteRecord(Number(e.target.dataset.del));
    }
  });
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('exportJson').addEventListener('click', exportJson);
});
