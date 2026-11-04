/* ===== scripts/fuzz-check.cjs — 送壞掉或惡意的訊息給伺服器：不當機、不汙染、聊天節流、HTML 只當文字（開發用，需執行中的伺服器）===== */
/* 惡意／壞掉的訊息：伺服器不能當掉、不能洩密、不能讓 HTML 進到別人畫面 */
const BASE = 'ws://127.0.0.1:3100/ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(name) {
  return new Promise(res => {
    const ws = new WebSocket(BASE); const msgs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'hb') ws.send('{"type":"hb"}'); msgs.push(m); };
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'hello', name, clientId: 'fz-' + name + Math.random() })); setTimeout(() => res({ ws, msgs, send: o => ws.send(typeof o === 'string' ? o : JSON.stringify(o)), last: t => msgs.filter(m => m.type === t).pop() }), 300); };
  });
}
(async () => {
  const A = await client('<img src=x onerror=alert(1)>'), B = await client('B');
  const out = {};
  out.name = A.last('welcome').name;
  /* 壞 JSON、未知 type、超大訊息、錯誤型別 */
  for (const m of ['not json', '{"type":1}', '{"type":"guess","code":"1234"}', '{"type":"create","mode":"x","settings":{"tier":"9","cs":{"a":1},"minutes":-1}}', JSON.stringify({ type: 'chat', text: 'x'.repeat(200000) }), '{"type":"secret","code":[1,2]}', '{"type":"kick","target":{"$ne":1}}', '{"__proto__":{"polluted":1},"type":"lobby"}']) A.send(m);
  await sleep(500);
  out.alive = A.ws.readyState === 1;
  out.polluted = ({}).polluted === 1;
  const room = A.last('room') && A.last('room').room;
  out.roomSettings = room && room.settings;
  /* B 加入，A 聊天塞 HTML */
  if (room) { B.send({ type: 'join', roomId: room.id, name: 'B' }); await sleep(300); A.send({ type: 'chat', text: '<script>alert(1)</script><b>hi</b>' }); await sleep(300); }
  const chat = B.msgs.filter(m => m.type === 'chat').pop();
  out.chatText = chat && chat.msg && chat.msg.text;
  out.chatName = chat && chat.msg && chat.msg.name;
  /* 洪水：短時間 500 則聊天、500 次猜 */
  for (let i = 0; i < 500; i++) A.send({ type: 'chat', text: 'spam' + i });
  await sleep(800);
  out.spamDelivered = B.msgs.filter(m => m.type === 'chat' && /^spam/.test(m.msg.text)).length;
  const h = await (await fetch('http://127.0.0.1:3100/health')).json();
  out.health = h.ok;
  console.log(JSON.stringify(out, null, 1));
  A.ws.close(); B.ws.close(); setTimeout(() => process.exit(0), 200);
})();
