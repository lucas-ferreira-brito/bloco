/* Telas: Painel, Gastos, Projetos, Pendências e Anotações. Cada função devolve o HTML da tela. */
window.CE = window.CE || {};

CE.ui = { rq: '', mostrarEncerradas: false, cat: 'todos', q: '', mostrarCancelados: false, area: 'todas', mostrarFeitas: false, nq: '' };

CE.views = (() => {
  const { esc, money, pad, parseDay, today, daysUntil, fmtDate, monShort, relTime } = CE.u;
  const G = CE.gasto;
  const D = () => CE.store.dados;
  const ui = CE.ui;

  const ex = o => o.exemplo ? '<span class="tag-ex">exemplo</span>' : '';
  const vazio = (t, s) => `<div class="empty"><b>${t}</b>${s || ''}</div>`;
  const cat = k => CE.CATS[k] || CE.CATS.outros;
  const prazoTxt = s => {
    const d = daysUntil(s);
    if (d < 0) return `<span style="color:var(--bad)">atrasada ${-d}d</span>`;
    if (d === 0) return '<span style="color:var(--warn)">hoje</span>';
    if (d <= 3) return `<span style="color:var(--warn)">em ${d}d</span>`;
    return `até ${fmtDate(s)}`;
  };
  const PR = { alta: 0, media: 1, baixa: 2 };
  const ordenarPend = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || (PR[a.prioridade] ?? 3) - (PR[b.prioridade] ?? 3);

  /* ---------- PAINEL ---------- */
  function painel() {
    const d = D();
    const t = today(), y = t.getFullYear(), m = t.getMonth();
    const nMes = t.toLocaleDateString('pt-BR', { month: 'long' });
    const R = CE.receita;

    // Resultado do mês (o que de fato entrou e saiu)
    const recebidoMes = CE.somaMes(d.receitas, y, m);
    const pagoMes = CE.somaMes(d.gastos, y, m);
    const lucroMes = recebidoMes - pagoMes;
    const margem = recebidoMes > 0 ? Math.round(lucroMes / recebidoMes * 100) : null;

    // Ainda falta neste mês
    const noMesAtual = x => { const q = parseDay(x.vencimento); return q && q.getFullYear() === y && q.getMonth() === m; };
    const aReceberMes = d.receitas.filter(r => R.emAberto(r) && (noMesAtual(r) || daysUntil(r.vencimento) < 0)).reduce((s, r) => s + (+r.valor || 0), 0);
    const aPagarMes = d.gastos.filter(g => G.emAberto(g) && (noMesAtual(g) || daysUntil(g.vencimento) < 0)).reduce((s, g) => s + (+g.valor || 0), 0);

    // Previsão mensal recorrente
    const receitaFixa = d.receitas.reduce((s, r) => s + R.mensalEq(r), 0);
    const custoFixo = d.gastos.reduce((s, g) => s + G.mensalEq(g), 0);
    const lucroFixo = receitaFixa - custoFixo;

    // Últimos 6 meses
    const meses = [...Array(6)].map((_, i) => new Date(y, m - 5 + i, 1));
    const serie = meses.map(dt => {
      const rec = CE.somaMes(d.receitas, dt.getFullYear(), dt.getMonth());
      const gas = CE.somaMes(d.gastos, dt.getFullYear(), dt.getMonth());
      return { dt, rec, gas, luc: rec - gas };
    });
    const maxS = Math.max(1, ...serie.flatMap(s => [s.rec, s.gas]));
    const lucro6 = serie.reduce((s, x) => s + x.luc, 0);
    const curto = v => { const a = Math.abs(v); const s = a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(a).toLocaleString('pt-BR'); return (v < 0 ? '−' : '') + s; };

    // Custos por categoria
    const ativos = d.gastos.filter(g => g.ativo !== false);
    const porCat = Object.keys(CE.CATS).map(k => ({ k, v: ativos.filter(g => g.categoria === k).reduce((s, g) => s + G.mensalEq(g), 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const maxCat = Math.max(1, ...porCat.map(x => x.v));

    const aReceber = d.receitas.filter(r => R.emAberto(r) && daysUntil(r.vencimento) <= 30).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
    const aPagar = d.gastos.filter(g => G.emAberto(g) && daysUntil(g.vencimento) <= 30).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
    const pend = d.pendencias.filter(p => !p.feito).sort(ordenarPend).slice(0, 5);
    const projs = d.projetos.filter(p => p.fase === 'andamento');
    const sinal = v => v > 0 ? 'good' : v < 0 ? 'bad' : '';

    const linhaConta = (x, tipo) => {
      const s = tipo === 'r' ? R.status(x) : G.status(x); const dt = parseDay(x.vencimento);
      const sub = tipo === 'r' ? esc(x.cliente || 'Sem cliente') : `<span class="cat"><i class="dot" style="background:var(${cat(x.categoria).c})"></i>${cat(x.categoria).l}</span>`;
      return `<div class="li"><div class="datebox"><b>${pad(dt.getDate())}</b><span>${monShort(dt)}</span></div><div class="grow"><div class="t">${esc(x.descricao)}${ex(x)}</div><div class="sub">${sub} · <span class="num">${money(x.valor)}</span></div></div><span class="pill ${s.k}">${s.l}</span><button class="btn sm" data-act="${tipo === 'r' ? 'receber' : 'pagar'}" data-id="${x.id}">${tipo === 'r' ? 'Recebi' : 'Pagar'}</button></div>`;
    };

    return `
    <div class="head"><div><h1>Painel</h1><p>${t.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <div class="btn-row"><button class="btn" data-act="novo" data-col="gastos">+ Gasto</button><button class="btn primary" data-act="novo" data-col="receitas">+ Receita</button></div></div>
    <div class="kpis">
      <div class="kpi"><span class="label">Recebido em ${nMes}</span><span class="v pos">${money(recebidoMes)}</span><span class="s">${aReceberMes ? `falta receber ${money(aReceberMes)}` : 'nada pendente para receber'}</span></div>
      <div class="kpi"><span class="label">Gasto em ${nMes}</span><span class="v">${money(pagoMes)}</span><span class="s">${aPagarMes ? `falta pagar ${money(aPagarMes)}` : 'nada pendente para pagar'}</span></div>
      <div class="kpi lucro ${sinal(lucroMes)}"><span class="label">${lucroMes < 0 ? 'Prejuízo' : 'Lucro'} em ${nMes}</span><span class="v">${money(lucroMes)}</span><span class="s">${margem === null ? 'sem receitas recebidas no mês' : `margem de ${margem}%`} · previsto: ${money(lucroMes + aReceberMes - aPagarMes)}</span></div>
      <div class="kpi"><span class="label">Resultado fixo mensal</span><span class="v ${lucroFixo < 0 ? 'neg' : ''}">${money(lucroFixo)}</span><span class="s">receitas fixas ${money(receitaFixa)} − custos fixos ${money(custoFixo)}</span></div>
    </div>
    <div class="grid2">
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>Receitas × gastos: últimos 6 meses</h2><span class="legend"><span><i class="sw rec"></i>Recebido</span><span><i class="sw gas"></i>Gasto</span></span></div>
          <div class="cols2">${serie.map((s, i) => `<div class="col2 ${i === 5 ? 'now' : ''}">
            <div class="pair"><div class="b rec" style="height:${(s.rec / maxS * 100).toFixed(1)}%" title="Recebido ${money(s.rec)}"></div><div class="b gas" style="height:${(s.gas / maxS * 100).toFixed(1)}%" title="Gasto ${money(s.gas)}"></div></div></div>`).join('')}</div>
          <div class="col-labels">${serie.map(s => `<span>${monShort(s.dt)}</span>`).join('')}</div>
          <div class="col-labels lucros">${serie.map(s => `<span class="num ${sinal(s.luc)}">${s.rec || s.gas ? curto(s.luc) : '—'}</span>`).join('')}</div>
          <p class="muted" style="font-size:.78rem;margin:10px 0 0">Última linha: lucro de cada mês. Soma dos 6 meses: <b class="num ${sinal(lucro6)}">${money(lucro6)}</b>.</p>
        </section>
        <section class="panel"><div class="panel-h"><h2>Custo mensal por categoria</h2><a href="#gastos">Ver gastos →</a></div>
          ${porCat.length ? `<div class="bars">${porCat.map(x => `<div class="bar-row"><span class="cat"><i class="dot" style="background:var(${cat(x.k).c})"></i>${cat(x.k).l}</span><div class="bar-track"><div class="bar-fill" style="width:${(x.v / maxCat * 100).toFixed(1)}%;background:var(${cat(x.k).c})"></div></div><span class="num" style="text-align:right">${money(x.v)}</span></div>`).join('')}</div>` : vazio('Nenhum custo recorrente', 'Cadastre hospedagem, domínios, contador e assinaturas em Gastos.')}
        </section>
        <section class="panel"><div class="panel-h"><h2>Projetos em andamento</h2><a href="#projetos">Ver todos →</a></div>
          ${projs.length ? `<div class="list">${projs.map(p => `<div class="li"><div class="grow"><div class="t">${esc(p.nome)}${ex(p)}</div><div class="sub">${esc(p.cliente || 'Interno')} · prazo ${fmtDate(p.prazo)}</div><div class="prog" style="margin-top:6px"><i style="width:${+p.progresso || 0}%"></i></div></div><span class="num muted">${+p.progresso || 0}%</span></div>`).join('')}</div>` : vazio('Nenhum projeto em andamento')}
        </section>
      </div>
      <div class="stack">
        <section class="panel"><div class="panel-h"><h2>A receber nos próximos 30 dias</h2><a href="#receitas">Ver receitas →</a></div>
          ${aReceber.length ? `<div class="list">${aReceber.map(r => linhaConta(r, 'r')).join('')}</div>` : vazio('Nada previsto', 'Cadastre parcelas e mensalidades em Receitas.')}
        </section>
        <section class="panel"><div class="panel-h"><h2>A pagar nos próximos 30 dias</h2><a href="#gastos">Ver gastos →</a></div>
          ${aPagar.length ? `<div class="list">${aPagar.map(g => linhaConta(g, 'g')).join('')}</div>` : vazio('Tudo em dia', 'Nenhuma conta vence nos próximos 30 dias.')}
        </section>
        <section class="panel"><div class="panel-h"><h2>Pendências abertas</h2><a href="#pendencias">Ver todas →</a></div>
          ${pend.length ? `<div class="list">${pend.map(p => `<div class="li"><i class="prio ${p.prioridade || 'baixa'}" style="height:30px"></i><div class="grow"><div class="t">${esc(p.titulo)}${ex(p)}</div><div class="sub">${esc(p.responsavel || 'Sem responsável')} · ${p.prazo ? prazoTxt(p.prazo) : 'sem prazo'}</div></div></div>`).join('')}</div>` : vazio('Sem pendências abertas')}
        </section>
      </div>
    </div>`;
  }

  /* ---------- RECEITAS ---------- */
  function receitas() {
    const d = D(); const R = CE.receita;
    const t = today(), y = t.getFullYear(), m = t.getMonth();
    const base = d.receitas.filter(r => ui.mostrarEncerradas || r.ativo !== false);
    const q = (ui.rq || '').trim().toLowerCase();
    const linhas = base.filter(r => !q || `${r.descricao} ${r.cliente} ${r.obs}`.toLowerCase().includes(q))
      .sort((a, b) => (R.emAberto(b) - R.emAberto(a)) || (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
    const nomeProj = id => (d.projetos.find(p => p.id === id) || {}).nome;
    const emAberto = d.receitas.filter(R.emAberto);
    const atrasadas = emAberto.filter(r => daysUntil(r.vencimento) < 0);
    const recebidoMes = CE.somaMes(d.receitas, y, m);
    const recebidoAno = [...Array(m + 1)].reduce((s, _, i) => s + CE.somaMes(d.receitas, y, i), 0);
    return `
    <div class="head"><div><h1>Receitas</h1><p>Tudo o que entra: parcelas de projetos, mensalidades e serviços.</p></div>
      <button class="btn primary" data-act="novo" data-col="receitas">+ Nova receita</button></div>
    <div class="kpis">
      <div class="kpi"><span class="label">Recebido no mês</span><span class="v pos">${money(recebidoMes)}</span><span class="s">${t.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></div>
      <div class="kpi"><span class="label">Recebido em ${y}</span><span class="v">${money(recebidoAno)}</span><span class="s">de janeiro até hoje</span></div>
      <div class="kpi"><span class="label">A receber</span><span class="v">${money(emAberto.reduce((s, r) => s + (+r.valor || 0), 0))}</span><span class="s">${emAberto.length} lançamento${emAberto.length === 1 ? '' : 's'} em aberto</span></div>
      <div class="kpi ${atrasadas.length ? 'bad' : ''}"><span class="label">Recebimentos atrasados</span><span class="v">${money(atrasadas.reduce((s, r) => s + (+r.valor || 0), 0))}</span><span class="s">${atrasadas.length ? `${atrasadas.length} para cobrar` : 'Nenhum atraso'}</span></div>
    </div>
    <div class="toolbar"><input class="search" id="rq" type="search" placeholder="Buscar por descrição ou cliente…" value="${esc(ui.rq || '')}"><label class="check"><input type="checkbox" id="roff" ${ui.mostrarEncerradas ? 'checked' : ''}> Mostrar encerradas</label></div>
    ${linhas.length ? `<div class="tablewrap"><table><thead><tr><th>Descrição</th><th>Cliente</th><th>Tipo</th><th class="r">Valor</th><th>Previsão</th><th>Situação</th><th></th></tr></thead><tbody>
    ${linhas.map(r => { const s = R.status(r); const pn = nomeProj(r.projetoId); return `<tr class="${r.ativo === false ? 'off' : ''}">
      <td><div class="rowt">${esc(r.descricao)}${ex(r)}</div><div class="rowsub">${pn ? esc(pn) : ''}${r.forma ? `${pn ? ' · ' : ''}${CE.PAG[r.forma] || ''}` : ''}</div></td>
      <td>${esc(r.cliente || '—')}</td>
      <td>${CE.REC[r.recorrencia] || '—'}</td>
      <td class="r num">${money(r.valor)}</td>
      <td class="num">${fmtDate(r.vencimento)}</td>
      <td><span class="pill ${s.k}">${s.l}</span></td>
      <td><div class="actions">${R.emAberto(r) ? `<button class="btn sm" data-act="receber" data-id="${r.id}">Registrar recebimento</button>` : ''}<button class="btn sm ghost" data-act="editar" data-col="receitas" data-id="${r.id}">Editar</button></div></td></tr>`; }).join('')}
    </tbody></table></div>`
      : vazio(d.receitas.length ? 'Nada encontrado' : 'Nenhuma receita cadastrada', d.receitas.length ? 'Ajuste a busca.' : 'Cadastre as parcelas dos projetos e as mensalidades dos clientes.')}`;
  }

  /* ---------- GASTOS ---------- */
  function gastos() {
    const d = D();
    const base = d.gastos.filter(g => ui.mostrarCancelados || g.ativo !== false);
    const q = ui.q.trim().toLowerCase();
    const linhas = base.filter(g => (ui.cat === 'todos' || g.categoria === ui.cat) && (!q || `${g.descricao} ${g.fornecedor} ${g.obs}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
    const conta = k => base.filter(g => g.categoria === k).length;
    const nomeProj = id => (d.projetos.find(p => p.id === id) || {}).nome;
    return `
    <div class="head"><div><h1>Gastos</h1><p>Hospedagem, automações, domínios, impostos, contador e outras despesas.</p></div>
      <button class="btn primary" data-act="novo" data-col="gastos">+ Novo gasto</button></div>
    <div class="toolbar"><div class="chips"><button class="chip" data-act="cat" data-v="todos" aria-pressed="${ui.cat === 'todos'}">Todos <span class="n">${base.length}</span></button>
      ${Object.entries(CE.CATS).map(([k, c]) => `<button class="chip" data-act="cat" data-v="${k}" aria-pressed="${ui.cat === k}"><i class="dot" style="background:var(${c.c})"></i>${c.l} <span class="n">${conta(k)}</span></button>`).join('')}</div></div>
    <div class="toolbar"><input class="search" id="gq" type="search" placeholder="Buscar por nome, fornecedor…" value="${esc(ui.q)}"><label class="check"><input type="checkbox" id="goff" ${ui.mostrarCancelados ? 'checked' : ''}> Mostrar cancelados</label></div>
    ${linhas.length ? `<div class="tablewrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Cobrança</th><th class="r">Valor</th><th class="r">Por mês</th><th>Vencimento</th><th>Situação</th><th></th></tr></thead><tbody>
    ${linhas.map(g => { const s = G.status(g); const c = cat(g.categoria); const pn = nomeProj(g.projetoId); return `<tr class="${g.ativo === false ? 'off' : ''}">
      <td><div class="rowt">${esc(g.descricao)}${ex(g)}</div><div class="rowsub">${esc(g.fornecedor || '')}${pn ? ` · ${esc(pn)}` : ''}${g.pagamento ? ` · ${CE.PAG[g.pagamento] || ''}` : ''}</div></td>
      <td><span class="cat"><i class="dot" style="background:var(${c.c})"></i>${c.l}</span></td>
      <td>${CE.REC[g.recorrencia] || '—'}</td>
      <td class="r num">${money(g.valor)}</td>
      <td class="r num muted">${g.recorrencia === 'unico' ? '—' : money(G.mensalEq(g))}</td>
      <td class="num">${fmtDate(g.vencimento)}</td>
      <td><span class="pill ${s.k}">${s.l}</span></td>
      <td><div class="actions">${G.emAberto(g) ? `<button class="btn sm" data-act="pagar" data-id="${g.id}">Registrar pagamento</button>` : ''}<button class="btn sm ghost" data-act="editar" data-col="gastos" data-id="${g.id}">Editar</button></div></td></tr>`; }).join('')}
    </tbody><tfoot><tr><td colspan="4">${linhas.length} itens</td><td class="r num">${money(linhas.reduce((s, g) => s + G.mensalEq(g), 0))}</td><td colspan="3" class="muted" style="font-weight:400">custo mensal equivalente</td></tr></tfoot></table></div>`
      : vazio(d.gastos.length ? 'Nada encontrado' : 'Nenhum gasto cadastrado', d.gastos.length ? 'Ajuste a busca ou a categoria.' : 'Comece pela hospedagem dos sites e pelos domínios.')}`;
  }

  /* ---------- PROJETOS ---------- */
  function projetos() {
    const d = D();
    const custo = id => d.gastos.filter(g => g.projetoId === id).reduce((s, g) => s + G.mensalEq(g), 0);
    const recebido = id => d.receitas.filter(r => r.projetoId === id).flatMap(r => r.historico || []).reduce((s, h) => s + (+h.valor || 0), 0);
    return `
    <div class="head"><div><h1>Projetos</h1><p>Arraste um card para outra coluna para mudar a fase do projeto.</p></div>
      <button class="btn primary" data-act="novo" data-col="projetos">+ Novo projeto</button></div>
    <div class="board">${Object.entries(CE.FASES).map(([k, l]) => {
      const lista = d.projetos.filter(p => (p.fase || 'futuro') === k).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
      return `<div class="lane" data-fase="${k}"><div class="lane-h"><h3>${l}</h3><span class="num muted">${lista.length}</span></div>
      ${lista.length ? lista.map(p => { const c = custo(p.id); return `<div class="card" role="button" tabindex="0" draggable="true" data-act="editar" data-col="projetos" data-id="${p.id}" title="Clique para editar ou arraste para outra coluna">
        <div><div style="font-weight:600">${esc(p.nome)}${ex(p)}</div><div class="muted" style="font-size:.8rem">${esc(p.cliente || 'Projeto interno')}</div></div>
        ${k !== 'futuro' ? `<div style="display:flex;align-items:center;gap:8px"><div class="prog" style="flex:1"><i style="width:${+p.progresso || 0}%"></i></div><span class="num muted" style="font-size:.75rem">${+p.progresso || 0}%</span></div>` : ''}
        ${p.descricao ? `<div class="clamp2">${esc(p.descricao)}</div>` : ''}
        <div class="meta">${p.prazo ? `<span>Prazo ${fmtDate(p.prazo)}</span>` : ''}${+p.valor ? `<span>Contrato <b class="num" style="color:var(--fg)">${money(p.valor)}</b></span>` : ''}${recebido(p.id) ? `<span>Recebido <b class="num" style="color:var(--ok)">${money(recebido(p.id))}</b></span>` : ''}${c ? `<span>Custo/mês <b class="num" style="color:var(--fg)">${money(c)}</b></span>` : ''}${p.responsavel ? `<span>${esc(p.responsavel)}</span>` : ''}</div>
      </div>`; }).join('') : '<div class="lane-empty">Arraste um projeto para cá.</div>'}
      </div>`;
    }).join('')}</div>`;
  }

  /* ---------- PENDÊNCIAS ---------- */
  function linhaPend(p) {
    return `<div class="todo ${p.feito ? 'done' : ''}"><i class="prio ${p.prioridade || 'baixa'}"></i><input type="checkbox" data-act="concluir" data-id="${p.id}" ${p.feito ? 'checked' : ''} aria-label="Concluir ${esc(p.titulo)}">
      <div class="grow"><div class="t" style="font-weight:500">${esc(p.titulo)}${ex(p)}</div><div class="meta"><span class="pill">${CE.AREAS[p.area] || 'Geral'}</span><span>Prioridade ${CE.PRIO[p.prioridade] || '—'}</span>${p.responsavel ? `<span>${esc(p.responsavel)}</span>` : ''}<span>${p.prazo ? prazoTxt(p.prazo) : 'sem prazo'}</span></div>${p.obs ? `<div class="muted" style="font-size:.82rem;margin-top:4px;white-space:pre-wrap">${esc(p.obs)}</div>` : ''}</div>
      <button class="btn sm ghost" data-act="editar" data-col="pendencias" data-id="${p.id}">Editar</button></div>`;
  }
  function pendencias() {
    const d = D();
    const f = p => ui.area === 'todas' || p.area === ui.area;
    const abertas = d.pendencias.filter(p => !p.feito && f(p)).sort(ordenarPend);
    const feitas = d.pendencias.filter(p => p.feito && f(p)).sort((a, b) => (b.feitoEm || '').localeCompare(a.feitoEm || ''));
    return `
    <div class="head"><div><h1>Pendências</h1><p>${abertas.length} abertas · ${feitas.length} concluídas</p></div>
      <button class="btn primary" data-act="novo" data-col="pendencias">+ Nova pendência</button></div>
    <div class="toolbar"><div class="chips"><button class="chip" data-act="area" data-v="todas" aria-pressed="${ui.area === 'todas'}">Todas</button>${Object.entries(CE.AREAS).map(([k, l]) => `<button class="chip" data-act="area" data-v="${k}" aria-pressed="${ui.area === k}">${l}</button>`).join('')}</div></div>
    <section class="panel" style="padding:0">${abertas.length ? abertas.map(linhaPend).join('') : `<div style="padding:16px">${vazio('Nada pendente', 'Quando surgir algo, registre aqui com prazo e responsável.')}</div>`}</section>
    ${feitas.length ? `<div style="margin-top:18px"><button class="btn ghost" data-act="verFeitas">${ui.mostrarFeitas ? 'Ocultar' : 'Mostrar'} concluídas (${feitas.length})</button></div>${ui.mostrarFeitas ? `<section class="panel" style="padding:0;margin-top:10px">${feitas.map(linhaPend).join('')}</section>` : ''}` : ''}`;
  }

  /* ---------- ANOTAÇÕES ---------- */
  function anotacoes() {
    const d = D();
    const q = ui.nq.trim().toLowerCase();
    const lista = d.notas.filter(n => !q || `${n.titulo} ${n.texto}`.toLowerCase().includes(q))
      .sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0) || (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
    return `
    <div class="head"><div><h1>Anotações</h1><p>Decisões, ideias, combinados com clientes e atas de reunião.</p></div>
      <button class="btn primary" data-act="novo" data-col="notas">+ Nova anotação</button></div>
    <div class="toolbar"><input class="search" id="nq" type="search" placeholder="Buscar nas anotações…" value="${esc(ui.nq)}"></div>
    ${lista.length ? `<div class="notes">${lista.map(n => `<button class="note ${n.fixada ? 'pin' : ''}" data-act="editar" data-col="notas" data-id="${n.id}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h3>${esc(n.titulo || 'Sem título')}${ex(n)}</h3><span class="pill ${n.fixada ? 'acc' : ''}">${n.fixada ? 'Fixada' : (CE.NTAGS[n.tag] || 'Geral')}</span></div>
      <p>${esc(n.texto)}</p>
      <div class="foot"><span>${esc(CE.store.nomePessoa(n.criadoPor))}</span><span>${relTime(n.atualizadoEm || n.criadoEm)}</span></div></button>`).join('')}</div>`
      : vazio(d.notas.length ? 'Nada encontrado' : 'Nenhuma anotação', 'Use para registrar decisões da equipe.')}`;
  }

  return { painel, receitas, gastos, projetos, pendencias, anotacoes };
})();
