/* Formulários de cadastro e edição (janela que abre por cima da tela). */
window.CE = window.CE || {};

CE.forms = (() => {
  const { $, esc, money, fmtDate, relTime, today, isoDay, addMonths, novoId } = CE.u;
  const opts = o => Object.entries(o);
  const S = CE.store;

  const DEF = {
    receitas: { nome: 'receita', novo: 'Nova receita', f: [
      { k: 'descricao', l: 'Descrição', t: 'text', req: 1, full: 1, ph: 'Ex.: Site institucional – 2ª parcela' },
      { k: 'cliente', l: 'Cliente', t: 'text', ph: 'Quem paga' },
      { k: 'valor', l: 'Valor (R$)', t: 'money', req: 1 },
      { k: 'recorrencia', l: 'Tipo', t: 'select', o: () => opts(CE.REC), def: 'unico' },
      { k: 'vencimento', l: 'Data prevista de recebimento', t: 'date' },
      { k: 'forma', l: 'Forma de recebimento', t: 'select', o: () => [['', '—'], ...opts(CE.PAG)] },
      { k: 'projetoId', l: 'Projeto vinculado', t: 'select', o: () => [['', 'Nenhum'], ...S.dados.projetos.map(p => [p.id, p.nome])] },
      { k: 'ativo', l: 'Contrato ativo', t: 'check', def: true },
      { k: 'obs', l: 'Observações', t: 'area', full: 1, ph: 'Parcela, nota fiscal, condições combinadas…' }] },
    gastos: { nome: 'gasto', novo: 'Novo gasto', f: [
      { k: 'descricao', l: 'Descrição', t: 'text', req: 1, full: 1, ph: 'Ex.: Hospedagem VPS – sites dos clientes' },
      { k: 'categoria', l: 'Categoria', t: 'select', o: () => opts(CE.CATS).map(([k, c]) => [k, c.l]), def: 'hospedagem' },
      { k: 'fornecedor', l: 'Fornecedor', t: 'text', ph: 'Ex.: Hostinger, Registro.br' },
      { k: 'valor', l: 'Valor (R$)', t: 'money', req: 1 },
      { k: 'recorrencia', l: 'Cobrança', t: 'select', o: () => opts(CE.REC), def: 'mensal' },
      { k: 'vencimento', l: 'Próximo vencimento', t: 'date' },
      { k: 'pagamento', l: 'Forma de pagamento', t: 'select', o: () => [['', '—'], ...opts(CE.PAG)] },
      { k: 'projetoId', l: 'Projeto vinculado', t: 'select', o: () => [['', 'Nenhum (custo geral)'], ...S.dados.projetos.map(p => [p.id, p.nome])] },
      { k: 'ativo', l: 'Serviço ativo', t: 'check', def: true },
      { k: 'obs', l: 'Observações', t: 'area', full: 1, ph: 'Plano contratado, número do contrato, quem paga…' }] },
    projetos: { nome: 'projeto', novo: 'Novo projeto', f: [
      { k: 'nome', l: 'Nome do projeto', t: 'text', req: 1, full: 1 },
      { k: 'cliente', l: 'Cliente', t: 'text', ph: 'Deixe vazio se for interno' },
      { k: 'fase', l: 'Fase', t: 'select', o: () => opts(CE.FASES), def: 'andamento' },
      { k: 'inicio', l: 'Início', t: 'date' },
      { k: 'prazo', l: 'Prazo de entrega', t: 'date' },
      { k: 'valor', l: 'Valor do contrato (R$)', t: 'money' },
      { k: 'responsavel', l: 'Responsável', t: 'text' },
      { k: 'progresso', l: 'Progresso (%)', t: 'range', def: 0 },
      { k: 'descricao', l: 'Descrição e escopo', t: 'area', full: 1 }] },
    pendencias: { nome: 'pendência', novo: 'Nova pendência', f: [
      { k: 'titulo', l: 'O que precisa ser feito', t: 'text', req: 1, full: 1 },
      { k: 'area', l: 'Área', t: 'select', o: () => opts(CE.AREAS), def: 'financeiro' },
      { k: 'prioridade', l: 'Prioridade', t: 'select', o: () => opts(CE.PRIO), def: 'media' },
      { k: 'prazo', l: 'Prazo', t: 'date' },
      { k: 'responsavel', l: 'Responsável', t: 'text' },
      { k: 'obs', l: 'Detalhes', t: 'area', full: 1 }] },
    notas: { nome: 'anotação', novo: 'Nova anotação', f: [
      { k: 'titulo', l: 'Título', t: 'text', req: 1, full: 1 },
      { k: 'tag', l: 'Tipo', t: 'select', o: () => opts(CE.NTAGS), def: 'geral' },
      { k: 'fixada', l: 'Fixar no topo', t: 'check' },
      { k: 'texto', l: 'Texto', t: 'area', full: 1, hint: 'Não guarde senhas aqui: elas ficariam no histórico do GitHub.' }] }
  };
  const ROTULO_ITEM = { receitas: 'Receita', gastos: 'Gasto', projetos: 'Projeto', pendencias: 'Pendência', notas: 'Anotação' };
  const tituloDe = (col, o) => o.descricao || o.nome || o.titulo || '';

  let editando = null;

  function campo(fd, val) {
    const id = `f_${fd.k}`; const v = val ?? fd.def ?? '';
    if (fd.t === 'check') return `<div class="field checkf ${fd.full ? 'full' : ''}"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><label for="${id}">${fd.l}</label></div>`;
    let inp;
    if (fd.t === 'select') inp = `<select id="${id}">${fd.o().map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (fd.t === 'area') inp = `<textarea id="${id}" placeholder="${esc(fd.ph || '')}">${esc(v)}</textarea>`;
    else if (fd.t === 'money') inp = `<input id="${id}" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(v)}" ${fd.req ? 'required' : ''}>`;
    else if (fd.t === 'range') inp = `<div style="display:flex;gap:10px;align-items:center"><input id="${id}" type="range" min="0" max="100" step="5" value="${+v || 0}" style="flex:1;accent-color:var(--accent)"><output class="num" id="${id}_o">${+v || 0}%</output></div>`;
    else inp = `<input id="${id}" type="${fd.t}" value="${esc(v)}" placeholder="${esc(fd.ph || '')}" ${fd.req ? 'required' : ''}>`;
    return `<div class="field ${fd.full ? 'full' : ''}"><label for="${id}">${fd.l}</label>${inp}${fd.hint ? `<span class="hint">${fd.hint}</span>` : ''}</div>`;
  }

  function abrir(col, id) {
    const def = DEF[col]; const doc = id ? S.dados[col].find(x => x.id === id) : null;
    if (id && !doc) { CE.app.toast('Este item foi excluído por outra pessoa.'); return; }
    editando = { col, id };
    const hist = (col === 'gastos' || col === 'receitas') && doc && doc.historico && doc.historico.length
      ? `<div class="hist"><span class="label">${col === 'receitas' ? 'Recebimentos' : 'Pagamentos'} registrados</span><ul>${[...doc.historico].reverse().map(h => `<li><span class="num">${fmtDate(h.data)}</span><span class="num">${money(h.valor)}</span></li>`).join('')}</ul></div>` : '';
    const meta = doc ? `<div class="hist muted">Criado por ${esc(S.nomePessoa(doc.criadoPor))}${doc.atualizadoEm ? ` · atualizado ${relTime(doc.atualizadoEm)}` : ''}${doc.atualizadoPor ? ` por ${esc(S.nomePessoa(doc.atualizadoPor))}` : ''}</div>` : '';
    $('#dlgForm').innerHTML = `
      <div class="dlg-h"><h2>${doc ? 'Editar ' + def.nome : def.novo}</h2><button type="button" class="btn ghost sm" data-act="fechar" aria-label="Fechar">✕</button></div>
      <div class="dlg-b">${def.f.map(fd => campo(fd, doc ? doc[fd.k] : undefined)).join('')}${hist}${meta}</div>
      <div class="dlg-f">${doc ? '<button type="button" class="btn danger" data-act="excluir">Excluir</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-act="fechar">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div>`;
    const r = $('#f_progresso'); if (r) r.addEventListener('input', () => { $('#f_progresso_o').textContent = r.value + '%'; });
    $('#dlg').showModal();
    if (!doc) { const p = $('#dlgForm .dlg-b input, #dlgForm .dlg-b select'); if (p) p.focus(); }
  }

  function ler(col) {
    const out = {};
    for (const fd of DEF[col].f) {
      const el = document.getElementById('f_' + fd.k);
      if (fd.t === 'check') out[fd.k] = el.checked;
      else if (fd.t === 'money' || fd.t === 'range') out[fd.k] = el.value === '' ? 0 : Math.round(parseFloat(String(el.value).replace(',', '.')) * 100) / 100;
      else out[fd.k] = el.value.trim();
    }
    return out;
  }

  function salvar() {
    if (!editando) return;
    const { col, id } = editando;
    const dados = ler(col);
    for (const fd of DEF[col].f) {
      if (fd.req && (dados[fd.k] === '' || (fd.t === 'money' && !(dados[fd.k] > 0)))) {
        CE.app.toast(`Preencha “${fd.l}”.`); document.getElementById('f_' + fd.k).focus(); return;
      }
    }
    const agora = new Date().toISOString();
    const login = S.eu && S.eu.login;
    dados.atualizadoEm = agora; dados.atualizadoPor = login;
    if (id) {
      dados.id = id; dados.exemplo = false;
      S.executar(S.ops.salvar(col, dados), `${ROTULO_ITEM[col]} editado: ${tituloDe(col, dados)}`);
    } else {
      dados.id = novoId(); dados.criadoEm = agora; dados.criadoPor = login;
      if (col === 'pendencias') dados.feito = false;
      if (col === 'gastos' || col === 'receitas') dados.historico = [];
      if (col === 'receitas') dados.recebido = false;
      S.executar(S.ops.salvar(col, dados), `${ROTULO_ITEM[col]} criado: ${tituloDe(col, dados)}`);
    }
    $('#dlg').close();
    CE.app.toast('Salvo');
  }

  function excluir(btn) {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed'); btn.textContent = 'Confirmar exclusão';
      setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'Excluir'; } }, 4000);
      return;
    }
    const { col, id } = editando;
    const doc = S.dados[col].find(x => x.id === id) || {};
    S.executar(S.ops.excluir(col, id), `${ROTULO_ITEM[col]} excluído: ${tituloDe(col, doc)}`);
    $('#dlg').close();
    CE.app.toast('Excluído');
  }

  /** Registra pagamento: guarda no histórico e passa o vencimento para o próximo ciclo. */
  function pagar(id) {
    const g = S.dados.gastos.find(x => x.id === id); if (!g) return;
    const login = S.eu && S.eu.login;
    const hoje = isoDay(today());
    let proximo = null;
    S.executar(S.ops.alterar('gastos', id, it => {
      it.historico = [...(it.historico || []), { data: hoje, valor: +it.valor || 0, ref: it.vencimento || '', por: login }].slice(-60);
      if (it.recorrencia === 'unico') it.pago = true;
      else it.vencimento = proximo = addMonths(it.vencimento, CE.CICLO[it.recorrencia] || 1);
      it.atualizadoEm = new Date().toISOString(); it.atualizadoPor = login;
    }), `Pagamento registrado: ${g.descricao} (${money(g.valor)})`);
    CE.app.toast(proximo ? `Pago. Próximo vencimento: ${fmtDate(proximo)}` : 'Pagamento registrado');
  }

  /** Move um projeto para outra fase (arrastar e soltar no quadro). */
  function mover(id, fase) {
    const p = S.dados.projetos.find(x => x.id === id);
    if (!p || p.fase === fase || !CE.FASES[fase]) return;
    const login = S.eu && S.eu.login;
    S.executar(S.ops.alterar('projetos', id, it => {
      it.fase = fase;
      if (fase === 'concluido') { it.progresso = 100; it.concluidoEm = isoDay(today()); }
      it.atualizadoEm = new Date().toISOString(); it.atualizadoPor = login;
    }), `Projeto movido para ${CE.FASES[fase]}: ${p.nome}`);
    CE.app.toast(`Movido para ${CE.FASES[fase]}`);
  }

  /** Registra recebimento: guarda no histórico e, se for recorrente, passa para o próximo ciclo. */
  function receber(id) {
    const r = S.dados.receitas.find(x => x.id === id); if (!r) return;
    const login = S.eu && S.eu.login;
    const hoje = isoDay(today());
    let proximo = null;
    S.executar(S.ops.alterar('receitas', id, it => {
      it.historico = [...(it.historico || []), { data: hoje, valor: +it.valor || 0, ref: it.vencimento || '', por: login }].slice(-60);
      if (it.recorrencia === 'unico') it.recebido = true;
      else it.vencimento = proximo = addMonths(it.vencimento, CE.CICLO[it.recorrencia] || 1);
      it.atualizadoEm = new Date().toISOString(); it.atualizadoPor = login;
    }), `Recebimento registrado: ${r.descricao} (${money(r.valor)})`);
    CE.app.toast(proximo ? `Recebido. Próximo: ${fmtDate(proximo)}` : 'Recebimento registrado');
  }

  function concluir(id, feito) {
    const p = S.dados.pendencias.find(x => x.id === id); if (!p) return;
    const login = S.eu && S.eu.login;
    S.executar(S.ops.alterar('pendencias', id, it => {
      it.feito = feito; it.feitoEm = feito ? new Date().toISOString() : '';
      it.atualizadoEm = new Date().toISOString(); it.atualizadoPor = login;
    }), `Pendência ${feito ? 'concluída' : 'reaberta'}: ${p.titulo}`);
  }

  return { abrir, salvar, excluir, pagar, receber, mover, concluir };
})();
