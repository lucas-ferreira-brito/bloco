/* Tela de acesso. A chave fica salva só neste navegador. */
window.CE = window.CE || {};

CE.setup = (() => {
  const { $, esc } = CE.u;
  const CHAVE = 'bloco:sessao';
  const ANTIGA = ['caixa', 'empresa'].join('-') + ':conexao';

  // Leva uma sessão salva por versões antigas para a chave nova e apaga a antiga
  try {
    const antiga = localStorage.getItem(ANTIGA);
    if (antiga) {
      const o = JSON.parse(antiga);
      if (o && o.token && !localStorage.getItem(CHAVE)) localStorage.setItem(CHAVE, JSON.stringify({ token: o.token }));
      localStorage.removeItem(ANTIGA);
    }
  } catch (e) {}

  const lerToken = () => { try { return (JSON.parse(localStorage.getItem(CHAVE) || 'null') || {}).token || ''; } catch (e) { return ''; } };
  const gravarToken = token => { try { localStorage.setItem(CHAVE, JSON.stringify({ token })); } catch (e) {} };
  const apagarToken = () => { try { localStorage.removeItem(CHAVE); } catch (e) {} };
  const conexao = token => ({ owner: CE.config.owner, repo: CE.config.repo, branch: CE.config.branch, arquivo: CE.config.arquivo, token });

  function mostrar(msg) {
    $('#telaApp').hidden = true;
    const t = $('#telaSetup'); t.hidden = false;
    t.innerHTML = `
    <form class="setup-box" id="formSetup" autocomplete="off">
      <div class="brand"><div class="brand-mark">B</div><div><b>Bloco</b><small>Acesso restrito</small></div></div>
      ${msg ? `<div class="msg bad" id="msgSetup">${esc(msg)}</div>` : '<div class="msg bad" id="msgSetup" hidden></div>'}
      <div class="field"><label for="s_token">Chave de acesso</label><input id="s_token" type="password" required spellcheck="false" autocomplete="off"></div>
      <div class="btn-row"><button type="submit" class="btn primary" id="btnConectar">Entrar</button></div>
    </form>`;
    $('#formSetup').addEventListener('submit', e => {
      e.preventDefault();
      const b = $('#btnConectar'); b.disabled = true; b.textContent = 'Entrando…';
      conectar(conexao($('#s_token').value.trim()), true);
    });
  }

  function erroSetup(m) { const el = $('#msgSetup'); if (el) { el.textContent = m; el.hidden = false; } const b = $('#btnConectar'); if (b) { b.disabled = false; b.textContent = 'Entrar'; } }

  async function conectar(c, doFormulario) {
    CE.github.configurar(c);
    try {
      const eu = await CE.github.eu();
      const repo = await CE.github.checarRepo();
      if (!repo.privado) return erroSetup('Configuração insegura: o armazenamento precisa ser privado.');
      const remoto = await CE.github.ler();
      gravarToken(c.token);
      if (!remoto) return primeiroAcesso(eu);
      await CE.store.iniciar(eu, remoto);
      CE.app.abrir();
    } catch (e) {
      // Mensagem genérica para não revelar detalhes a quem não tem acesso
      const m = ['token', 'repo', 'permissao'].includes(e.tipo) || e.status === 404 || e.status === 401
        ? 'Chave de acesso inválida ou sem permissão.'
        : (e.tipo === 'rede' ? 'Sem conexão com a internet.' : 'Não foi possível entrar. Tente de novo.');
      if (doFormulario) erroSetup(m);
      else mostrar(m);
    }
  }

  function primeiroAcesso(eu) {
    $('#telaSetup').innerHTML = `
    <div class="setup-box">
      <h2>Primeiro acesso</h2>
      <p>Ainda não há nada salvo. Clique abaixo para começar.</p>
      <div class="btn-row"><button class="btn primary" id="criarVazio">Começar</button></div>
      <div class="msg bad" id="msgSetup" hidden></div>
    </div>`;
    $('#criarVazio').onclick = async e => {
      const botao = e.target; botao.disabled = true; botao.textContent = 'Criando…';
      try {
        const dados = { versao: 1, pessoas: { [eu.login]: { nome: eu.nome } }, receitas: [], gastos: [], projetos: [], pendencias: [], notas: [], atualizadoEm: new Date().toISOString() };
        await CE.github.gravar(dados, null, `Início (por ${eu.nome})`);
        const remoto = await CE.github.ler();
        await CE.store.iniciar(eu, remoto);
        CE.app.abrir();
      } catch (err) { erroSetup('Não foi possível criar. Tente de novo.'); botao.disabled = false; }
    };
  }

  return {
    mostrar,
    async iniciar() {
      const token = lerToken();
      if (token) {
        $('#telaSetup').hidden = false;
        $('#telaSetup').innerHTML = '<div class="setup-box"><p>Entrando…</p></div>';
        await conectar(conexao(token), false);
      } else mostrar();
    },
    esquecerToken: apagarToken,
    apagarConexao: apagarToken
  };
})();
