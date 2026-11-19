/*
 * Comunicação com a API do GitHub.
 * Os dados ficam num único arquivo JSON dentro do repositório privado.
 * Cada gravação vira um commit.
 */
window.CE = window.CE || {};

CE.github = (() => {
  const API = 'https://api.github.com';
  let cfg = null; // { owner, repo, branch, arquivo, token }

  class ErroGitHub extends Error {
    constructor(msg, status, tipo) { super(msg); this.status = status; this.tipo = tipo; }
  }

  // Base64 que aceita acentos (UTF-8)
  function paraBase64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function deBase64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  async function req(caminho, opcoes = {}, accept = 'application/vnd.github+json') {
    let r;
    try {
      r = await fetch(API + caminho, {
        ...opcoes,
        cache: 'no-store',
        headers: {
          'Accept': accept,
          'Authorization': 'Bearer ' + cfg.token,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(opcoes.body ? { 'Content-Type': 'application/json' } : {})
        }
      });
    } catch (e) {
      throw new ErroGitHub('Sem conexão com o GitHub. Verifique a internet.', 0, 'rede');
    }
    if (r.status === 401) throw new ErroGitHub('Token inválido ou expirado. Conecte de novo com um token válido.', 401, 'token');
    if (r.status === 403 || r.status === 429) {
      const resto = r.headers.get('x-ratelimit-remaining');
      if (resto === '0') throw new ErroGitHub('Limite de uso da API do GitHub atingido. Tente de novo em alguns minutos.', r.status, 'limite');
      throw new ErroGitHub('O token não tem permissão de escrita no repositório de dados.', r.status, 'permissao');
    }
    return r;
  }

  const urlArquivo = () => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.arquivo.split('/').map(encodeURIComponent).join('/')}`;

  return {
    ErroGitHub,
    configurar(c) { cfg = { ...c }; },
    get cfg() { return cfg; },

    /** Quem é o dono do token */
    async eu() {
      const r = await req('/user');
      if (!r.ok) throw new ErroGitHub('Não foi possível identificar o usuário do token.', r.status);
      const u = await r.json();
      return { login: u.login, nome: u.name || u.login };
    },

    /** Confere se o repositório existe e se o token enxerga ele */
    async checarRepo() {
      const r = await req(`/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`);
      if (r.status === 404) throw new ErroGitHub(`Repositório ${cfg.owner}/${cfg.repo} não encontrado, ou o token não tem acesso a ele.`, 404, 'repo');
      if (!r.ok) throw new ErroGitHub('Erro ao acessar o repositório.', r.status);
      const info = await r.json();
      return { privado: info.private, podeEscrever: !info.permissions || info.permissions.push !== false };
    },

    /** Lê o arquivo de dados. Retorna null se ele ainda não existe. */
    async ler() {
      const r = await req(`${urlArquivo()}?ref=${encodeURIComponent(cfg.branch)}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new ErroGitHub('Erro ao ler os dados no GitHub.', r.status);
      const j = await r.json();
      let texto;
      if (j.encoding === 'base64' && j.content) texto = deBase64(j.content);
      else {
        // Arquivos acima de 1 MB vêm sem conteúdo; busca a versão bruta
        const raw = await req(`${urlArquivo()}?ref=${encodeURIComponent(cfg.branch)}`, {}, 'application/vnd.github.raw+json');
        texto = await raw.text();
      }
      let dados;
      try { dados = JSON.parse(texto || '{}'); }
      catch (e) { throw new ErroGitHub('O arquivo de dados no GitHub está com formato inválido (JSON quebrado).', 0, 'json'); }
      return { sha: j.sha, dados };
    },

    /** Grava o arquivo. Lança erro tipo "conflito" se outra pessoa salvou antes. */
    async gravar(dados, sha, mensagem) {
      const corpo = {
        message: mensagem,
        content: paraBase64(JSON.stringify(dados, null, 2) + '\n'),
        branch: cfg.branch
      };
      if (sha) corpo.sha = sha;
      const r = await req(urlArquivo(), { method: 'PUT', body: JSON.stringify(corpo) });
      if (r.status === 409 || (r.status === 422 && !sha)) throw new ErroGitHub('Conflito de versão.', r.status, 'conflito');
      if (r.status === 404) throw new ErroGitHub('Repositório ou branch não encontrado.', 404, 'repo');
      if (!r.ok) {
        let det = ''; try { det = (await r.json()).message || ''; } catch (e) {}
        throw new ErroGitHub('Erro ao salvar no GitHub. ' + det, r.status);
      }
      const j = await r.json();
      return j.content.sha;
    },

    linkHistorico() {
      return `https://github.com/${cfg.owner}/${cfg.repo}/commits/${cfg.branch}/${cfg.arquivo}`;
    }
  };
})();
