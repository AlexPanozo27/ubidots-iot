(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const guard = (k, f) => { try { return localStorage[k] !== undefined ? localStorage[k] : f; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage[k] = v; } catch (e) {} };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- resaltar la barra según la sección ---------- */
const links = $$('.topbar nav a');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  $$('section.sheet').forEach(s => io.observe(s));
}

/* ---------- 1. recorrido del dato ---------- */
const stages = [
  ['Dispositivo', 'Un ESP32, un Arduino, un gateway o una app mide algo (temperatura, nivel, posición) y arma un dato. En Ubidots a cada dato se le llama <b>dot</b>.'],
  ['Protocolo', 'El dato viaja por <b>HTTP</b> (una petición REST) o por <b>MQTT</b> (un mensaje a un tema). En los dos casos lleva el <b>token</b> que dice a qué cuenta pertenece.'],
  ['Nube de Ubidots', 'Si el <i>device label</i> no existe, Ubidots crea el dispositivo y sus variables. El dato se guarda como un dot dentro de una variable, con su timestamp.'],
  ['Dashboard y eventos', 'Los widgets dibujan la variable en vivo. Un evento puede avisar por correo, SMS, Slack, Telegram o webhook cuando se cumple una regla.'],
  ['Vuelta al dispositivo', 'Un widget de control cambia una variable y el dispositivo la lee, por ejemplo suscribiéndose al tema <code>/lv</code>, para encender un ventilador o un relé.']
];
(function () {
  const tr = $('#track'); let cur = 0;
  stages.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'stage'; b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = (i + 1) + '. ' + s[0];
    b.onclick = () => show(i); tr.appendChild(b);
    if (i < stages.length - 1) { const a = document.createElement('span'); a.className = 'arrow'; a.textContent = '→'; a.setAttribute('aria-hidden', 'true'); tr.appendChild(a); }
  });
  function show(i) {
    cur = i;
    $$('.stage').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
    $('#stageBox').innerHTML = '<b>' + esc(stages[i][0]) + '</b><br>' + stages[i][1];
    const w = $('#pipeDot').parentElement.clientWidth - 40;
    $('#pipeDot').style.left = Math.round(w * i / (stages.length - 1)) + 'px';
  }
  show(0); window.addEventListener('resize', () => show(cur));
})();

/* ---------- 2. constructor de dot ---------- */
(function () {
  const v = $('#dotValue'), ts = $('#dotTs'), pre = $('#dotCtxPreset'), ta = $('#dotCtx');
  const presets = { none: '', text: '{"estado": "ventilador encendido", "zona": "aula 3"}', gps: '{"lat": -16.5, "lng": -68.15}' };
  function applyPreset() {
    if (pre.value !== 'custom') ta.value = presets[pre.value] || '';
    else if (!ta.value) ta.value = '{"clave": "valor"}';
    ta.hidden = pre.value === 'none'; ta.readOnly = pre.value !== 'custom';
  }
  function render() {
    const o = {}; const checks = [];
    const raw = v.value.trim(); const num = raw !== '' && isFinite(Number(raw));
    o.value = num ? Number(raw) : raw;
    checks.push([num ? 'good' : 'badc', num ? '✓' : '✕', num ? 'value es un número, como Ubidots espera.' : 'value no es un número. El texto debe ir en context, no en value.']);
    const now = Date.now();
    if (ts.value === 'ms') { o.timestamp = now; checks.push(['good', '✓', 'timestamp en milisegundos (13 dígitos): el dot queda en la fecha correcta.']); }
    else if (ts.value === 's') { o.timestamp = Math.floor(now / 1000); const d = new Date(o.timestamp).toISOString().slice(0, 10); checks.push(['badc', '✕', 'timestamp en segundos: Ubidots lo leería como milisegundos y el dot quedaría en el año ' + d.slice(0, 4) + ' (' + d + ').']); }
    else checks.push(['info', 'i', 'Sin timestamp: Ubidots usa la hora en que recibe el dato.']);
    let ctxObj = null; const t = ta.value.trim();
    if (t && pre.value !== 'none') {
      try { ctxObj = JSON.parse(t); o.context = ctxObj; const size = new Blob([t]).size;
        checks.push([size <= 1024 ? 'good' : 'badc', size <= 1024 ? '✓' : '✕', 'context pesa ' + size + ' bytes (el límite es 1 KB = 1024).']);
        if (ctxObj && typeof ctxObj.lat === 'number' && typeof ctxObj.lng === 'number') checks.push(['good', '✓', 'Trae lat y lng: un widget de mapa podría dibujar este punto.']);
      } catch (e) { checks.push(['badc', '✕', 'El JSON del contexto no es válido: ' + e.message]); }
    }
    const j = JSON.stringify(o, null, 2).replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:').replace(/: ("[^"]*")/g, ': <span class="s">$1</span>').replace(/: (-?\d[\d.]*)/g, ': <span class="n">$1</span>');
    $('#dotJson').innerHTML = j;
    $('#dotChecks').innerHTML = checks.map(c => '<li class="' + c[0] + '"><span class="i">' + c[1] + '</span><span>' + esc(c[2]) + '</span></li>').join('');
  }
  [v, ts, pre, ta].forEach(e => e.addEventListener('input', render));
  pre.addEventListener('change', () => { applyPreset(); render(); });
  applyPreset(); render();
})();

/* ---------- 3. pasos de configuración ---------- */
const stepsData = [
  ['Crea tu cuenta', '<p>Entra a <b>ubidots.com</b> y regístrate. Para clase y proyectos de estudio existe <b>Ubidots STEM</b>, el nivel gratuito para estudiantes, makers e investigadores.</p>'],
  ['Consigue tu token', '<ul><li>Abre el menú de usuario y entra a <b>API Credentials</b>.</li><li>Copia el <b>Default token</b>. Puedes crear más y revocarlos cuando quieras.</li><li>Todas las llamadas usan <b>token</b>: una API Key no funciona.</li></ul><div class="note bad">El token es como una contraseña. No lo subas a GitHub ni lo pongas en capturas.</div>'],
  ['Decide cómo nace el dispositivo', '<ul><li><b>Automático:</b> basta enviar un dato a un device label que no existe. Ubidots crea el dispositivo y las variables.</li><li><b>Manual:</b> en <i>Devices</i> pulsa el botón <b>+</b>.</li><li><b>Device Type:</b> una plantilla con propiedades, apariencia y variables para dar de alta muchos dispositivos igual.</li></ul>'],
  ['Envía datos', '<p>Elige HTTP o MQTT y manda un JSON con <code>value</code>, y si quieres <code>timestamp</code> (milisegundos) y <code>context</code>. La sección siguiente genera el código por ti. Existen librerías oficiales para ESP32 y ESP8266.</p>'],
  ['Arma el dashboard', '<ul><li>Menú <b>Data</b> → <b>Dashboards</b> → botón <b>+</b>.</li><li>Añade widgets: métrica, gráfica de líneas, tabla, mapa, control (interruptor) o incidentes.</li><li>Cada widget se enlaza a una variable de un dispositivo.</li></ul>'],
  ['Crea eventos', '<ul><li>Menú <b>Data</b> → <b>Events</b>.</li><li>Define la condición con ANDs y ORs: un valor se alcanza, una variable queda inactiva o un dispositivo entra o sale de una geocerca.</li><li>Elige la acción: correo, SMS, Slack, Telegram, voz, webhook, cambiar una variable o una UbiFunction.</li></ul>']
];
(function () {
  const ol = $('#steps'); let done = JSON.parse(guard('ubi_done', '[]'));
  stepsData.forEach((s, i) => {
    const li = document.createElement('li'); li.className = 'step';
    li.innerHTML = '<h3>' + esc(s[0]) + '</h3>' + s[1] + '<button class="btn line small" type="button">Marcar como hecho</button>';
    li.querySelector('button').onclick = () => { done = done.includes(i) ? done.filter(x => x !== i) : [...done, i]; save('ubi_done', JSON.stringify(done)); paint(); };
    ol.appendChild(li);
  });
  function paint() {
    $$('.step', ol).forEach((li, i) => { const d = done.includes(i); li.classList.toggle('done', d); li.querySelector('button').textContent = d ? 'Hecho ✓ (deshacer)' : 'Marcar como hecho'; });
    $('#progressFill').style.width = Math.round(done.length / 6 * 100) + '%';
    $('#progressBar').setAttribute('aria-valuenow', done.length);
    if (done.length === 6 && !paint.once) { paint.once = 1; toast('Seis de seis. Ya puedes ir al simulador.'); }
  }
  paint();
})();

/* ---------- 4. generador de código ---------- */
(function () {
  let proto = 'http';
  const f = id => $('#' + id);
  function render() {
    const dev = f('gDev').value.trim() || 'mi-dispositivo', vr = f('gVar').value.trim() || 'variable', val = f('gVal').value || '0', tok = f('gTok').value.trim() || 'TOKEN';
    let code = '';
    if (proto === 'http') code =
`curl -X POST "https://industrial.api.ubidots.com/api/v1.6/devices/${dev}/" \\
  -H "X-Auth-Token: ${tok}" \\
  -H "Content-Type: application/json" \\
  -d '{"${vr}": ${val}}'`;
    else if (proto === 'mqtt') code =
`# Servidor: industrial.api.ubidots.com   Puerto: 1883
# Usuario: el token      Contraseña: vacía
mosquitto_pub -h industrial.api.ubidots.com -p 1883 \\
  -u "${tok}" -P "" \\
  -t "/v1.6/devices/${dev}/${vr}" \\
  -m '{"value": ${val}}'

# Para escuchar el último valor (solo el número):
mosquitto_sub -h industrial.api.ubidots.com -p 1883 \\
  -u "${tok}" -P "" \\
  -t "/v1.6/devices/${dev.toLowerCase()}/${vr.toLowerCase()}/lv"`;
    else code =
`#include <WiFi.h>
#include <PubSubClient.h>

#define TOKEN "${tok}"        // tu token de Ubidots
#define DEVICE_LABEL "${dev}"
#define VARIABLE_LABEL "${vr}"
const char* WIFISSID = "TU_WIFI";
const char* PASSWORD = "TU_CLAVE";
const char* BROKER = "industrial.api.ubidots.com";

WiFiClient espClient;
PubSubClient client(espClient);
char topic[100], payload[60];

void reconnect() {
  while (!client.connected()) {
    // usuario = token, contraseña vacía
    if (!client.connect("esp32-aula-01", TOKEN, "")) delay(2000);
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFISSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  client.setServer(BROKER, 1883);
  sprintf(topic, "/v1.6/devices/%s", DEVICE_LABEL);
}

void loop() {
  if (!client.connected()) reconnect();
  float valor = ${val};            // aquí iría la lectura del sensor
  sprintf(payload, "{\\"%s\\": %.1f}", VARIABLE_LABEL, valor);
  client.publish(topic, payload);
  client.loop();
  delay(5000);
}`;
    f('gCode').innerHTML = '<button class="copy" type="button" id="gCopy">Copiar</button>' + esc(code);
    f('gCopy').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Código copiado'), () => toast('Selecciona el texto y copia con Ctrl+C')); };
    const ck = [];
    if (/\s/.test(dev + vr)) ck.push(['badc', '✕', 'Hay espacios en un label. Usa guiones o guiones bajos.']);
    if (/[A-Z]/.test(dev + vr)) ck.push(['badc', '✕', 'Hay mayúsculas. Los temas de suscripción MQTT deben ir en minúsculas, así que conviene usar siempre minúsculas.']);
    if (!/\s/.test(dev + vr) && !/[A-Z]/.test(dev + vr)) ck.push(['good', '✓', 'Los labels están en minúsculas y sin espacios.']);
    if (/TU_TOKEN|TOKEN$/.test(tok)) ck.push(['info', 'i', 'Reemplaza el token de ejemplo por el de tu cuenta (API Credentials). No lo publiques.']);
    if (isNaN(Number(f('gVal').value))) ck.push(['badc', '✕', 'El valor debe ser un número.']);
    ck.push(['info', 'i', 'Si el device label no existe, Ubidots crea el dispositivo y la variable con el primer envío.']);
    f('gChecks').innerHTML = ck.map(c => '<li class="' + c[0] + '"><span class="i">' + c[1] + '</span><span>' + esc(c[2]) + '</span></li>').join('');
  }
  $$('#gProto .chip').forEach(b => b.onclick = () => { proto = b.dataset.p; $$('#gProto .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); });
  ['gDev', 'gVar', 'gVal', 'gTok'].forEach(id => f(id).addEventListener('input', render));
  render();
})();

/* ---------- 5. simulador ---------- */
const S = { devs: {}, fanCloud: 0, fanDev: 0, event: null, incidents: [], badSub: false, realT: 24, timer: null, synth: { name: 'temperatura_f', expr: '(temperatura * 9 / 5) + 32' } };
const FAN_VAR = 'ventilador';
const el = id => document.getElementById(id);
const label = () => (el('sDev').value.trim() || 'esp32-aula');
const connOK = () => el('sWifi').checked && el('sTok').value === 'ok';
const clock = () => new Date().toLocaleTimeString('es-BO', { hour12: false });

function log(kind, txt) {
  const L = el('log'); const d = document.createElement('div');
  d.className = { out: 'out-l', in: 'in-l', err: 'err-l', inf: 'inf-l', ev: 'ev-l' }[kind];
  d.innerHTML = '<span style="opacity:.5">' + clock() + '</span> ' + txt; L.appendChild(d);
  while (L.children.length > 70) L.removeChild(L.firstChild);
  L.scrollTop = L.scrollHeight;
}
function diag(title, cause, fix) {
  const d = el('diag'); d.hidden = false;
  d.innerHTML = '<b>' + esc(title) + '</b><span><b style="display:inline">Causa:</b> ' + cause + '</span><br><span><b style="display:inline">Solución:</b> ' + fix + '</span>';
}
function getDev(lbl) {
  if (!S.devs[lbl]) { S.devs[lbl] = { vars: {}, seen: Date.now() }; log('inf', 'Ubidots: el dispositivo <b>' + esc(lbl) + '</b> no existía y se creó automáticamente.'); }
  return S.devs[lbl];
}
function addDot(dev, name, value, ts) {
  const v = dev.vars[name] || (dev.vars[name] = { hist: [] });
  v.hist.push({ v: value, t: ts || Date.now() }); if (v.hist.length > 30) v.hist.shift(); v.last = value; dev.seen = Date.now();
}
const cur = () => S.devs[label()] || Object.values(S.devs)[0];

/* parser seguro para variables sintéticas */
function evalExpr(src, dev) {
  const tokens = src.match(/[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[()+\-*/,]/g) || [];
  if (tokens.join('') !== src.replace(/\s+/g, '')) throw new Error('hay símbolos que no se admiten');
  let i = 0; const peek = () => tokens[i], next = () => tokens[i++];
  const hist = n => { const v = dev && dev.vars[n]; if (!v) throw new Error('la variable "' + n + '" aún no tiene datos'); return v; };
  const expr = () => { let a = term(); while (peek() === '+' || peek() === '-') { const o = next(), b = term(); a = o === '+' ? a + b : a - b; } return a; };
  const term = () => { let a = fact(); while (peek() === '*' || peek() === '/') { const o = next(), b = fact(); a = o === '*' ? a * b : a / b; } return a; };
  const fact = () => {
    const k = next(); if (k === undefined) throw new Error('la fórmula está incompleta');
    if (k === '-') return -fact();
    if (k === '(') { const a = expr(); if (next() !== ')') throw new Error('falta cerrar un paréntesis'); return a; }
    if (/^\d/.test(k)) return parseFloat(k);
    if (/^[A-Za-z_]/.test(k)) {
      if (peek() === '(') {
        next();
        if (['mean', 'max', 'min'].includes(k)) {
          const n = next(); if (next() !== ')') throw new Error(k + '() recibe un solo nombre de variable');
          const h = hist(n).hist.slice(-10).map(d => d.v);
          return k === 'mean' ? h.reduce((a, b) => a + b, 0) / h.length : Math[k](...h);
        }
        if (k === 'ceil' || k === 'floor' || k === 'round') { const a = expr(); if (next() !== ')') throw new Error('falta cerrar un paréntesis'); return Math[k](a); }
        throw new Error('la función "' + k + '" no existe aquí');
      }
      if (k === FAN_VAR) return S.fanCloud;
      return hist(k).last;
    }
    throw new Error('símbolo inesperado "' + k + '"');
  };
  const r = expr(); if (i < tokens.length) throw new Error('sobra "' + tokens[i] + '"'); if (!isFinite(r)) throw new Error('el resultado no es un número');
  return r;
}

/* envío */
function send(forced) {
  const proto = el('sProto').value, lbl = label(), t = Number(el('sTemp').value), h = Number(el('sHum').value);
  const caseId = forced || '';
  const body = { temperatura: t, humedad: h };
  let bodyTxt = JSON.stringify(body);
  if (caseId === 'text') { body.temperatura = 'caliente'; bodyTxt = '{"temperatura": "caliente", "humedad": ' + h + '}'; }
  if (caseId === 'seconds') bodyTxt = '{"temperatura": {"value": ' + t + ', "timestamp": ' + Math.floor(Date.now() / 1000) + '}, "humedad": ' + h + '}';
  const tokMode = el('sTok').value, tokShow = tokMode === 'ok' ? 'BBUS-••••' : tokMode === 'bad' ? 'BBUS-xxxx' : '(vacío)';
  if (proto === 'http') log('out', 'POST /api/v1.6/devices/' + esc(lbl) + '/ &nbsp;X-Auth-Token: ' + tokShow + '<br>&nbsp;&nbsp;' + esc(bodyTxt));
  else log('out', 'CONNECT usuario=' + tokShow + ' contraseña=""<br>PUBLISH /v1.6/devices/' + esc(lbl) + ' ' + esc(bodyTxt));
  if (!el('sWifi').checked) { log('err', 'Sin Wi-Fi: la petición no sale del dispositivo. El dato se pierde si no lo guardas.'); el('devState').textContent = 'sin red'; el('devState').classList.add('off'); return false; }
  el('devState').textContent = 'en línea'; el('devState').classList.remove('off');
  if (tokMode !== 'ok') {
    log('err', proto === 'http' ? '401 Unauthorized: el token no es válido.' : 'CONNACK: conexión rechazada, el broker cierra la conexión (token no válido).');
    if (caseId === 'token' || !caseId) diag('El dato no llegó a Ubidots', 'El token está vacío o es incorrecto. Sin token válido, Ubidots no sabe de quién es el dato.', 'Copia el Default token desde <b>API Credentials</b> y úsalo como cabecera X-Auth-Token (HTTP) o como usuario MQTT con la contraseña vacía.');
    return false;
  }
  if (caseId === 'text') {
    log('err', '400 Bad Request: value debe ser numérico (recibió "caliente").');
    diag('Se rechazó el dato', 'Se mandó texto en <code>value</code>. Ubidots espera un número ahí.', 'Envía un número en <code>value</code> y pon el texto en <code>context</code>, por ejemplo <code>{"value": 1, "context": {"estado": "caliente"}}</code>.');
    return false;
  }
  const dev = getDev(lbl);
  let tsUsed = Date.now();
  if (caseId === 'seconds') {
    tsUsed = Math.floor(Date.now() / 1000);
    const when = new Date(tsUsed).toISOString().slice(0, 10);
    addDot(dev, 'temperatura', t, tsUsed); addDot(dev, 'humedad', h);
    log('in', proto === 'http' ? '200 OK: el dato se guardó, pero con fecha ' + when : 'Dato recibido, guardado con fecha ' + when);
    diag('El dato llegó, pero no se ve en el dashboard', 'El timestamp iba en <b>segundos</b>. Ubidots espera <b>milisegundos</b>, así que el dot quedó en la fecha ' + when + ' y queda fuera del rango "últimas 24 horas".', 'Multiplica por 1000 o usa <code>millis</code> en la fecha: un timestamp correcto tiene 13 dígitos.');
  } else {
    addDot(dev, 'temperatura', t); addDot(dev, 'humedad', h);
    if (!dev.vars[FAN_VAR]) dev.vars[FAN_VAR] = { hist: [], last: S.fanCloud };
    log('in', proto === 'http' ? '200 OK &nbsp;{"temperatura":[{"status_code":201}],"humedad":[{"status_code":201}]}' : 'CONNACK 0 (aceptado) · datos guardados');
  }
  /* el dispositivo lee el ventilador */
  if (S.fanDev !== S.fanCloud) {
    if (S.badSub && proto === 'mqtt') log('err', 'La suscripción /v1.6/devices/' + esc(lbl.toUpperCase()) + '/ventilador/lv no recibe nada (mayúsculas).');
    else { S.fanDev = S.fanCloud; log('in', (proto === 'mqtt' ? 'MQTT /v1.6/devices/' + esc(lbl.toLowerCase()) + '/ventilador/lv → ' : 'GET /api/v1.6/devices/' + esc(lbl) + '/ventilador/lv → ') + S.fanDev); }
  }
  paint(); evalEvent(t); return true;
}

/* eventos */
function evalEvent(t) {
  const e = S.event; if (!e) return;
  const dev = cur(); const v = dev && dev.vars[e.v]; if (!v) return;
  const val = v.last; const hit = e.op === '>' ? val > e.th : val < e.th;
  if (hit && !e.active) {
    e.active = true; S.incidents.unshift({ t: clock(), v: val, name: e.v, open: true });
    const names = { email: 'Correo enviado', telegram: 'Mensaje de Telegram enviado', sms: 'SMS enviado', webhook: 'Webhook llamado', setvar: 'Variable ventilador = 1' };
    log('ev', '⚡ Evento: ' + e.v + ' = ' + val + ' ' + (e.op === '>' ? '>' : '<') + ' ' + e.th + ' → ' + names[e.act] + (e.act === 'setvar' ? '' : ' (simulado)'));
    toast(names[e.act] + (e.act === 'setvar' ? '' : ' (simulado)'));
    if (e.act === 'setvar') setFan(1, 'evento');
  } else if (!hit && e.active) {
    e.active = false; const inc = S.incidents.find(i => i.open); if (inc) inc.open = false;
    log('ev', '✔ Evento: ' + e.v + ' = ' + val + ' volvió a la normalidad. Incidente cerrado.');
  }
}
function setFan(v, origin) {
  S.fanCloud = v; const dev = cur(); if (dev) { dev.vars[FAN_VAR] = dev.vars[FAN_VAR] || { hist: [] }; addDot(dev, FAN_VAR, v); }
  const lbl = label(), proto = el('sProto').value;
  log('inf', 'Ubidots: ' + (origin === 'evento' ? 'el evento cambió' : 'el widget cambió') + ' la variable <b>ventilador</b> a ' + v);
  if (connOK() && !(S.badSub && proto === 'mqtt')) { S.fanDev = v; log('in', (proto === 'mqtt' ? 'MQTT ' : 'GET ') + '/v1.6/devices/' + esc(lbl.toLowerCase()) + '/ventilador/lv → ' + v + ' · el dispositivo lo recibe'); }
  else if (S.badSub && proto === 'mqtt') log('err', 'El dispositivo no se entera: su suscripción usa mayúsculas y el broker no la reconoce.');
  else log('err', 'El dispositivo no se entera: no tiene conexión o su token es inválido. Lo sabrá en su próximo envío exitoso.');
  paint();
}

/* dibujo */
function paint() {
  const dev = cur();
  el('fanLed').classList.toggle('on', !!S.fanDev); el('fanTxt').textContent = S.fanDev ? 'encendido (enfría el ambiente)' : 'apagado';
  el('swFan').setAttribute('aria-checked', !!S.fanCloud); el('swTxt').textContent = S.fanCloud;
  const cs = el('cloudState'); cs.textContent = dev ? 'recibiendo' : 'sin datos'; cs.classList.toggle('off', !dev);
  const body = el('devBody');
  if (!Object.keys(S.devs).length) body.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">Todavía no hay dispositivos. Envía un dato: Ubidots lo creará solo.</td></tr>';
  else body.innerHTML = Object.entries(S.devs).map(([k, d]) => '<tr><td><b>' + esc(k) + '</b><br><small style="color:var(--muted)">creado automáticamente</small></td><td>' +
    Object.entries(d.vars).map(([n, v]) => '<span class="badge y" style="margin:2px;display:inline-block">' + esc(n) + '</span>').join('') + '<span class="badge g" style="margin:2px;display:inline-block">' + esc(S.synth.name) + '</span></td><td>' +
    (d.vars.temperatura ? d.vars.temperatura.last.toFixed(1) + ' °C<br>' + d.vars.humedad.last + ' %' : '—') + '</td></tr>').join('');
  const t = dev && dev.vars.temperatura, h = dev && dev.vars.humedad;
  const wt = el('wTemp'); wt.textContent = t ? t.last.toFixed(1) + '°' : '—'; wt.classList.toggle('hot', !!(t && S.event && S.event.active));
  el('wHum').textContent = h ? h.last + '%' : '—';
  drawChart(t ? t.hist : []);
  el('wInc').innerHTML = S.incidents.length ? S.incidents.slice(0, 4).map(i => '<div class="inc"><span class="badge' + (i.open ? '' : ' ok') + '">' + (i.open ? 'activo' : 'resuelto') + '</span><span>' + i.t + ' · ' + esc(i.name) + ' = ' + i.v + '</span></div>').join('') : '<span style="color:var(--muted);font-size:.85rem">Sin incidentes. Crea un evento en la pestaña Eventos.</span>';
  paintSynth();
}
function drawChart(h) {
  const svg = el('wChart'); let s = '';
  for (let k = 0; k < 4; k++) s += '<line x1="0" x2="300" y1="' + (10 + k * 33) + '" y2="' + (10 + k * 33) + '" stroke="#ece7ff"/>';
  const lo = 0, hi = 50, Y = v => 110 - (v - lo) / (hi - lo) * 100;
  if (S.event && S.event.v === 'temperatura') s += '<line x1="0" x2="300" y1="' + Y(S.event.th) + '" y2="' + Y(S.event.th) + '" stroke="#d9363e" stroke-dasharray="5 4"/><text x="4" y="' + (Y(S.event.th) - 3) + '" font-size="9" fill="#d9363e">umbral ' + S.event.th + '</text>';
  if (h.length) {
    const pts = h.map((d, i) => (h.length === 1 ? 150 : i / (h.length - 1) * 296 + 2) + ',' + Y(d.v));
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2326e6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    const l = pts[pts.length - 1].split(','); s += '<circle cx="' + l[0] + '" cy="' + l[1] + '" r="4" fill="#a63bd0"/>';
  } else s += '<text x="150" y="64" font-size="11" fill="#9a97b8" text-anchor="middle">sin datos</text>';
  svg.innerHTML = s;
}
function paintSynth() {
  const dev = cur(); let out, ok = true;
  try { if (!dev || !dev.vars.temperatura) throw new Error('envía un primer dato para calcularla'); out = evalExpr(S.synth.expr, dev); } catch (e) { out = null; ok = false; var msg = e.message; }
  const txt = ok ? '<span class="n">' + (Math.round(out * 100) / 100) + '</span>' : '<span class="c">' + esc(msg) + '</span>';
  el('syOut').innerHTML = '<span class="k">' + esc(S.synth.name) + '</span> = ' + txt;
  el('wSynth').textContent = ok ? Math.round(out * 10) / 10 : '—'; el('wSynthName').textContent = S.synth.name;
}

/* auto-envío */
function tick() {
  let t = Number(el('sTemp').value);
  t += S.fanDev ? -0.6 : (Math.random() - .45) * .6; t = Math.max(0, Math.min(50, Math.round(t * 10) / 10));
  el('sTemp').value = t; el('oTemp').textContent = t.toFixed(1) + ' °C'; send();
}
function setAuto(on) { clearInterval(S.timer); if (on) S.timer = setInterval(tick, 2000); }

/* eventos de la interfaz */
el('sTemp').oninput = e => el('oTemp').textContent = Number(e.target.value).toFixed(1) + ' °C';
el('sHum').oninput = e => el('oHum').textContent = e.target.value + ' %';
el('bSend').onclick = () => send();
el('bHeat').onclick = () => { const t = Math.min(50, Number(el('sTemp').value) + 8); el('sTemp').value = t; el('oTemp').textContent = t.toFixed(1) + ' °C'; send(); };
el('sAuto').onchange = e => setAuto(e.target.checked);
el('sWifi').onchange = e => { log('inf', 'Wi-Fi ' + (e.target.checked ? 'conectado' : 'caído')); el('devState').textContent = e.target.checked ? 'listo' : 'sin red'; el('devState').classList.toggle('off', !e.target.checked); };
el('swFan').onclick = () => { if (!cur()) { toast('Primero envía un dato para que exista el dispositivo'); return; } setFan(S.fanCloud ? 0 : 1, 'widget'); };
el('bClear').onclick = () => { el('log').innerHTML = ''; };
el('bReset').onclick = () => {
  setAuto(false); el('sAuto').checked = false; el('sWifi').checked = true; el('sTok').value = 'ok'; el('sDev').value = 'esp32-aula'; el('sTemp').value = 24; el('sHum').value = 60;
  el('oTemp').textContent = '24.0 °C'; el('oHum').textContent = '60 %'; el('devState').textContent = 'listo'; el('devState').classList.remove('off');
  S.devs = {}; S.fanCloud = S.fanDev = 0; S.event = null; S.incidents = []; S.badSub = false;
  el('syName').value = 'temperatura_f'; el('syExpr').value = '(temperatura * 9 / 5) + 32'; applySynth();
  el('log').innerHTML = ''; el('diag').hidden = true; el('evState').textContent = 'Ningún evento activo.'; paint(); toast('Simulador reiniciado');
};
$$('.tab').forEach(b => b.onclick = () => {
  $$('.tab').forEach(x => x.setAttribute('aria-selected', x === b)); $$('.tabpanel').forEach(p => p.hidden = p.id !== b.dataset.t);
});
el('evSave').onclick = () => {
  S.event = { v: el('evVar').value, op: el('evOp').value, th: Number(el('evTh').value), act: el('evAct').value, active: false };
  el('evState').innerHTML = '<span class="badge ok">activo</span> Si <b>' + S.event.v + '</b> es ' + (S.event.op === '>' ? 'mayor' : 'menor') + ' que <b>' + S.event.th + '</b> → ' + esc(el('evAct').selectedOptions[0].textContent);
  log('inf', 'Evento creado en Ubidots: ' + S.event.v + ' ' + S.event.op + ' ' + S.event.th); paint(); toast('Evento activado. Prueba con la Ola de calor.'); if (cur()) evalEvent();
};
function applySynth() { S.synth.name = (el('syName').value.trim() || 'sintetica').replace(/\s+/g, '_'); S.synth.expr = el('syExpr').value; paint(); }
el('syName').oninput = applySynth; el('syExpr').oninput = applySynth;
[['°C → °F', '(temperatura * 9 / 5) + 32'], ['Promedio de 10 dots', 'mean(temperatura)'], ['Máxima reciente', 'max(temperatura)'], ['Humedad relativa a decimal', 'humedad / 100'], ['Índice simple', 'temperatura - (100 - humedad) / 5'], ['Con un error', 'temperatura * ']].forEach(p => {
  const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = p[0]; b.onclick = () => { el('syExpr').value = p[1]; el('syName').value = p[0].startsWith('Prom') ? 'temp_promedio' : p[0].startsWith('Máx') ? 'temp_max' : p[0].startsWith('Hum') ? 'humedad_decimal' : p[0].startsWith('Índ') ? 'indice' : p[0].startsWith('Con') ? 'prueba_error' : 'temperatura_f'; applySynth(); };
  el('syPresets').appendChild(b);
});

/* casos que fallan */
el('bCase').onclick = () => {
  const c = el('caseSel').value; el('diag').hidden = true; S.badSub = false;
  if (c !== 'token' && el('sTok').value !== 'ok') el('sTok').value = 'ok';
  if (c !== 'wifi' && !el('sWifi').checked) el('sWifi').checked = true;
  if (c === 'token') { el('sTok').value = 'bad'; send('token'); }
  else if (c === 'wifi') { el('sWifi').checked = false; el('sWifi').dispatchEvent(new Event('change')); send('wifi');
    diag('El dispositivo se quedó sin enviar', 'Sin red, la petición ni siquiera sale. Ubidots no puede saber que el dispositivo sigue vivo.', 'Reintenta la conexión en el código, guarda los dots pendientes en memoria o tarjeta SD, y crea un evento de <b>inactividad</b> en Ubidots para que te avise cuando una variable deje de llegar.'); }
  else if (c === 'text') send('text');
  else if (c === 'seconds') send('seconds');
  else if (c === 'upper') {
    el('sProto').value = 'mqtt'; const L = label();
    log('out', 'SUBSCRIBE /v1.6/devices/' + esc(L.toUpperCase()) + '/ventilador/lv'); S.badSub = true;
    log('err', 'La suscripción queda sin efecto: el broker de Ubidots espera el tema en minúsculas.');
    diag('Las órdenes no llegan al dispositivo', 'El tema de suscripción tiene mayúsculas. En Ubidots debe ir todo en <b>minúsculas</b>.', 'Escribe el tema así: <code>/v1.6/devices/' + esc(L.toLowerCase()) + '/ventilador/lv</code>. Ahora prueba el interruptor del dashboard: el dispositivo no se entera hasta que elijas otro caso o reinicies.');
  }
  else if (c === 'qos2') {
    el('sProto').value = 'mqtt';
    log('out', 'PUBLISH QoS 2 /v1.6/devices/' + esc(label()) + ' {"temperatura": 24}'); log('err', 'QoS 2 no está disponible en el broker compartido de Ubidots (admite QoS 0 y 1).');
    diag('El broker no ofrece QoS 2', 'Ubidots solo admite QoS 0 y 1 en su broker compartido. Tampoco hay testamento ni sesión persistente.', 'Usa QoS 1 (entrega al menos una vez; un dot repetido solo añade otro punto con la misma fecha) o contrata un broker dedicado si de verdad necesitas esas funciones.');
  }
  else if (c === 'label') {
    const nuevo = 'esp32-aula-2'; el('sDev').value = nuevo; send('label');
    diag('Aparece un segundo dispositivo', 'Ubidots identifica cada dispositivo por su <b>label</b>. Si cambias el label en el código, el dato se manda a un dispositivo distinto y el dashboard viejo deja de actualizarse.', 'Mantén el mismo label para el mismo dispositivo físico. Revisa la pestaña <b>Devices</b>: ahora hay dos filas.');
  }
};

/* ---------- 6. quiz ---------- */
const qs = [
  ['¿Qué se usa como usuario al conectarse al broker MQTT de Ubidots?', ['El correo de la cuenta', 'El token de Ubidots (y la contraseña va vacía)', 'El device label', 'Un usuario y clave que crea el dispositivo'], 1, 'El token hace de usuario y la contraseña se deja vacía.'],
  ['¿Dónde se guardan los dots que manda un dispositivo?', ['En las variables del dispositivo', 'Dentro del dashboard', 'En el token', 'En el widget'], 0, 'Cada variable guarda sus dots, y cada dot tiene su timestamp.'],
  ['¿En qué unidad debe ir el timestamp de un dot?', ['Segundos', 'Minutos', 'Milisegundos', 'Horas'], 2, 'Es una época Unix en milisegundos. Si lo mandas en segundos, el dato queda en 1970.'],
  ['Quieres enviar el texto "puerta abierta". ¿Dónde va?', ['En value', 'En context', 'En el label de la variable', 'No se puede'], 1, 'value es numérico. El texto y las coordenadas GPS van en context, hasta 1 KB.'],
  ['Envías un dato a un device label que no existe. ¿Qué hace Ubidots?', ['Rechaza el dato con error', 'Lo guarda en un dispositivo genérico', 'Crea el dispositivo y las variables automáticamente', 'Pide confirmación por correo'], 2, 'El primer envío crea el dispositivo y sus variables, lo que facilita dar de alta muchos equipos.'],
  ['¿Qué niveles de QoS admite el broker compartido de Ubidots?', ['0, 1 y 2', 'Solo 2', 'Solo 0', '0 y 1'], 3, 'QoS 0 y 1. Para QoS 2, testamento o sesión persistente se necesita un broker dedicado.']
];
(function () {
  let i = 0, score = 0; const box = el('qbox');
  function show() {
    if (i >= qs.length) { box.innerHTML = '<h3>Resultado: ' + score + ' de ' + qs.length + '</h3><p>' + (score >= 5 ? '¡Dominas Ubidots!' : score >= 3 ? 'Vas bien. Repasa los casos que fallan del simulador.' : 'Vuelve a recorrer los seis pasos y prueba el simulador.') + '</p><button class="btn primary small" type="button" id="qAgain">Intentar de nuevo</button>'; el('qAgain').onclick = () => { i = 0; score = 0; show(); }; return; }
    const q = qs[i];
    box.innerHTML = '<small style="color:var(--muted)">Pregunta ' + (i + 1) + ' de ' + qs.length + '</small><h3 style="margin-top:4px">' + esc(q[0]) + '</h3>' + q[1].map((o, k) => '<button class="qopt" type="button" data-k="' + k + '">' + esc(o) + '</button>').join('') + '<div class="qexp" id="qexp"></div>';
    $$('.qopt', box).forEach(b => b.onclick = () => {
      const k = Number(b.dataset.k); $$('.qopt', box).forEach(x => x.disabled = true);
      b.classList.add(k === q[2] ? 'right' : 'wrong'); if (k !== q[2]) $$('.qopt', box)[q[2]].classList.add('right'); else score++;
      el('qexp').innerHTML = (k === q[2] ? '<b>¡Correcto!</b> ' : '<b>Casi.</b> ') + esc(q[3]) + '<br><button class="btn line small" type="button" id="qNext" style="margin-top:10px">' + (i === qs.length - 1 ? 'Ver resultado' : 'Siguiente') + '</button>';
      el('qNext').onclick = () => { i++; show(); };
    });
  }
  show();
})();

paint();
log('inf', 'Simulador listo. Pulsa <b>Enviar ahora</b> para mandar el primer dato.');
})();
