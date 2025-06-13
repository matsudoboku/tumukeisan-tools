const STORAGE_KEY = 'tmt-data';
let data = { tsums: [] };
let currentIndex = -1;
let timerInterval = null;
let startTime = 0;
let elapsedMs = 0;

function $(id){ return document.getElementById(id); }

function loadData(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{ data = JSON.parse(saved); }catch(e){ data = { tsums: [] }; }
  }
}

function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(str){
  return str.replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
}

function summarize(plays){
  let totalCoins = 0, totalTime = 0;
  plays.forEach(p => { totalCoins += p.coins; totalTime += p.timeSec; });
  return { totalCoins, totalTime };
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
      <td><input type="checkbox" ${t.defaults.time?'checked':''} disabled></td>
      <td><input type="checkbox" ${t.defaults.item54?'checked':''} disabled></td>
      <td><input type="checkbox" ${t.defaults.coin?'checked':''} disabled></td>
      <td><button onclick="deleteTsum(${i})">削除</button></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

function renderRanking(){
  const area = $('rankingArea');
  area.innerHTML = '';
  if(!data.tsums.length) return;
  const rows = data.tsums.map(t => {
    const {totalCoins, totalTime} = summarize(t.plays);
    const perMin = totalTime ? totalCoins / (totalTime/60) : 0;
    return { tsum:t, perMin, per30: perMin*30, total: totalCoins };
  }).sort((a,b)=>b.perMin - a.perMin);
  const table = document.createElement('table');
  table.className = 'ranking';
  table.innerHTML = '<thead><tr><th>ツム名</th><th>効率(/分)</th><th>効率(30分)</th><th>合計</th></tr></thead>';
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.tsum.name)}</td><td>${r.perMin.toFixed(1)}</td><td>${r.per30.toFixed(1)}</td><td>${r.total}</td>`;
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
      <td>${p.coins}</td>
      <td>${p.items.time?'✓':''}</td>
      <td>${p.items.item54?'✓':''}</td>
      <td>${p.items.coin?'✓':''}</td>
      <td>${formatTime(p.timeSec)}</td>
      <td><button onclick="deletePlay(${i})">X</button></td>`;
    tbody.appendChild(tr);
  });
  $('playCount').textContent = tsum.plays.length;
  updateResultSummary();
}

function updateResultSummary(){
  const div = $('result');
  if(currentIndex<0){ div.textContent=''; return; }
  const tsum = data.tsums[currentIndex];
  const {totalCoins, totalTime} = summarize(tsum.plays);
  if(totalTime===0){ div.textContent=''; return; }
  const perMin = totalCoins / (totalTime/60);
  const per30 = perMin*30;
  div.textContent = `合計 ${totalCoins}コイン / ${formatTime(totalTime)} (効率 ${perMin.toFixed(1)}/分, ${per30.toFixed(1)}/30分)`;
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
  const tsum = {
    name,
    defaults:{
      time:$('setTime').checked,
      item54:$('set54').checked,
      coin:$('setCoin').checked
    },
    plays:[]
  };
  data.tsums.push(tsum);
  saveData();
  $('tsumInput').value='';
  $('setTime').checked = $('set54').checked = $('setCoin').checked = false;
  currentIndex = data.tsums.length-1;
  renderAll();
}

function deleteTsum(idx){
  if(!confirm('削除しますか?')) return;
  data.tsums.splice(idx,1);
  if(currentIndex>=data.tsums.length) currentIndex = data.tsums.length-1;
  saveData();
  renderAll();
}

function onSelectTsum(){
  currentIndex = parseInt($('tsumSelect').value,10) || 0;
  renderPlays();
}

function deletePlay(idx){
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
  $('itemTime').checked = $('item54').checked = $('itemCoin').checked = false;
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

function init(){
  loadData();
  renderAll();
  switchInputMode('stopwatch');
  if(data.tsums.length>0) onSelectTsum();
}

window.addEventListener('DOMContentLoaded', init);
