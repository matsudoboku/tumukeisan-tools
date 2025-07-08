const STORAGE_KEY = 'tmt-data';
const DB_NAME = 'tmt-db';
const STORE_NAME = 'data';
let db = null;

let data = { tsums: [] };
let currentIndex = -1;
let timerInterval = null;
let startTime = 0;
let elapsedMs = 0;
let editIndex = -1; // index of tsum being edited
const TEST_NOTICE_KEY = 'tmt-test-notice-shown';

const ITEM_COST_TIME = 1000;
const ITEM_COST_54 = 1800;
const ITEM_COST_COIN = 500;

function $(id){ return document.getElementById(id); }

function openDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function getDb(){
  if(db) return db;
  db = await openDb();
  return db;
}

async function loadData(){
  try{
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(STORAGE_KEY);
    const result = await new Promise(resolve=>{
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if(result){
      data = result;
      return;
    }
  }catch(e){ }  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{ data = JSON.parse(saved); }catch(e){ data = { tsums: [] }; }
  }
  await saveData();
}

function saveData(){
  const json = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, json);
  getDb().then(db => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, STORAGE_KEY);
  });
}

function escapeHtml(str){
  return str.replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
}

function playNetCoins(p, rate){
  let cost = 0;
  if(p.items && p.items.time) cost += ITEM_COST_TIME;
  if(p.items && p.items.item54) cost += ITEM_COST_54;
  if(p.items && p.items.coin) cost += ITEM_COST_COIN;
  // **倍率(rate)はコインアイテム使用時のみ適用**
  if (p.items && p.items.coin) {
    return (p.coins * rate) - cost;
  } else {
    return p.coins - cost;
  }
}

function summarize(plays, rate){
  let totalCoins = 0, totalTime = 0, totalItems = 0, totalNetCoins = 0;
  plays.forEach(p => {
    totalCoins += p.coins;
    totalTime += p.timeSec;
    if(p.items && p.items.time) totalItems += ITEM_COST_TIME;
    if(p.items && p.items.item54) totalItems += ITEM_COST_54;
    if(p.items && p.items.coin) totalItems += ITEM_COST_COIN;
    totalNetCoins += playNetCoins(p, rate);
  });
  return { totalCoins, totalTime, totalItems, totalNetCoins };
}

function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function formatElapsed(ms){
  const sec = Math.floor(ms / 1000);
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  const t = Math.floor((ms%1000)/100);
  return `${m}:${s}.${t}`;
}

function formatNumber(num) {
  return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}


function renderTsumOptions(){
  const select = $('tsumSelect');
  select.innerHTML = '';
  data.tsums.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  if(data.tsums.length){
    currentIndex = currentIndex >=0 ? currentIndex : 0;
    select.value = currentIndex;
  } else {
    currentIndex = -1;
  }
}

function renderTsumList(){
  const list = $('tsumList');
  list.innerHTML = '';
  if(!data.tsums.length) return;
  const table = document.createElement('table');
  table.className = 'tsum-admin-table';
  table.innerHTML = '<thead><tr><th>ツム名</th><th>タイム</th><th>5→4</th><th>コイン</th><th>削除</th></tr></thead>';
  const tbody = document.createElement('tbody');
  data.tsums.forEach((t,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td><input type="checkbox" ${t.defaults.time?'checked':''} onchange="updateDefault(${i},'time',this.checked)"></td>
      <td><input type="checkbox" ${t.defaults.item54?'checked':''} onchange="updateDefault(${i},'item54',this.checked)"></td>
      <td><input type="checkbox" ${t.defaults.coin?'checked':''} onchange="updateDefault(${i},'coin',this.checked)"></td>
      <td><button class="delete-btn" onclick="deleteTsum(${i})">削除</button></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

function renderRanking(){
  const area = $('rankingArea');
  area.innerHTML = '';
  if(!data.tsums.length) return;
  const typeEl = $('rankingType');
  const type = typeEl ? typeEl.value : 'efficiency';
  const rate = parseFloat($("itemRate").value) || 1;
  const rows = data.tsums.map(t => {
    const { totalTime, totalNetCoins } = summarize(t.plays, rate);
    const count = t.plays.length;
    const perMin = totalTime ? (totalNetCoins) / (totalTime/60) : 0;
    const perHour = perMin * 60;
    const avgCoins = count ? totalNetCoins / count : 0;
    const avgTime = count ? totalTime / count : 0;
    return { tsum:t, perMin, perHour, avgCoins, avgTime, count };
  });
  if(type === 'average'){ rows.sort((a,b)=>b.avgCoins - a.avgCoins); }
  else { rows.sort((a,b)=>b.perMin - a.perMin); }
  const table = document.createElement('table');
  table.className = 'ranking';
  table.innerHTML = '<thead><tr><th>ツム名</th><th>効率(/分)</th><th>効率(/時)</th><th>平均プレイ時間</th><th>平均コイン</th><th>回数</th></tr></thead>';  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.tsum.name)}</td><td>${formatNumber(r.perMin)}</td><td>${formatNumber(r.perHour)}</td><td>${formatTime(r.avgTime)}</td><td>${formatNumber(r.avgCoins)}</td><td>${formatNumber(r.count)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  area.appendChild(table);
}

function renderPlays(){
  const tbody = $('plays');
  tbody.innerHTML = '';
  if(currentIndex<0) return;
  const tsum = data.tsums[currentIndex];
  tsum.plays.forEach((p,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatNumber(p.coins)}</td>
      <td>${p.items.time?'✓':''}</td>
      <td>${p.items.item54?'✓':''}</td>
      <td>${p.items.coin?'✓':''}</td>
      <td>${formatTime(p.timeSec)}</td>
      <td><button onclick="deletePlay(${i})">X</button></td>`;
    tbody.appendChild(tr);
  });
  $('playCount').textContent = formatNumber(tsum.plays.length);
  updateResultSummary();
}

function updateResultSummary(){
  const list = $('result');
  list.innerHTML = '';
  if(currentIndex < 0) return;
  const tsum = data.tsums[currentIndex];
  const count = tsum.plays.length;
  const rate = parseFloat($("itemRate").value) || 1;
  const { totalNetCoins, totalTime } = summarize(tsum.plays, rate);
  if(count === 0 || totalTime === 0) return;
  

  const perMin = totalNetCoins / (totalTime / 60);
  const perHour = perMin * 60;
  const avgCoins = totalNetCoins / count;
  const avgTime = totalTime / count;
  
  const effRankList = data.tsums.map(t => {
    const { totalNetCoins, totalTime } = summarize(t.plays, rate);
    const pm = totalTime ? totalNetCoins / (totalTime / 60) : 0;
    return { tsum: t, perMin: pm };
  }).sort((a,b) => b.perMin - a.perMin);
  const effRank = effRankList.findIndex(r => r.tsum === tsum) + 1;

  const avgCoinList = data.tsums.map(t => {
    const { totalNetCoins } = summarize(t.plays, rate);
    const c = t.plays.length;
    const avg = c ? totalNetCoins / c : 0;
    return { tsum: t, avgCoins: avg };
  }).sort((a,b) => b.avgCoins - a.avgCoins);
  const coinRank = avgCoinList.findIndex(r => r.tsum === tsum) + 1;

  const items = [
    `記録数: ${formatNumber(count)}`,
    `平均時間: ${formatTime(avgTime)}`,
    `平均コイン: ${formatNumber(avgCoins)}`,
    `効率(/分): ${formatNumber(perMin)}`,
    `効率(/時): ${formatNumber(perHour)}`,
    `効率ランク: ${formatNumber(effRank)}/${formatNumber(effRankList.length)}`,
    `平均コインランク: ${formatNumber(coinRank)}/${formatNumber(avgCoinList.length)}`
  ];
  items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
}

function renderAll(){
  renderTsumOptions();
  renderTsumList();
  renderRanking();
  renderPlays();
}

function addTsum(){
  const name = $('tsumInput').value.trim();
  if(!name) return;
  const defaults = {
    time: $('setTime').checked,
    item54: $('set54').checked,
    coin: $('setCoin').checked
  };
  if(editIndex >= 0){
    const tsum = data.tsums[editIndex];
    tsum.name = name;
    tsum.defaults = defaults;
    editIndex = -1;
    $('addTsumBtn').textContent = '追加';
  } else {
    const tsum = { name, defaults, plays: [] };
    data.tsums.push(tsum);
    currentIndex = data.tsums.length-1;
  }
  saveData();
  $('tsumInput').value='';
  $('setTime').checked = $('set54').checked = $('setCoin').checked = false;
  renderAll();
}

function editTsum(idx){
  const tsum = data.tsums[idx];
  $('tsumInput').value = tsum.name;
  $('setTime').checked = tsum.defaults.time;
  $('set54').checked = tsum.defaults.item54;
  $('setCoin').checked = tsum.defaults.coin;
  $('addTsumBtn').textContent = '更新';
  editIndex = idx;
  showTab(1);
}

function deleteTsum(idx){
  if(!confirm('削除しますか?')) return;
  data.tsums.splice(idx,1);
  if(currentIndex>=data.tsums.length) currentIndex = data.tsums.length-1;
    if(editIndex === idx){
    editIndex = -1;
    $('addTsumBtn').textContent = '追加';
    $('tsumInput').value = '';
    $('setTime').checked = $('set54').checked = $('setCoin').checked = false;
  } else if(editIndex > idx){
    editIndex--;
  }
  saveData();
  renderAll();
}

function updateDefault(idx, key, checked){
  const tsum = data.tsums[idx];
  tsum.defaults[key] = checked;
  saveData();
  if(idx === currentIndex){
    $('itemTime').checked = tsum.defaults.time;
    $('item54').checked = tsum.defaults.item54;
    $('itemCoin').checked = tsum.defaults.coin;
  }
}

function onSelectTsum(){
  currentIndex = parseInt($('tsumSelect').value,10) || 0;
  const tsum = data.tsums[currentIndex];
  $('itemTime').checked = tsum.defaults.time;
  $('item54').checked = tsum.defaults.item54;
  $('itemCoin').checked = tsum.defaults.coin;
  renderPlays();
}

function deletePlay(idx){
  if(!confirm('削除しますか?')) return;
  const tsum = data.tsums[currentIndex];
  tsum.plays.splice(idx,1);
  saveData();
  renderPlays();
  renderRanking();
}

function resetPlays(){
  if(currentIndex<0) return;
  if(!confirm('全記録を削除しますか?')) return;
  data.tsums[currentIndex].plays = [];
  saveData();
  renderPlays();
  renderRanking();
}

function addPlay(){
  if(currentIndex<0) return;
  const coins = parseInt($('coinInput').value,10) || 0;
  let timeSec = 0;
  if($('inputMode').value==='manual'){
    const min = parseInt($('manualMin').value,10)||0;
    const sec = parseInt($('manualSec').value,10)||0;
    timeSec = min*60 + sec;
  }else{
    timeSec = Math.round(elapsedMs/100)/10;
    clearInterval(timerInterval); timerInterval=null;
    $('timer').textContent='00:00.0';
    $('toggleBtn').textContent='スタート';
    elapsedMs = 0;
  }
  if(coins<=0 || timeSec<=0) return;
  const tsum = data.tsums[currentIndex];
  tsum.plays.push({
    coins,
    items:{
      time:$('itemTime').checked,
      item54:$('item54').checked,
      coin:$('itemCoin').checked
    },
    timeSec
  });
  $('coinInput').value=0;
  $('itemTime').checked = tsum.defaults.time;
  $('item54').checked = tsum.defaults.item54;
  $('itemCoin').checked = tsum.defaults.coin;
  saveData();
  renderPlays();
  renderRanking();
}

function switchInputMode(mode){
  if(mode==='manual'){
    $('manualRow').style.display='flex';
    $('stopwatchRow').style.display='none';
    $('addBtn').disabled=false;
  }else{
    $('manualRow').style.display='none';
    $('stopwatchRow').style.display='flex';
    $('addBtn').disabled=true;
  }
}

function togglePlay(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval=null;
    $('toggleBtn').textContent='スタート';
    $('addBtn').disabled=false;
  }else{
    startTime = Date.now();
    elapsedMs = 0;
    timerInterval=setInterval(()=>{
      elapsedMs = Date.now() - startTime;
      $('timer').textContent = formatElapsed(elapsedMs);
    },100);
    $('toggleBtn').textContent='ストップ';
    $('addBtn').disabled=true;
  }
}

function showTab(idx){
  document.querySelectorAll('.tab-content').forEach((el,i)=>{
    el.classList.toggle('active', i===idx);
  });
  document.querySelectorAll('.tab-btn').forEach((el,i)=>{
    el.classList.toggle('active', i===idx);
  });
}

function exportBackup(){
  const blob = new Blob([JSON.stringify(data)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tumukeisan-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      if(obj && Array.isArray(obj.tsums)){
        data = obj;
        saveData();
        renderAll();
      }
    }catch(err){
      alert('読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
}

function showTestNotice(){
  if(localStorage.getItem(TEST_NOTICE_KEY)) return;
  const dialog = document.getElementById('testNotice');
  const checkbox = document.getElementById('testNoticeCheck');
  const okBtn = document.getElementById('testNoticeOk');
  checkbox.checked = false;
  okBtn.disabled = true;
  checkbox.addEventListener('change', ()=>{
    okBtn.disabled = !checkbox.checked;
  });
  dialog.showModal();
  okBtn.addEventListener('click', ()=>{
    localStorage.setItem(TEST_NOTICE_KEY, '1');
    dialog.close();
  });
}

async function init(){
  await loadData();
  renderAll();
  switchInputMode('stopwatch');
  if(data.tsums.length>0) onSelectTsum();
  showTestNotice();
}

window.addEventListener('DOMContentLoaded', init);
