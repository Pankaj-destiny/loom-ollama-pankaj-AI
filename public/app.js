/* ---------- Shared state ---------- */
let chats = {};
let currentId = null;
let sending = false;

/* ---------- Tabs ---------- */
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
}

/* ---------- Sidebar / theme ---------- */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function toggleTheme() {
  const root = document.documentElement;
  root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
function currentLang() { return document.getElementById('lang-select').value; }

/* ---------- Credits badge ---------- */
async function refreshCredits() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    document.getElementById('credits-badge').textContent = data.credits + ' credits · ' + data.plan;
  } catch (e) { /* ignore */ }
}
refreshCredits();

/* ---------- Chat ---------- */
function uid() { return 'c' + Date.now() + Math.floor(Math.random() * 1000); }

function newChat() {
  const id = uid();
  chats[id] = { title: 'New chat', messages: [] };
  currentId = id;
  renderHistory();
  renderChat();
  if (window.innerWidth <= 720) document.getElementById('sidebar').classList.add('collapsed');
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  Object.keys(chats).sort((a, b) => b.localeCompare(a)).forEach(id => {
    const div = document.createElement('div');
    div.className = 'history-item' + (id === currentId ? ' active' : '');
    div.textContent = chats[id].title;
    div.onclick = () => { currentId = id; renderHistory(); renderChat(); };
    list.appendChild(div);
  });
}

function renderChat() {
  const inner = document.getElementById('chat-inner');
  const empty = document.getElementById('empty-state');
  inner.innerHTML = '';
  if (!currentId || chats[currentId].messages.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  chats[currentId].messages.forEach(m => appendBubble(m.role, m.content, false));
  scrollToBottom();
}

function appendBubble(role, content, animate) {
  const inner = document.getElementById('chat-inner');
  document.getElementById('empty-state').style.display = 'none';
  const row = document.createElement('div');
  row.className = 'msg-row ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (role === 'user' ? 'user' : 'ai');
  avatar.textContent = role === 'user' ? 'You' : 'L';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  row.appendChild(avatar);
  row.appendChild(bubble);
  inner.appendChild(row);
  if (animate) scrollToBottom();
  return bubble;
}

function scrollToBottom() {
  const scroll = document.getElementById('chat-scroll');
  scroll.scrollTop = scroll.scrollHeight;
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function useSuggestion(el) {
  document.getElementById('input').value = el.textContent;
  sendMessage();
}

async function sendMessage() {
  if (sending) return;
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  if (!currentId) newChat();

  input.value = '';
  autoGrow(input);
  sending = true;
  document.getElementById('send-btn').disabled = true;

  const chat = chats[currentId];
  chat.messages.push({ role: 'user', content: text });
  if (chat.messages.length === 1) {
    chat.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    renderHistory();
  }
  appendBubble('user', text, true);

  const typingBubble = appendBubble('assistant', 'Thinking…', true);
  typingBubble.classList.add('typing');
  let fullText = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chat.messages, lang: currentLang() })
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('Server error ' + res.status));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.text) {
            if (typingBubble.classList.contains('typing')) typingBubble.classList.remove('typing');
            fullText += json.text;
            typingBubble.textContent = fullText;
            scrollToBottom();
          }
        } catch (e) { /* ignore */ }
      }
    }

    chat.messages.push({ role: 'assistant', content: fullText || '(no response)' });
    if (!fullText) typingBubble.textContent = '(no response)';
  } catch (err) {
    typingBubble.classList.remove('typing');
    typingBubble.textContent = 'Something went wrong: ' + err.message;
  } finally {
    sending = false;
    document.getElementById('send-btn').disabled = false;
    scrollToBottom();
    refreshCredits();
  }
}

/* ---------- Fact-check agent ---------- */
async function runFactcheck() {
  const input = document.getElementById('fc-input');
  const claim = input.value.trim();
  if (!claim) return;
  const btn = document.getElementById('fc-btn');
  const result = document.getElementById('fc-result');
  btn.disabled = true;
  result.innerHTML = '<p style="color:var(--text-dim)">Checking sources…</p>';

  try {
    const res = await fetch('/api/factcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, lang: currentLang() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');

    const verdictClass = 'verdict-' + (data.verdict || 'UNVERIFIED').replace(' ', '');
    const sourcesHtml = data.sources && data.sources.length
      ? '<div class="fc-sources"><strong>Sources checked:</strong><br>' +
        data.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>`).join('<br>') +
        '</div>'
      : '<div class="fc-sources">⚠ No live search configured — see README to add TAVILY_API_KEY for real source checking.</div>';

    result.innerHTML = `
      <span class="verdict-badge ${verdictClass}">${data.verdict}</span>
      <div class="fc-body">${data.reply.replace(/</g, '&lt;')}</div>
      ${sourcesHtml}
    `;
  } catch (err) {
    result.innerHTML = '<p style="color:#e06c6c">' + err.message + '</p>';
  } finally {
    btn.disabled = false;
    refreshCredits();
  }
}

/* ---------- Image editor (canvas) ---------- */
let imgCanvas, imgCtx, originalImageData = null, loadedImg = null;

function initImageEditor() {
  imgCanvas = document.getElementById('img-canvas');
  imgCtx = imgCanvas.getContext('2d');
  document.getElementById('img-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      loadedImg = img;
      const scale = Math.min(imgCanvas.width / img.width, imgCanvas.height / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      imgCanvas.width = w; imgCanvas.height = h;
      imgCtx.drawImage(img, 0, 0, w, h);
      originalImageData = imgCtx.getImageData(0, 0, w, h);
    };
    img.src = URL.createObjectURL(file);
  });
}

function addTextOverlay() {
  const text = document.getElementById('overlay-text').value;
  if (!text || !imgCtx) return;
  imgCtx.font = 'bold 28px sans-serif';
  imgCtx.fillStyle = '#ffffff';
  imgCtx.strokeStyle = '#000000';
  imgCtx.lineWidth = 4;
  imgCtx.textAlign = 'center';
  const x = imgCanvas.width / 2;
  const y = imgCanvas.height - 24;
  imgCtx.strokeText(text, x, y);
  imgCtx.fillText(text, x, y);
}

function applyFilter(type) {
  if (!imgCtx) return;
  const data = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (type === 'grayscale') {
      const avg = (px[i] + px[i + 1] + px[i + 2]) / 3;
      px[i] = px[i + 1] = px[i + 2] = avg;
    } else if (type === 'bright') {
      px[i] = Math.min(255, px[i] * 1.2);
      px[i + 1] = Math.min(255, px[i + 1] * 1.2);
      px[i + 2] = Math.min(255, px[i + 2] * 1.2);
    }
  }
  imgCtx.putImageData(data, 0, 0);
}

function resetImage() {
  if (originalImageData) imgCtx.putImageData(originalImageData, 0, 0);
}

function downloadImage() {
  if (!imgCanvas) return;
  const link = document.createElement('a');
  link.download = 'loom-edit.png';
  link.href = imgCanvas.toDataURL('image/png');
  link.click();
}

/* ---------- Init ---------- */
if (window.innerWidth <= 720) document.getElementById('sidebar').classList.add('collapsed');
newChat();
initImageEditor();

/* ---------- PWA service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
