/*
 * Estado dos dados + sincronização.
 *
 * Como funciona:
 * - Toda alteração é uma "operação" (criar, editar, excluir um item).
 * - A operação é aplicada na tela na hora e entra numa fila.
 * - Para gravar, o sistema lê a versão mais recente do GitHub, aplica a
 *   operação em cima dela e grava. Assim, se outra pessoa salvou algo
 *   no meio do caminho, nada dele se perde.
 * - Se dois salvarem no mesmo segundo, o GitHub recusa um deles
 *   (conflito); o sistema relê e tenta de novo sozinho.
 * - A cada X segundos, busca alterações feitas por outras pessoas.
 */
window.CE = window.CE || {};

CE.store = (() => {
  const COLS = ['receitas', 'gastos', 'projetos', 'pendencias', 'notas'];
  const vazio = () => ({ versao: 1, pessoas: {}, receitas: [], gastos: [], projetos: [], pendencias: [], notas: [] });
  const normalizar = d => {
    const o = Object.assign(vazio(), d || {});
    COLS.forEach(c => { if (!Array.isArray(o[c])) o[c] = []; });
    if (!o.pessoas || typeof o.pessoas !== 'object') o.pessoas = {};
    return o;
  };

  const st = {
    dados: vazio(),
    sha: null,
    eu: null,              // { login, nome }
    demo: false,           // modo demonstração: não grava no GitHub
    status: 'ok',          // ok | salvando | erro
    erro: '',
    ultimaSync: null,
    pendentes: [],
    fila: Promise.resolve(),
    ouvintes: [],
    timer: null
  };

  const avisar = () => st.ouvintes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const setStatus = (s, erro = '') => { st.status = s; st.erro = erro; avisar(); };

  /* ---------- operações (funções que alteram um objeto de dados) ---------- */
  const ops = {
    salvar(col, item) {
      return d => {
        const i = d[col].findIndex(x => x.id === item.id);
        if (i >= 0) d[col][i] = Object.assign({}, d[col][i], item);
        else d[col].push(Object.assign({}, item));
      };
    },
    excluir(col, id) { return d => { d[col] = d[col].filter(x => x.id !== id); }; },
    alterar(col, id, fn) {
      return d => { const it = d[col].find(x => x.id === id); if (it) fn(it); };
    },
    pessoa(login, nome) { return d => { d.pessoas[login] = { nome }; }; },
    apagarExemplos() { return d => { COLS.forEach(c => { d[c] = d[c].filter(x => !x.exemplo); }); }; },
    substituirTudo(novo) { return d => { const n = normalizar(novo); Object.keys(d).forEach(k => delete d[k]); Object.assign(d, n); }; }
  };

  async function commit(item) {
    if (st.demo) { st.pendentes.splice(st.pendentes.indexOf(item), 1); setStatus('ok'); return; }
    setStatus('salvando');
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        const remoto = await CE.github.ler();
        const base = remoto ? normalizar(remoto.dados) : vazio();
        item.op(base);
        base.atualizadoEm = new Date().toISOString();
        const novoSha = await CE.github.gravar(base, remoto && remoto.sha, item.msg);
        st.pendentes.splice(st.pendentes.indexOf(item), 1);
        st.sha = novoSha;
        st.dados = base;
        st.pendentes.forEach(p => p.op(st.dados)); // reaplica o que ainda está na fila
        st.ultimaSync = new Date();
        setStatus(st.pendentes.length ? 'salvando' : 'ok');
        return;
      } catch (e) {
        if (e.tipo === 'conflito' && tentativa < 4) { await CE.u.sleep(300 + Math.random() * 900); continue; }
        st.pendentes.splice(st.pendentes.indexOf(item), 1);
        setStatus('erro', e.message || 'Erro ao salvar.');
        CE.app && CE.app.toast(e.message || 'Não foi possível salvar.');
        if (e.tipo === 'token') CE.app && CE.app.sair(true);
        else await recarregar(true);
        return;
      }
    }
  }

  async function recarregar(forcar = false) {
    if (st.demo) return;
    if (st.pendentes.length && !forcar) return; // não sobrescreve o que está sendo salvo
    try {
      const remoto = await CE.github.ler();
      st.ultimaSync = new Date();
      if (!remoto) return;
      if (remoto.sha !== st.sha || forcar) {
        st.sha = remoto.sha;
        st.dados = normalizar(remoto.dados);
        st.pendentes.forEach(p => p.op(st.dados));
      }
      if (st.status === 'erro' && !forcar) setStatus('ok'); else avisar();
    } catch (e) {
      setStatus('erro', e.message);
      if (e.tipo === 'token') CE.app && CE.app.sair(true);
    }
  }

  return {
    COLS,
    ops,
    get dados() { return st.dados; },
    get eu() { return st.eu; },
    get demo() { return st.demo; },
    get status() { return st.status; },
    get erro() { return st.erro; },
    get ultimaSync() { return st.ultimaSync; },
    get salvando() { return st.pendentes.length > 0; },
    ouvir(fn) { st.ouvintes.push(fn); },

    /** Executa uma operação: aparece na tela na hora e é gravada no GitHub em seguida. */
    executar(op, msg) {
      const item = { op, msg: msg + (st.eu ? ` (por ${st.eu.nome})` : '') };
      st.pendentes.push(item);
      op(st.dados);
      avisar();
      st.fila = st.fila.then(() => commit(item));
      return st.fila;
    },

    async iniciar(eu, remoto) {
      st.eu = eu; st.demo = false;
      st.sha = remoto.sha; st.dados = normalizar(remoto.dados); st.ultimaSync = new Date();
      avisar();
      if (!st.dados.pessoas[eu.login] || st.dados.pessoas[eu.login].nome !== eu.nome) {
        this.executar(ops.pessoa(eu.login, eu.nome), `Acesso: ${eu.login}`);
      }
      clearInterval(st.timer);
      const seg = Math.max(10, Number(CE.config.intervaloSincronizacao) || 30);
      st.timer = setInterval(() => { if (!document.hidden) recarregar(); }, seg * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) recarregar(); });
      window.addEventListener('focus', () => recarregar());
    },

    iniciarDemo(dados) {
      st.demo = true; st.eu = { login: 'demo', nome: 'Você (demonstração)' };
      st.dados = normalizar(dados); st.ultimaSync = new Date();
      avisar();
    },

    parar() { clearInterval(st.timer); st.dados = vazio(); st.sha = null; st.eu = null; st.pendentes = []; },
    recarregar,
    nomePessoa(login) {
      if (!login) return 'Exemplo';
      const p = st.dados.pessoas[login];
      return (p && p.nome) || login;
    }
  };
})();
