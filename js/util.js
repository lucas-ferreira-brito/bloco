/* Utilidades: formatação de datas e dinheiro, listas fixas do sistema. */
window.CE = window.CE || {};

CE.CATS = {
  hospedagem: { l: 'Hospedagem', c: '--c1' },
  automacao: { l: 'Automações', c: '--c2' },
  dominio: { l: 'Domínios', c: '--c3' },
  fiscal: { l: 'Impostos e taxas', c: '--c4' },
  contador: { l: 'Contador', c: '--c5' },
  ferramentas: { l: 'Ferramentas', c: '--c6' },
  outros: { l: 'Outros', c: '--c7' }
};
CE.REC = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', unico: 'Pagamento único' };
CE.CICLO = { mensal: 1, trimestral: 3, anual: 12 };
CE.PAG = { cartao: 'Cartão de crédito', boleto: 'Boleto', pix: 'Pix', debito: 'Débito automático', transferencia: 'Transferência' };
CE.FASES = { andamento: 'Em andamento', futuro: 'Projetos futuros', pausado: 'Pausados', concluido: 'Concluídos' };
CE.PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
CE.AREAS = { financeiro: 'Financeiro', fiscal: 'Fiscal', projetos: 'Projetos', tecnico: 'Técnico', comercial: 'Comercial' };
CE.NTAGS = { geral: 'Geral', reuniao: 'Reunião', ideia: 'Ideia', processo: 'Processo', cliente: 'Cliente' };

CE.u = (() => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  return {
    $: s => document.querySelector(s),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    money: v => brl.format(Number(v) || 0),
    pad, isoDay, parseDay, today,
    daysUntil: s => Math.round((parseDay(s) - today()) / 864e5),
    fmtDate: s => { const d = parseDay(s); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'; },
    monShort: d => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    addDays: n => { const d = today(); d.setDate(d.getDate() + n); return isoDay(d); },
    addMonths: (s, n) => {
      const d = parseDay(s) || today(); const day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last)); return isoDay(d);
    },
    novoId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    initials: n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join(''),
    relTime: iso => {
      if (!iso) return '';
      const diff = (Date.now() - new Date(iso)) / 1000;
      if (diff < 60) return 'agora';
      if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
      const d = Math.floor(diff / 86400); return d === 1 ? 'ontem' : `há ${d} dias`;
    },
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    clone: o => JSON.parse(JSON.stringify(o))
  };
})();

/* Regras de negócio dos gastos */
CE.gasto = {
  mensalEq(g) {
    if (g.ativo === false) return 0;
    const v = Number(g.valor) || 0;
    return g.recorrencia === 'mensal' ? v : g.recorrencia === 'trimestral' ? v / 3 : g.recorrencia === 'anual' ? v / 12 : 0;
  },
  emAberto(g) { return g.ativo !== false && !(g.recorrencia === 'unico' && g.pago) && !!g.vencimento; },
  status(g) {
    if (g.ativo === false) return { k: '', l: 'Cancelado' };
    if (g.recorrencia === 'unico' && g.pago) return { k: 'ok', l: 'Pago' };
    if (!g.vencimento) return { k: '', l: 'Sem data' };
    const d = CE.u.daysUntil(g.vencimento);
    if (d < 0) return { k: 'bad', l: `Atrasado ${-d}d` };
    if (d === 0) return { k: 'warn', l: 'Vence hoje' };
    if (d <= 7) return { k: 'warn', l: `Vence em ${d}d` };
    return { k: 'ok', l: 'Em dia' };
  }
};

/* Regras de negócio das receitas (mesmos campos de cobrança dos gastos) */
CE.receita = {
  mensalEq: g => CE.gasto.mensalEq(g),
  emAberto(r) { return r.ativo !== false && !(r.recorrencia === 'unico' && r.recebido) && !!r.vencimento; },
  status(r) {
    if (r.ativo === false) return { k: '', l: 'Encerrado' };
    if (r.recorrencia === 'unico' && r.recebido) return { k: 'ok', l: 'Recebido' };
    if (!r.vencimento) return { k: '', l: 'Sem data' };
    const d = CE.u.daysUntil(r.vencimento);
    if (d < 0) return { k: 'bad', l: `Atrasado ${-d}d` };
    if (d === 0) return { k: 'acc', l: 'Recebe hoje' };
    if (d <= 7) return { k: 'acc', l: `Recebe em ${d}d` };
    return { k: '', l: 'Previsto' };
  }
};

/* Soma do histórico (pagamentos ou recebimentos) dentro de um mês */
CE.somaMes = (lista, ano, mes) => lista.flatMap(x => x.historico || []).filter(h => {
  const d = CE.u.parseDay(h.data); return d && d.getFullYear() === ano && d.getMonth() === mes;
}).reduce((s, h) => s + (+h.valor || 0), 0);
