/* Aplicativo: navegação, desenho das telas e cliques. */
window.CE = window.CE || {};

CE.app = (() => {
  const { $, esc, initials, relTime } = CE.u;
  const S = CE.store;
  const ui = CE.ui;

  const ICONES = {
    painel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    receitas: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    gastos: '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M8 15h3"/></svg>',
    projetos: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    pendencias: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
    anotacoes: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>'
  };
  const TELAS = [['painel', 'Painel'], ['receitas', 'Receitas'], ['gastos', 'Gastos'], ['projetos', 'Projetos'], ['pendencias', 'Pendências'], ['anotacoes', 'Anotações']];
  let aberto = false;

  const atual = () => { const h = location.hash.slice(1); return TELAS.some(v => v[0] === h) ? h : 'painel'; };

  function desenharNav() {
    const d = S.dados;
    const atrasados = d.gastos.filter(g => CE.gasto.emAberto(g) && CE.u.daysUntil(g.vencimento) < 0).length;
    const pendAtras = d.pendencias.filter(p => !p.feito && p.prazo && CE.u.daysUntil(p.prazo) < 0).length;
    const recAtras = d.receitas.filter(r => CE.receita.emAberto(r) && CE.u.daysUntil(r.vencimento) < 0).length;
    const badge = { receitas: recAtras, gastos: atrasados, pendencias: pendAtras };
    $('#nav').innerHTML = TELAS.map(([k, l]) => `<a href="#${k}" ${atual() === k ? 'aria-current="page"' : ''}>${ICONES[k]}<span>${l}</span>${badge[k] ? `<span class="count" title="Atrasados">${badge[k]}</span>` : ''}</a>`).join('');
  }

  function desenharRodape() {
    const pessoas = Object.entries(S.dados.pessoas || {});
    const meu = S.eu && S.eu.login;
    $('#who').innerHTML = pessoas.length
      ? pessoas.map(([login, p]) => `<span class="avatar ${login === meu ? 'me' : ''}" title="${esc(p.nome)} (${esc(login)})${login === meu ? ' — você' : ''}">${esc(initials(p.nome))}</span>`).join('')
      : (S.demo ? '<span class="avatar me" title="Demonstração">VC</span>' : '');
    const sync = $('#sync');
    sync.className = 'sync ' + (S.status === 'ok' ? '' : S.status);
    let txt;
    if (S.demo) txt = 'Demonstração: nada é salvo';
    else if (S.status === 'salvando') txt = 'Salvando no GitHub…';
    else if (S.status === 'erro') txt = 'Erro: ' + S.erro;
    else txt = S.ultimaSync ? `Sincronizado ${relTime(S.ultimaSync.toISOString())}` : 'Sincronizado';
    sync.querySelector('span').textContent = txt;
    const link = $('#linkHistorico');
    link.hidden = S.demo;
    if (!S.demo && CE.github.cfg) link.href = CE.github.linkHistorico();
  }

  function desenhar() {
    if (!aberto) return;
    desenharNav();
    desenharRodape();
    const qtdEx = S.COLS.reduce((s, c) => s + S.dados[c].filter(o => o.exemplo).length, 0);
    let topo = '';
    if (S.demo) topo = '<div class="banner"><span>Modo demonstração: as alterações não são salvas.</span><button class="btn sm" data-act="sair">Conectar ao GitHub</button></div>';
    else if (qtdEx) topo = `<div class="banner"><span>Há <b>${qtdEx}</b> registros de exemplo para vocês verem o sistema funcionando.</span><button class="btn sm danger" data-act="apagarEx">Apagar exemplos</button></div>`;
    if (S.status === 'erro' && !S.demo) topo = `<div class="banner bad"><span>${esc(S.erro)}</span><button class="btn sm" data-act="recarregar">Tentar de novo</button></div>` + topo;

    // mantém o foco no campo de busca enquanto digita
    const ae = document.activeElement; const fid = ae && ae.id; const pos = ae && ae.selectionStart;
    $('#main').innerHTML = topo + CE.views[atual()]();
    if (fid === 'gq' || fid === 'nq' || fid === 'rq') { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
  }

  let tt;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3000); }

  function apagarExemplos(btn) {
    if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Confirmar: apagar exemplos'; return; }
    S.executar(S.ops.apagarExemplos(), 'Remove dados de exemplo');
    toast('Exemplos apagados');
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'novo') CE.forms.abrir(b.dataset.col);
    else if (a === 'editar') CE.forms.abrir(b.dataset.col, b.dataset.id);
    else if (a === 'fechar') $('#dlg').close();
    else if (a === 'excluir') CE.forms.excluir(b);
    else if (a === 'pagar') CE.forms.pagar(b.dataset.id);
    else if (a === 'receber') CE.forms.receber(b.dataset.id);
    else if (a === 'cat') { ui.cat = b.dataset.v; desenhar(); }
    else if (a === 'area') { ui.area = b.dataset.v; desenhar(); }
    else if (a === 'verFeitas') { ui.mostrarFeitas = !ui.mostrarFeitas; desenhar(); }
    else if (a === 'apagarEx') apagarExemplos(b);
    else if (a === 'recarregar') S.recarregar(true);
    else if (a === 'sair') sair();
  });
  document.addEventListener('change', e => {
    if (e.target.dataset.act === 'concluir') CE.forms.concluir(e.target.dataset.id, e.target.checked);
    if (e.target.id === 'goff') { ui.mostrarCancelados = e.target.checked; desenhar(); }
    if (e.target.id === 'roff') { ui.mostrarEncerradas = e.target.checked; desenhar(); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'gq') { ui.q = e.target.value; desenhar(); }
    if (e.target.id === 'rq') { ui.rq = e.target.value; desenhar(); }
    if (e.target.id === 'nq') { ui.nq = e.target.value; desenhar(); }
  });
  /* Arrastar projetos entre as colunas do quadro */
  let arrastando = null;
  document.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('.card[draggable]'); if (!card) return;
    arrastando = card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', arrastando); } catch (err) {}
    requestAnimationFrame(() => card.classList.add('arrastando'));
  });
  document.addEventListener('dragend', () => {
    arrastando = null;
    document.querySelectorAll('.arrastando, .lane.alvo').forEach(el => el.classList.remove('arrastando', 'alvo'));
  });
  document.addEventListener('dragover', e => {
    const lane = arrastando && e.target.closest && e.target.closest('.lane[data-fase]'); if (!lane) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.lane.alvo').forEach(l => { if (l !== lane) l.classList.remove('alvo'); });
    lane.classList.add('alvo');
  });
  document.addEventListener('drop', e => {
    const lane = arrastando && e.target.closest && e.target.closest('.lane[data-fase]'); if (!lane) return;
    e.preventDefault();
    const id = arrastando; arrastando = null;
    CE.forms.mover(id, lane.dataset.fase);
  });
  // Card com teclado: Enter ou espaço abre a edição
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card[role="button"]')) { e.preventDefault(); e.target.click(); }
  });

  $('#dlgForm').addEventListener('submit', e => { e.preventDefault(); CE.forms.salvar(); });
  window.addEventListener('hashchange', () => { desenhar(); window.scrollTo(0, 0); });
  window.addEventListener('beforeunload', e => { if (S.salvando) { e.preventDefault(); e.returnValue = ''; } });
  setInterval(() => { if (aberto) desenharRodape(); }, 15000);
  S.ouvir(desenhar);

  function abrir() {
    aberto = true;
    $('#telaSetup').hidden = true;
    $('#telaApp').hidden = false;
    desenhar();
  }

  function sair(porErro) {
    aberto = false;
    const eraDemo = S.demo;
    S.parar();
    if (!eraDemo) CE.setup.esquecerToken();
    CE.setup.mostrar(porErro ? 'Sua sessão expirou. Informe a chave de acesso novamente.' : '');
  }

  return { abrir, sair, toast, desenhar };
})();

CE.setup.iniciar();
