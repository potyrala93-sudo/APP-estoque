/* =========================================================
   Estoque de Insumo — Entrada, Estoque e Retirada
   Banco: o mesmo Supabase do App de Compras (mesmo usuário e senha).
   ========================================================= */
(function () {
  'use strict';

  // ---------- Configuração ----------
  const LOCAL = window.ESTOQUE_CONFIG || {};
  const COMPRAS = window.APP_CONFIG || {};
  const URL_SB = (LOCAL.SUPABASE_URL || COMPRAS.SUPABASE_URL || '').trim();
  const KEY_SB = (LOCAL.SUPABASE_ANON_KEY || COMPRAS.SUPABASE_ANON_KEY || '').trim();
  const LINK_COMPRAS = LOCAL.APP_COMPRAS_URL || 'https://potyrala93-sudo.github.io/APP-compras/';
  const configurado = /^https:\/\//.test(URL_SB) && KEY_SB.length > 20 && !/SEU-PROJETO|COLE_AQUI/.test(URL_SB + KEY_SB);

  // ---------- Utilidades ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => new Date().toLocaleDateString('sv-SE');
  const dataBR = (d) => { if (!d) return '—'; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; };
  const num = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const lerNum = (s) => { s = String(s || '').trim().replace(/\s/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : NaN; };
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  // mesmo padrão do banco: "TOUCHDOWN" -> "Touchdown", "npk 00-00-54" -> "NPK 00-00-54"
  function nomePadrao(t) {
    return String(t || '').trim().replace(/\s+/g, ' ').split(' ').map((p) => p.split('-').map((w) => {
      if (['NPK', 'MAP', 'KCL', 'SC', 'WG', 'EC', 'SL', 'CS', 'WP'].includes(w.toUpperCase()) || /\d/.test(w)) return w.toUpperCase();
      return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w;
    }).join('-')).join(' ');
  }
  const P = {
    in: 'M12 19V5M5 12l7-7 7 7',
    out: 'M12 5v14M5 12l7 7 7-7',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    x: 'M6 6l12 12M18 6L6 18',
    camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
    plus: 'M12 5v14M5 12h14',
    chev: 'M9 6l6 6-6 6',
    out2: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

  // imagem do produto: a foto, ou um quadro com as iniciais (cor fixa por nome)
  function matiz(nome) { let x = 0; for (const c of nome) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
  function iniciaisProd(nome) { const p = nome.split(/[\s-]+/).filter(Boolean); return (p.length > 1 && !/^\d/.test(p[1]) ? p[0][0] + p[1][0] : nome.slice(0, 2)).toUpperCase(); }
  function imagem(prod, cls) {
    const ph = `<div class="ph ${cls || ''}" style="--h:${matiz(prod.nome)}" aria-hidden="true"><span>${h(iniciaisProd(prod.nome))}</span></div>`;
    if (!prod.foto_url) return ph;
    return `<img class="foto ${cls || ''}" src="${h(prod.foto_url)}" alt="Foto de ${h(prod.nome)}" loading="lazy" onerror="this.outerHTML=this.dataset.ph" data-ph="${h(ph)}">`;
  }

  function toast(msg, tipo, tempo) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), tempo || 4500);
  }
  function dialogo(html) {
    const d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 50));
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.showModal(); return d;
  }
  function msgErro(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (!navigator.onLine || /failed to fetch|network|load failed/i.test(m)) return 'Sem conexão com a internet. Tente de novo quando tiver sinal.';
    if (/anonymous sign-ins are disabled/i.test(m)) return 'O login anônimo está desligado no Supabase (Authentication › Sign In / Providers).';
    if (/does not exist|could not find the function|schema cache/i.test(m)) return 'O banco ainda não tem o estoque. Rode o arquivo estoque.sql no SQL Editor do Supabase.';
    if (/bucket not found/i.test(m)) return 'Falta rodar o estoque.sql no Supabase (lugar das fotos).';
    return m;
  }

  // ---------- Estado ----------
  const S = { sb: null, perfil: null, produtos: [], equipes: [], movs: {}, tab: 'estoque', busca: '', zerados: false, canal: null };
  try { S.zerados = localStorage.getItem('estoque.zerados') === '1'; } catch (_) {}
  const app = () => $('#app');

  function cliente() {
    if (S.sb) return S.sb;
    if (!configurado || !window.supabase?.createClient) return null;
    S.sb = window.supabase.createClient(URL_SB, KEY_SB, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'estoque.auth' } });
    return S.sb;
  }
  async function rpc(fn, args) { const { data, error } = await S.sb.rpc(fn, args || {}); if (error) throw error; return data; }
  async function sessao() {
    const { data } = await S.sb.auth.getSession();
    if (data?.session) return data.session;
    const r = await S.sb.auth.signInAnonymously(); if (r.error) throw r.error; return r.data.session;
  }

  // ---------- Dados ----------
  async function carregar() {
    const [pr, eq] = await Promise.all([
      S.sb.from('vw_estoque').select('*').eq('ativo', true).order('nome'),
      S.sb.from('equipes').select('nome,tipo').eq('cdc', S.perfil.cdc).order('nome'),
    ]);
    if (pr.error) throw pr.error;
    S.produtos = pr.data.map((p) => ({ ...p, saldo: Number(p.saldo) }));
    S.equipes = eq.error ? [] : eq.data;
    S.movs = {};
    try { localStorage.setItem('estoque.cache', JSON.stringify({ produtos: S.produtos, equipes: S.equipes, em: new Date().toISOString() })); } catch (_) {}
  }
  function doCache() {
    try { const c = JSON.parse(localStorage.getItem('estoque.cache') || 'null'); if (c) { S.produtos = c.produtos; S.equipes = c.equipes; return c.em; } } catch (_) {}
    return null;
  }
  let timer = null;
  function recarregarLogo() { clearTimeout(timer); timer = setTimeout(async () => { try { await carregar(); render(); } catch (_) {} }, 600); }
  function tempoReal() {
    if (S.canal) return;
    S.canal = S.sb.channel('estoque')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'insumo_movimentos' }, recarregarLogo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'insumos' }, recarregarLogo)
      .subscribe();
  }
  async function historico(id) {
    if (S.movs[id]) return S.movs[id];
    const { data, error } = await S.sb.from('insumo_movimentos').select('*').eq('insumo_id', id).order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(30);
    if (error) throw error;
    return (S.movs[id] = data);
  }

  // ---------- Fotos ----------
  async function abrirImg(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {}
    const url = URL.createObjectURL(file);
    return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('Não foi possível abrir esta foto. Tente outra ou use "Tirar foto".')); i.src = url; });
  }
  async function reduzirFoto(file) {
    const img = await abrirImg(file);
    const w = img.width || img.naturalWidth, hh = img.height || img.naturalHeight, k = Math.min(1, 900 / Math.max(w, hh));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível ler a foto.'))), 'image/jpeg', 0.84));
  }
  async function enviarFoto(blob, nome) {
    const caminho = `${Date.now()}-${semAcento(nome).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.jpg`;
    const up = await S.sb.storage.from('insumos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    return S.sb.storage.from('insumos').getPublicUrl(caminho).data.publicUrl;
  }

  // =========================================================
  //   Entrar
  // =========================================================
  function telaLogin(msg) {
    app().innerHTML = `<div class="auth"><div class="auth-box">
      <span class="tag big">Estoque de Insumo</span>
      <form class="auth-card" id="f-login" novalidate>
        <div><h1>Entrar</h1><p class="muted">Use o mesmo usuário e senha do App de Compras.</p></div>
        ${msg ? `<div class="alert alert-warn">${h(msg)}</div>` : ''}
        <div class="field"><label for="l-user">Usuário</label><input id="l-user" class="input" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label for="l-pass">Senha</label><input id="l-pass" type="password" class="input" autocomplete="current-password"></div>
        <p class="form-error" id="l-err" role="alert"></p>
        <button class="btn btn-block" id="l-btn">Entrar</button>
      </form>
      <p class="muted small" style="text-align:center">Ainda não tem usuário? Crie no <a href="${h(LINK_COMPRAS)}" target="_blank" rel="noopener">App de Compras</a> e volte aqui.</p>
    </div></div>`;
    try { $('#l-user').value = localStorage.getItem('estoque.usuario') || ''; } catch (_) {}
    ($('#l-user').value ? $('#l-pass') : $('#l-user')).focus();
    $('#f-login').onsubmit = async (e) => {
      e.preventDefault();
      const u = $('#l-user').value.trim().toLowerCase(), s = $('#l-pass').value;
      if (!u || !s) return ($('#l-err').textContent = 'Preencha usuário e senha.');
      $('#l-btn').disabled = true; $('#l-err').textContent = '';
      try {
        await sessao();
        S.perfil = await rpc('entrar', { p_usuario: u, p_senha: s });
        try { localStorage.setItem('estoque.usuario', u); } catch (_) {}
        await iniciar();
      } catch (ex) { $('#l-err').textContent = msgErro(ex); $('#l-btn').disabled = false; }
    };
  }

  // =========================================================
  //   Estrutura
  // =========================================================
  const ABAS = [
    { id: 'entrada', nome: 'Entrada', icone: 'in' },
    { id: 'estoque', nome: 'Estoque', icone: 'box' },
    { id: 'retirada', nome: 'Retirada', icone: 'out' },
  ];
  function shell() {
    const me = S.perfil;
    app().innerHTML = `
      <header class="topbar">
        <div class="brand"><span class="tag">Estoque</span><span class="muted small">Insumos</span></div>
        <div class="spacer"></div>
        <span class="net" id="net" hidden>Sem internet</span>
        <div class="who"><b>${h(me.nome.split(' ')[0])}</b><small>${h(me.cdc)}</small></div>
        <button class="icon-btn" id="sair" title="Sair" aria-label="Sair">${ic('out2', 20)}</button>
      </header>
      <nav class="tabs" aria-label="Seções">${ABAS.map((a) => `<button data-tab="${a.id}">${ic(a.icone)}<span>${a.nome}</span></button>`).join('')}</nav>
      <main class="view" id="view" tabindex="-1"></main>`;
    $$('[data-tab]').forEach((b) => (b.onclick = () => { location.hash = '/' + b.dataset.tab; }));
    $('#sair').onclick = async () => {
      try { await rpc('sair'); } catch (_) {}
      try { await S.sb.auth.signOut(); } catch (_) {}
      if (S.canal) { try { S.sb.removeChannel(S.canal); } catch (_) {} S.canal = null; }
      S.perfil = null; telaLogin('Você saiu.');
    };
    rede();
  }
  function rede() { const n = $('#net'); if (n) n.hidden = navigator.onLine; }
  window.addEventListener('online', () => { rede(); if (S.perfil) recarregarLogo(); });
  window.addEventListener('offline', rede);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.perfil && navigator.onLine) recarregarLogo(); });

  function abaAtual() { const t = location.hash.replace(/^#\/?/, '').split('?')[0]; return ABAS.some((a) => a.id === t) ? t : 'estoque'; }
  window.addEventListener('hashchange', () => render(true));

  function render(trocou) {
    if (!S.perfil || !$('#view')) return;
    const tab = abaAtual(); const view = $('#view');
    // não apaga o que a pessoa está digitando
    if (!trocou && view.dataset.tab === tab && tab !== 'estoque' && $('form[data-sujo="1"]', view)) return;
    const mudou = view.dataset.tab !== tab; view.dataset.tab = tab;
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    ({ entrada: vEntrada, estoque: vEstoque, retirada: vRetirada })[tab](view);
    if (mudou) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  }

  // =========================================================
  //   Estoque
  // =========================================================
  function vEstoque(view) {
    const q = semAcento(S.busca).trim();
    const todos = S.produtos;
    const comSaldo = todos.filter((p) => p.saldo > 0);
    const lista = (S.zerados ? todos : comSaldo).filter((p) => !q || semAcento(p.nome).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    view.innerHTML = `
      <div class="page-head"><div><h1>Estoque</h1><p>Quantidade atual de cada insumo. Toque no produto para ver o histórico ou trocar a foto.</p></div></div>
      <div class="tools">
        <div class="search">${ic('search', 20)}<input type="search" class="input" id="busca" placeholder="Buscar produto" value="${h(S.busca)}" aria-label="Buscar produto"></div>
        <label class="switch"><input type="checkbox" id="zerados" ${S.zerados ? 'checked' : ''}> Mostrar zerados</label>
      </div>
      <p class="resumo">${comSaldo.length} ${comSaldo.length === 1 ? 'produto' : 'produtos'} com estoque${todos.length - comSaldo.length ? ` · ${todos.length - comSaldo.length} zerados ${S.zerados ? 'aparecendo' : 'escondidos'}` : ''}</p>
      <div class="cards" id="cards">${lista.length ? lista.map(cartao).join('') : ''}</div>
      ${lista.length ? '' : `<div class="empty"><strong>${q ? 'Nenhum produto com esse nome' : 'Nenhum produto com estoque'}</strong>${q ? 'Confira como foi escrito ou ative "Mostrar zerados".' : 'Registre uma entrada para começar.'}</div>`}`;
    $('#busca').oninput = (e) => {
      S.busca = e.target.value;
      const qq = semAcento(S.busca).trim();
      $$('#cards .card').forEach((c) => { c.hidden = !!qq && !semAcento(c.dataset.nome).includes(qq); });
    };
    $('#zerados').onchange = (e) => { S.zerados = e.target.checked; try { localStorage.setItem('estoque.zerados', S.zerados ? '1' : '0'); } catch (_) {} render(true); };
    $$('#cards .card').forEach((c) => (c.onclick = () => abrirProduto(+c.dataset.id)));
  }
  function cartao(p) {
    return `<button class="card" data-id="${p.id}" data-nome="${h(p.nome)}">
      ${imagem(p, 'img')}
      <span class="body"><span class="nome">${h(p.nome)}</span><span class="qtd ${p.saldo <= 0 ? 'zero' : ''}">${num(p.saldo)}</span>
      <span class="quando">${p.ultima_movimentacao ? 'Última: ' + dataBR(p.ultima_movimentacao) : 'Sem movimentação'}</span></span></button>`;
  }

  async function abrirProduto(id) {
    const p = S.produtos.find((x) => x.id === id); if (!p) return;
    const d = dialogo(`<div class="dlg">
      <div class="dlg-head"><h2>${h(p.nome)}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <div class="prod-top"><div id="p-img">${imagem(p, 'img')}</div>
        <div><p class="muted small">Em estoque</p><p class="qtd">${num(p.saldo)}</p>
          <div class="photo-row" style="margin-top:10px">
            <label class="btn btn-ghost btn-sm">${ic('camera', 18)} Tirar foto<input type="file" accept="image/*" capture="environment" class="sr" data-foto></label>
            <label class="btn btn-ghost btn-sm">${ic('image', 18)} Galeria<input type="file" accept="image/*" class="sr" data-foto></label>
          </div></div></div>
      <div class="row"><button class="btn btn-sm" data-ir="entrada">${ic('in', 18)} Dar entrada</button>${p.saldo > 0 ? `<button class="btn btn-out btn-sm" data-ir="retirada">${ic('out', 18)} Retirar</button>` : ''}</div>
      <h3>Movimentações</h3><ul class="mov" id="p-mov"><li class="muted">Carregando…</li></ul>
    </div>`);
    $('[data-x]', d).onclick = () => d.close();
    $$('[data-ir]', d).forEach((b) => (b.onclick = () => { d.close(); escolhido[b.dataset.ir] = p.id; location.hash = '/' + b.dataset.ir; render(true); }));
    $$('[data-foto]', d).forEach((inp) => (inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      try {
        toast('Salvando foto…');
        const blob = await reduzirFoto(f);
        $('#p-img', d).innerHTML = `<img class="foto img" src="${URL.createObjectURL(blob)}" alt="">`;
        const url = await enviarFoto(blob, p.nome);
        await rpc('trocar_foto_insumo', { p_insumo: p.id, p_foto_url: url });
        p.foto_url = url; toast('Foto atualizada.'); render(true);
      } catch (ex) { toast('A foto não foi salva: ' + msgErro(ex), 'erro', 9000); }
    }));
    try {
      const movs = await historico(p.id);
      $('#p-mov', d).innerHTML = movs.length ? movs.map((m) => {
        const ret = m.tipo === 'retirada';
        const quem = ret ? `Equipe ${h(m.equipe)}${m.observacao ? ' · ' + h(m.observacao) : ''}` : m.tipo === 'inicial' ? 'Estoque inicial' : h(m.responsavel);
        return `<li><span>${dataBR(m.data)} · ${ret ? 'Retirada' : m.tipo === 'inicial' ? 'Saldo inicial' : 'Entrada'}</span><span class="q ${ret ? 'out' : 'in'}">${ret ? '−' : '+'}${num(m.quantidade)}</span><small>${quem}</small></li>`;
      }).join('') : '<li class="muted">Nenhuma movimentação ainda.</li>';
    } catch (ex) { $('#p-mov', d).innerHTML = `<li class="muted">${h(msgErro(ex))}</li>`; }
  }

  // =========================================================
  //   Escolha de produto (com foto e busca)
  // =========================================================
  const escolhido = { entrada: null, retirada: null };
  function escolherProduto(modo, aoEscolher) {
    const fonte = modo === 'retirada' ? S.produtos.filter((p) => p.saldo > 0) : S.produtos;
    const d = dialogo(`<div class="dlg">
      <div class="dlg-head"><h2>${modo === 'retirada' ? 'Produto a retirar' : 'Produto da entrada'}</h2><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <div class="search">${ic('search', 20)}<input type="search" class="input" id="e-busca" placeholder="Buscar produto" aria-label="Buscar produto"></div>
      ${modo === 'entrada' ? `<button class="btn btn-ghost" id="e-novo">${ic('plus', 18)} Cadastrar produto novo</button>` : ''}
      <div class="lista-escolha" id="e-lista">${fonte.map((p) => `<button class="pick" data-id="${p.id}" data-nome="${h(p.nome)}">${imagem(p)}<span class="txt"><b>${h(p.nome)}</b><small>${num(p.saldo)} em estoque</small></span></button>`).join('') || '<p class="muted">Nenhum produto com estoque.</p>'}</div>
      <p class="muted small" id="e-nada" hidden>Não encontrou? ${modo === 'entrada' ? 'Cadastre o produto no botão acima.' : 'Ele pode estar zerado: dê entrada primeiro.'}</p>
    </div>`);
    $('[data-x]', d).onclick = () => d.close();
    $('#e-busca', d).oninput = (e) => {
      const q = semAcento(e.target.value).trim(); let vis = 0;
      $$('#e-lista .pick', d).forEach((b) => { const ok = !q || semAcento(b.dataset.nome).includes(q); b.hidden = !ok; if (ok) vis++; });
      $('#e-nada', d).hidden = vis > 0;
    };
    $$('#e-lista .pick', d).forEach((b) => (b.onclick = () => { d.close(); aoEscolher(+b.dataset.id); }));
    const nv = $('#e-novo', d); if (nv) nv.onclick = () => { const nome = $('#e-busca', d).value; d.close(); cadastrarProduto(nome, aoEscolher); };
    setTimeout(() => $('#e-busca', d).focus(), 50);
  }

  function cadastrarProduto(nomeInicial, aoCriar) {
    let foto = null;
    const d = dialogo(`<form class="dlg" id="f-prod" novalidate>
      <div class="dlg-head"><h2>Cadastrar produto</h2><button type="button" class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <div class="field"><label for="n-nome">Nome do produto</label><input id="n-nome" class="input" value="${h(nomeInicial || '')}" required>
        <span class="hint" id="n-prev"></span></div>
      <div class="field"><span class="label">Foto do produto</span>
        <img class="foto-prev" id="n-img" alt="" hidden>
        <div class="photo-row">
          <label class="btn btn-ghost btn-sm">${ic('camera', 18)} Tirar foto<input type="file" accept="image/*" capture="environment" class="sr" data-f></label>
          <label class="btn btn-ghost btn-sm">${ic('image', 18)} Galeria<input type="file" accept="image/*" class="sr" data-f></label>
        </div><span class="hint">Opcional. Sem foto, o produto aparece com as iniciais.</span></div>
      <p class="form-error" id="n-err" role="alert"></p>
      <div class="dlg-foot"><button type="button" class="btn btn-ghost" data-x>Cancelar</button><button class="btn" id="n-btn">Cadastrar</button></div>
    </form>`);
    $$('[data-x]', d).forEach((b) => (b.onclick = () => d.close()));
    const prev = () => { const n = nomePadrao($('#n-nome', d).value); $('#n-prev', d).textContent = n ? `Vai aparecer assim: ${n}` : ''; };
    $('#n-nome', d).oninput = prev; prev();
    $$('[data-f]', d).forEach((inp) => (inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      try { foto = await reduzirFoto(f); const im = $('#n-img', d); im.src = URL.createObjectURL(foto); im.hidden = false; }
      catch (ex) { $('#n-err', d).textContent = ex.message; }
    }));
    $('#f-prod', d).onsubmit = async (e) => {
      e.preventDefault();
      const nome = nomePadrao($('#n-nome', d).value);
      if (nome.length < 2) return ($('#n-err', d).textContent = 'Informe o nome do produto.');
      const igual = S.produtos.find((p) => p.nome.toLowerCase() === nome.toLowerCase());
      if (igual) { d.close(); toast(`${igual.nome} já está cadastrado. Selecionei para você.`); return aoCriar(igual.id); }
      const bt = $('#n-btn', d); bt.disabled = true; bt.textContent = 'Salvando…'; $('#n-err', d).textContent = '';
      try {
        const url = foto ? await enviarFoto(foto, nome) : null;
        const novo = await rpc('cadastrar_insumo', { p_nome: nome, p_foto_url: url });
        S.produtos.push({ ...novo, saldo: 0, ultima_movimentacao: null });
        S.produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        d.close(); toast(`${novo.nome} cadastrado.`); aoCriar(novo.id);
      } catch (ex) { $('#n-err', d).textContent = msgErro(ex); bt.disabled = false; bt.textContent = 'Cadastrar'; }
    };
  }

  function campoProduto(modo) {
    const p = S.produtos.find((x) => x.id === escolhido[modo]);
    return `<div class="field"><span class="label">Produto</span>
      <button type="button" class="pick" id="${modo}-prod">${p ? imagem(p) : `<div class="ph" style="--h:150"><span>${ic('box', 22)}</span></div>`}
        <span class="txt">${p ? `<b>${h(p.nome)}</b><small>${num(p.saldo)} em estoque</small>` : `<b>Escolher produto</b><small>${modo === 'entrada' ? 'ou cadastrar um novo' : 'só aparecem os que têm estoque'}</small>`}</span>
        <span class="chev">${ic('chev', 20)}</span></button></div>`;
  }

  // =========================================================
  //   Entrada
  // =========================================================
  function vEntrada(view) {
    if (escolhido.entrada && !S.produtos.some((p) => p.id === escolhido.entrada)) escolhido.entrada = null;
    view.innerHTML = `
      <div class="page-head"><div><h1>Entrada de insumo</h1><p>Registre o que chegou. A quantidade soma no estoque.</p></div></div>
      <form class="panel in" id="f-ent" novalidate>
        <div class="grid-2 stack-sm">
          <div class="field"><label for="ent-data">Data</label><input id="ent-data" type="date" class="input" value="${hoje()}" max="${hoje()}"></div>
          <div class="field"><label for="ent-qtd">Quantidade</label><input id="ent-qtd" class="input qtd" inputmode="decimal" placeholder="0"></div>
        </div>
        ${campoProduto('entrada')}
        <div class="field"><label for="ent-resp">Responsável pela entrada</label><input id="ent-resp" class="input" value="${h(S.perfil.nome)}" autocomplete="name"></div>
        <p class="form-error" id="ent-err" role="alert"></p>
        <div class="row end"><button class="btn" id="ent-btn">${ic('in', 18)} Registrar entrada</button></div>
      </form>`;
    const form = $('#f-ent');
    form.oninput = () => { form.dataset.sujo = '1'; $('#ent-err').textContent = ''; };
    $('#entrada-prod').onclick = () => escolherProduto('entrada', (id) => { escolhido.entrada = id; trocarProduto('entrada'); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#ent-err'); err.textContent = '';
      const dados = { data: $('#ent-data').value, qtd: lerNum($('#ent-qtd').value), resp: $('#ent-resp').value.trim(), id: escolhido.entrada };
      if (!dados.data) return (err.textContent = 'Informe a data.');
      if (dados.data > hoje()) return (err.textContent = 'A data não pode ser no futuro.');
      if (!dados.id) return (err.textContent = 'Escolha o produto.');
      if (!(dados.qtd > 0)) { $('#ent-qtd').focus(); return (err.textContent = 'Informe uma quantidade maior que zero.'); }
      if (dados.resp.length < 2) { $('#ent-resp').focus(); return (err.textContent = 'Informe o responsável pela entrada.'); }
      const bt = $('#ent-btn'); bt.disabled = true;
      try {
        const saldo = await rpc('registrar_entrada', { p_id: uuid(), p_data: dados.data, p_insumo: dados.id, p_quantidade: dados.qtd, p_responsavel: dados.resp });
        const p = S.produtos.find((x) => x.id === dados.id);
        if (p) { p.saldo = Number(saldo); p.ultima_movimentacao = dados.data; }
        delete S.movs[dados.id];
        toast(`Entrada registrada: +${num(dados.qtd)} ${p ? p.nome : ''}. Agora há ${num(saldo)}.`, 'in', 6000);
        escolhido.entrada = null; delete form.dataset.sujo; render(true);
      } catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; }
    };
  }
  function trocarProduto(modo) {
    const form = $(modo === 'entrada' ? '#f-ent' : '#f-ret'); if (!form) return render(true);
    form.dataset.sujo = '1';
    $(`#${modo}-prod`).closest('.field').outerHTML = campoProduto(modo);
    $(`#${modo}-prod`).onclick = () => escolherProduto(modo, (id) => { escolhido[modo] = id; trocarProduto(modo); });
    if (modo === 'retirada') atualizarDisponivel();
  }

  // =========================================================
  //   Retirada
  // =========================================================
  function vRetirada(view) {
    if (escolhido.retirada && !S.produtos.some((p) => p.id === escolhido.retirada && p.saldo > 0)) escolhido.retirada = null;
    const equipes = S.equipes;
    view.innerHTML = `
      <div class="page-head"><div><h1>Retirada de insumo</h1><p>Registre o que saiu e para qual equipe. A quantidade desconta do estoque.</p></div></div>
      <form class="panel out" id="f-ret" novalidate>
        <div class="grid-2 stack-sm">
          <div class="field"><label for="ret-data">Data da retirada</label><input id="ret-data" type="date" class="input" value="${hoje()}" max="${hoje()}"></div>
          <div class="field"><label for="ret-qtd">Quantidade</label><input id="ret-qtd" class="input qtd" inputmode="decimal" placeholder="0"></div>
        </div>
        ${campoProduto('retirada')}
        <p class="disp" id="ret-disp" hidden></p>
        <div class="field"><label for="ret-eq">Equipe</label>
          <select id="ret-eq" class="input"><option value="">Selecione</option>${equipes.map((e) => `<option value="${h(e.nome)}">${h(e.nome)} (${h(e.tipo)})</option>`).join('')}<option value="__outra">Outra equipe…</option></select>
          <input id="ret-eq-outra" class="input" placeholder="Nome da equipe" hidden></div>
        <div class="field"><label for="ret-obs">Observação</label><textarea id="ret-obs" class="input" placeholder="Ex.: aplicação na fazenda Gir, talhão 12"></textarea></div>
        <p class="form-error" id="ret-err" role="alert"></p>
        <div class="row end"><button class="btn btn-out" id="ret-btn">${ic('out', 18)} Registrar retirada</button></div>
      </form>`;
    const form = $('#f-ret');
    form.oninput = () => { form.dataset.sujo = '1'; $('#ret-err').textContent = ''; atualizarDisponivel(); };
    $('#ret-eq').onchange = (e) => { const o = e.target.value === '__outra'; $('#ret-eq-outra').hidden = !o; if (o) $('#ret-eq-outra').focus(); };
    $('#retirada-prod').onclick = () => escolherProduto('retirada', (id) => { escolhido.retirada = id; trocarProduto('retirada'); });
    atualizarDisponivel();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#ret-err'); err.textContent = '';
      const p = S.produtos.find((x) => x.id === escolhido.retirada);
      const eqSel = $('#ret-eq').value;
      const dados = { data: $('#ret-data').value, qtd: lerNum($('#ret-qtd').value), equipe: eqSel === '__outra' ? $('#ret-eq-outra').value.trim() : eqSel, obs: $('#ret-obs').value.trim() };
      if (!dados.data) return (err.textContent = 'Informe a data da retirada.');
      if (dados.data > hoje()) return (err.textContent = 'A data não pode ser no futuro.');
      if (!p) return (err.textContent = 'Escolha o produto.');
      if (!(dados.qtd > 0)) { $('#ret-qtd').focus(); return (err.textContent = 'Informe uma quantidade maior que zero.'); }
      if (dados.qtd > p.saldo) { $('#ret-qtd').focus(); return (err.textContent = `Só há ${num(p.saldo)} de ${p.nome} em estoque.`); }
      if (!dados.equipe) return (err.textContent = 'Informe a equipe.');
      const bt = $('#ret-btn'); bt.disabled = true;
      try {
        const saldo = await rpc('registrar_retirada', { p_id: uuid(), p_data: dados.data, p_insumo: p.id, p_quantidade: dados.qtd, p_equipe: dados.equipe, p_observacao: dados.obs || null });
        p.saldo = Number(saldo); p.ultima_movimentacao = dados.data; delete S.movs[p.id];
        toast(`Retirada registrada: −${num(dados.qtd)} ${p.nome} para ${dados.equipe}. Restam ${num(saldo)}.`, 'out', 6000);
        escolhido.retirada = null; delete form.dataset.sujo; render(true);
      } catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; recarregarLogo(); }
    };
  }
  function atualizarDisponivel() {
    const el = $('#ret-disp'); if (!el) return;
    const p = S.produtos.find((x) => x.id === escolhido.retirada);
    if (!p) { el.hidden = true; return; }
    const q = lerNum($('#ret-qtd').value);
    const resta = p.saldo - (q > 0 ? q : 0);
    el.hidden = false; el.classList.toggle('zero', resta < 0);
    el.textContent = resta < 0 ? `Só há ${num(p.saldo)} em estoque.` : q > 0 ? `Disponível: ${num(p.saldo)} · depois da retirada: ${num(resta)}` : `Disponível: ${num(p.saldo)}`;
  }

  // =========================================================
  //   Início
  // =========================================================
  async function iniciar() {
    try { localStorage.setItem('estoque.perfil', JSON.stringify(S.perfil)); } catch (_) {}
    shell();
    try { await carregar(); }
    catch (ex) {
      const em = doCache();
      toast(em ? 'Sem conexão. Mostrando o último estoque salvo neste aparelho.' : msgErro(ex), 'erro', 8000);
    }
    render(true);
    tempoReal();
  }
  async function boot() {
    if (!cliente()) {
      app().innerHTML = `<div class="auth"><div class="auth-box"><span class="tag big">Estoque de Insumo</span><div class="auth-card"><h2>Sem conexão com o banco</h2>
        <p>${navigator.onLine ? 'Não encontrei o endereço do banco. Confira o config.js do App de Compras ou preencha o config.js deste app.' : 'Conecte-se à internet e tente de novo.'}</p>
        <button class="btn" onclick="location.reload()">Tentar de novo</button></div></div></div>`;
      return;
    }
    try {
      const { data } = await S.sb.auth.getSession();
      if (data?.session) {
        const p = await rpc('meu_perfil');
        if (p && p.id) { S.perfil = p; return iniciar(); }
      }
    } catch (ex) {
      // sem internet mas já entrou antes: mostra o último estoque salvo
      try { const c = JSON.parse(localStorage.getItem('estoque.perfil') || 'null'); if (c && !navigator.onLine) { S.perfil = c; return iniciar(); } } catch (_) {}
    }
    telaLogin();
  }
  boot();
})();
