/**
 * LOJA VIRTUAL SEGURA - app.js
 * 
 * Sistema completo de e-commerce com:
 * - Autenticação de usuários e admin
 * - Gestão de produtos e produtores
 * - Carrinho de compras funcional
 * - Simulação de pagamento (Stripe/Mercado Pago)
 * - Validação e sanitização de inputs contra XSS
 * - Armazenamento seguro em localStorage
 * 
 * IMPORTANTE (Backend):
 * Em produção, as seguintes operações DEVEM ser implementadas no backend seguro:
 * 1. Autenticação real com hashing de senha (bcrypt, Argon2)
 * 2. Validação de permissões em servidor
 * 3. Integração real com APIs de pagamento (Stripe, Mercado Pago)
 * 4. Verificação de estoque em transação
 * 5. Auditoria e logs de segurança
 */

// ========================================
// CONFIGURAÇÕES E INICIALIZAÇÃO
// ========================================

// Chave de armazenamento seguro
const STORAGE_KEY = 'lojaSeguraDados';
const PAGAMENTO_CONFIG_KEY = 'lojaPagamentoConfig';

// Estado global da aplicação
let appState = {
    usuarioLogado: null,
    carrinho: [],
    produtores: [],
    usuarios: [],
    pedidos: [],
    admin: null,
    configPagamento: {}
};

// ========================================
// UTILITÁRIOS DE SEGURANÇA
// ========================================

/**
 * Sanitiza string para evitar XSS
 * Remove tags HTML e caracteres perigosos
 */
function sanitizar(str) {
    if (typeof str !== 'string') return '';
    // Remove tags HTML
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Valida email com regex seguro
 */
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Valida senha (mínimo 6 caracteres)
 */
function validarSenha(senha) {
    return typeof senha === 'string' && senha.length >= 6;
}

/**
 * Hash simples de senha (NÃO USAR EM PRODUÇÃO!)
 * Em produção, usar bcrypt ou Argon2 no backend
 */
function hashSenhaSimples(senha) {
    // Apenas uma demonstração - em produção usar backend com bcrypt
    let hash = 0;
    for (let i = 0; i < senha.length; i++) {
        const char = senha.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Converter para 32-bit integer
    }
    return 'hash_' + Math.abs(hash).toString(36);
}

/**
 * Valida dados de compra
 */
function validarDadosCompra(dados) {
    const requiredFields = ['nome', 'email', 'telefone', 'endereco', 'cidade', 'cep', 'cartao', 'validade', 'cvv'];
    for (let field of requiredFields) {
        if (!dados[field] || dados[field].trim() === '') {
            return { valido: false, erro: `Campo ${field} obrigatório` };
        }
    }
    if (!validarEmail(dados.email)) {
        return { valido: false, erro: 'Email inválido' };
    }
    if (!/^\d{16}$/.test(dados.cartao.replace(/\s/g, ''))) {
        return { valido: false, erro: 'Número de cartão inválido (16 dígitos)' };
    }
    if (!/^\d{2}\/\d{2}$/.test(dados.validade)) {
        return { valido: false, erro: 'Validade inválida (MM/AA)' };
    }
    if (!/^\d{3}$/.test(dados.cvv)) {
        return { valido: false, erro: 'CVV inválido (3 dígitos)' };
    }
    return { valido: true };
}

/**
 * Carrega dados do localStorage com validação
 */
function carregarDados() {
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        if (dados) {
            const parsed = JSON.parse(dados);
            // Validação básica de estrutura
            if (parsed.usuarios && Array.isArray(parsed.usuarios) &&
                parsed.produtores && Array.isArray(parsed.produtores) &&
                parsed.pedidos && Array.isArray(parsed.pedidos)) {
                appState = parsed;
                return;
            }
        }
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
    }
    // Se falhar, usar dados padrão
    inicializarDadosParaao();
}

/**
 * Salva dados no localStorage
 */
function salvarDados() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
        mostrarMensagem('Erro ao salvar dados', 'error');
    }
}

/**
 * Carrega configurações de pagamento
 */
function carregarConfigPagamento() {
    try {
        const config = localStorage.getItem(PAGAMENTO_CONFIG_KEY);
        if (config) {
            appState.configPagamento = JSON.parse(config);
        } else {
            appState.configPagamento = {
                provedor: 'stripe',
                stripePublicKey: 'pk_demo_12345',
                mercadoPagoPublicKey: 'APP_USER_ID_DEMO'
            };
        }
    } catch (e) {
        console.error('Erro ao carregar configurações:', e);
    }
}

// ========================================
// INICIALIZAÇÃO COM DADOS DE EXEMPLO
// ========================================

function inicializarDadosParaao() {
    // Admin padrão (DEMO - em produção usar backend)
    const admin = {
        id: 'admin_001',
        nome: 'Administrador',
        email: 'admin@loja.com',
        senhaHash: hashSenhaSimples('admin123'),
        role: 'admin'
    };

    // Usuários de exemplo
    const usuariosDemo = [
        {
            id: 'user_001',
            nome: 'João Silva',
            email: 'joao@example.com',
            senhaHash: hashSenhaSimples('senha123'),
            role: 'user',
            pedidos: []
        },
        {
            id: 'user_002',
            nome: 'Maria Santos',
            email: 'maria@example.com',
            senhaHash: hashSenhaSimples('senha456'),
            role: 'user',
            pedidos: []
        }
    ];

    // Produtores de exemplo
    const produtoresDemo = [
        {
            id: 'produtor_001',
            nome: 'Fazenda Orgânica Verde',
            email: 'contato@fazendaverde.com',
            listaDeItens: [
                {
                    id: 'item_001',
                    nome: 'Maçã Orgânica',
                    descricao: 'Maçã vermelha fresca, colheita do mês',
                    preco: 12.50,
                    produtorId: 'produtor_001',
                    disponivel: true
                },
                {
                    id: 'item_002',
                    nome: 'Cenoura Orgânica',
                    descricao: 'Cenoura doce e crocante',
                    preco: 8.00,
                    produtorId: 'produtor_001',
                    disponivel: true
                }
            ]
        },
        {
            id: 'produtor_002',
            nome: 'Laticínios Naturais',
            email: 'vendas@lacticinionaturais.com',
            listaDeItens: [
                {
                    id: 'item_003',
                    nome: 'Queijo Meia Cura',
                    descricao: 'Queijo artesanal, 500g',
                    preco: 35.00,
                    produtorId: 'produtor_002',
                    disponivel: true
                },
                {
                    id: 'item_004',
                    nome: 'Leite Integral',
                    descricao: 'Leite fresco, 1 litro',
                    preco: 6.50,
                    produtorId: 'produtor_002',
                    disponivel: true
                }
            ]
        },
        {
            id: 'produtor_003',
            nome: 'Café Artesanal',
            email: 'cafe@artesanal.com',
            listaDeItens: [
                {
                    id: 'item_005',
                    nome: 'Café Expresso',
                    descricao: 'Café 100% arábica, 250g',
                    preco: 28.00,
                    produtorId: 'produtor_003',
                    disponivel: true
                }
            ]
        }
    ];

    appState = {
        usuarioLogado: null,
        carrinho: [],
        produtores: produtoresDemo,
        usuarios: usuariosDemo,
        pedidos: [],
        admin: admin,
        configPagamento: {
            provedor: 'stripe',
            stripePublicKey: 'pk_demo_12345',
            mercadoPagoPublicKey: 'APP_USER_ID_DEMO'
        }
    };

    salvarDados();
}

// ========================================
// AUTENTICAÇÃO DE USUÁRIO
// ========================================

function handleLoginForm(e) {
    e.preventDefault();
    const email = sanitizar(document.getElementById('loginEmail').value);
    const senha = document.getElementById('loginPassword').value;
    const msgEl = document.getElementById('loginMsg');

    if (!validarEmail(email)) {
        mostrarMensagem('Email inválido', 'error', msgEl);
        return;
    }

    const usuario = appState.usuarios.find(u => u.email === email);
    if (!usuario) {
        mostrarMensagem('Usuário não encontrado', 'error', msgEl);
        return;
    }

    // Comparar hash (simulado)
    if (usuario.senhaHash !== hashSenhaSimples(senha)) {
        mostrarMensagem('Senha incorreta', 'error', msgEl);
        return;
    }

    appState.usuarioLogado = usuario;
    salvarDados();
    mostrarMensagem('Login realizado com sucesso!', 'success', msgEl);
    atualizarUI();
    fecharLoginModal();
    setTimeout(() => msgEl.textContent = '', 3000);
}

function handleRegistroForm(e) {
    e.preventDefault();
    const nome = sanitizar(document.getElementById('registroNome').value);
    const email = sanitizar(document.getElementById('registroEmail').value);
    const senha = document.getElementById('registroSenha').value;
    const confirmar = document.getElementById('registroConfirm').value;
    const msgEl = document.getElementById('registroMsg');

    if (!nome || nome.length < 3) {
        mostrarMensagem('Nome deve ter pelo menos 3 caracteres', 'error', msgEl);
        return;
    }
    if (!validarEmail(email)) {
        mostrarMensagem('Email inválido', 'error', msgEl);
        return;
    }
    if (!validarSenha(senha)) {
        mostrarMensagem('Senha deve ter pelo menos 6 caracteres', 'error', msgEl);
        return;
    }
    if (senha !== confirmar) {
        mostrarMensagem('Senhas não coincidem', 'error', msgEl);
        return;
    }

    if (appState.usuarios.some(u => u.email === email)) {
        mostrarMensagem('Email já registrado', 'error', msgEl);
        return;
    }

    // Criar novo usuário
    const novoUsuario = {
        id: 'user_' + Date.now(),
        nome,
        email,
        senhaHash: hashSenhaSimples(senha),
        role: 'user',
        pedidos: []
    };

    appState.usuarios.push(novoUsuario);
    appState.usuarioLogado = novoUsuario;
    salvarDados();
    mostrarMensagem('Cadastro realizado com sucesso!', 'success', msgEl);
    document.getElementById('registroForm').reset();
    atualizarUI();
    fecharLoginModal();
    setTimeout(() => msgEl.textContent = '', 3000);
}

function handleLoginAdminForm(e) {
    e.preventDefault();
    const email = sanitizar(document.getElementById('loginAdminEmail').value);
    const senha = document.getElementById('loginAdminPassword').value;
    const msgEl = document.getElementById('loginAdminMsg');

    if (!validarEmail(email)) {
        mostrarMensagem('Email inválido', 'error', msgEl);
        return;
    }

    if (appState.admin.email !== email) {
        mostrarMensagem('Admin não encontrado', 'error', msgEl);
        return;
    }

    if (appState.admin.senhaHash !== hashSenhaSimples(senha)) {
        mostrarMensagem('Senha incorreta', 'error', msgEl);
        return;
    }

    appState.usuarioLogado = appState.admin;
    salvarDados();
    mostrarMensagem('Login admin realizado com sucesso!', 'success', msgEl);
    atualizarUI();
    fecharLoginModal();
    setTimeout(() => msgEl.textContent = '', 3000);
}

function handleLogout() {
    appState.usuarioLogado = null;
    appState.carrinho = [];
    salvarDados();
    atualizarUI();
    mostrarSecao('loja');
}

// ========================================
// MODAL DE LOGIN UNIFICADO
// ========================================

/**
 * Abre o modal de login e exibe a aba especificada
 */
function abrirLoginModal(aba = 'login') {
    const modal = document.getElementById('loginModal');
    const tabs = document.querySelectorAll('.login-tab-btn');
    const contents = document.querySelectorAll('.login-tab-content');

    // Resetar todas as abas
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    // Ativar aba específica
    const abaMapeada = aba === 'registro' ? 'registro' : aba === 'admin' ? 'admin' : 'login';
    document.querySelector(`[data-tab="${abaMapeada}"]`).classList.add('active');
    document.getElementById(abaMapeada === 'login' ? 'loginTab' : abaMapeada === 'registro' ? 'registroTab' : 'adminTab').classList.add('active');

    // Limpar mensagens anteriores
    document.getElementById('loginMsg').textContent = '';
    document.getElementById('registroMsg').textContent = '';
    document.getElementById('loginAdminMsg').textContent = '';

    // Mostrar modal
    modal.style.display = 'flex';
}

/**
 * Fecha o modal de login
 */
function fecharLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

/**
 * Event listeners para abas do login modal
 */
function inicializarTabasLogin() {
    const tabBtns = document.querySelectorAll('.login-tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const abaAlvo = btn.dataset.tab;

            // Remover ativo de todos os botões e conteúdos
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.login-tab-content').forEach(c => c.classList.remove('active'));

            // Ativar selecionado
            btn.classList.add('active');
            document.getElementById(abaAlvo + 'Tab').classList.add('active');
        });
    });

    // Fechar modal ao clicar fora
    document.getElementById('loginModal').addEventListener('click', (e) => {
        if (e.target.id === 'loginModal') {
            fecharLoginModal();
        }
    });
}

// ========================================
// VERIFICAÇÃO DE PERMISSÕES
// ========================================

function usuarioAtualEhAdmin() {
    return appState.usuarioLogado && appState.usuarioLogado.role === 'admin';
}

function usuarioEstaLogado() {
    return appState.usuarioLogado !== null;
}

// ========================================
// GESTÃO DE CARRINHO
// ========================================

function adicionarAoCarrinho(itemId) {
    // Verificar se usuário está logado
    if (!usuarioEstaLogado()) {
        mostrarMensagem('Você precisa estar logado para adicionar itens', 'warning', 
            document.getElementById('carrinhoMsg'));
        return;
    }

    // Buscar item nos produtores
    let itemEncontrado = null;
    for (let produtor of appState.produtores) {
        const item = produtor.listaDeItens.find(i => i.id === itemId);
        if (item && item.disponivel) {
            itemEncontrado = { ...item, produtorNome: produtor.nome };
            break;
        }
    }

    if (!itemEncontrado) {
        mostrarMensagem('Item não disponível', 'error');
        return;
    }

    // Verificar se já está no carrinho
    const itemNoCarrinho = appState.carrinho.find(c => c.id === itemId);
    if (itemNoCarrinho) {
        mostrarMensagem('Item já está no carrinho', 'warning');
        return;
    }

    appState.carrinho.push(itemEncontrado);
    atualizarCarrinho();
    mostrarMensagem('Produto adicionado ao carrinho!', 'success');
}

function removerDoCarrinho(itemId) {
    appState.carrinho = appState.carrinho.filter(item => item.id !== itemId);
    atualizarCarrinho();
}

function calcularTotalCarrinho() {
    return appState.carrinho.reduce((total, item) => total + item.preco, 0);
}

function atualizarCarrinho() {
    const container = document.getElementById('carrinhoItems');
    const totalEl = document.getElementById('totalCarrinho');
    const finalizarBtn = document.getElementById('finalizarCompraBtn');

    if (appState.carrinho.length === 0) {
        container.innerHTML = '<p>Carrinho vazio</p>';
        finalizarBtn.style.display = 'none';
        totalEl.textContent = '0.00';
        return;
    }

    let html = '';
    appState.carrinho.forEach(item => {
        html += `
            <div class="carrinho-item">
                <div class="carrinho-item-info">
                    <div class="carrinho-item-nome">${sanitizar(item.nome)}</div>
                    <div class="carrinho-item-preco">R$ ${item.preco.toFixed(2)}</div>
                </div>
                <button class="carrinho-item-remover" onclick="removerDoCarrinho('${sanitizar(item.id)}')">
                    Remover
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    const total = calcularTotalCarrinho();
    totalEl.textContent = total.toFixed(2);
    finalizarBtn.style.display = 'block';
}

// ========================================
// CARRINHO - FINALIZAR COMPRA
// ========================================

function abrirCheckout() {
    if (appState.carrinho.length === 0) {
        mostrarMensagem('Carrinho vazio', 'warning');
        return;
    }

    const modal = document.getElementById('checkoutModal');
    const totalEl = document.getElementById('checkoutTotal');
    const provedorEl = document.getElementById('checkoutProvedor');

    totalEl.textContent = calcularTotalCarrinho().toFixed(2);
    provedorEl.textContent = `Provedor: ${appState.configPagamento.provedor === 'stripe' ? 'Stripe' : 'Mercado Pago'}`;

    // Pré-preencher dados do usuário
    if (usuarioEstaLogado()) {
        document.getElementById('checkoutNome').value = appState.usuarioLogado.nome;
        document.getElementById('checkoutEmail').value = appState.usuarioLogado.email;
    }

    modal.style.display = 'flex';
}

function fecharCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
}

function handleCheckoutForm(e) {
    e.preventDefault();

    const dados = {
        nome: sanitizar(document.getElementById('checkoutNome').value),
        email: sanitizar(document.getElementById('checkoutEmail').value),
        telefone: sanitizar(document.getElementById('checkoutTelefone').value),
        endereco: sanitizar(document.getElementById('checkoutEndereco').value),
        cidade: sanitizar(document.getElementById('checkoutCidade').value),
        cep: sanitizar(document.getElementById('checkoutCep').value),
        cartao: document.getElementById('checkoutCartao').value.replace(/\D/g, ''),
        validade: document.getElementById('checkoutValidade').value,
        cvv: document.getElementById('checkoutCvv').value
    };

    // Validar dados
    const validacao = validarDadosCompra(dados);
    if (!validacao.valido) {
        mostrarMensagem(validacao.erro, 'error', document.getElementById('checkoutMsg'));
        return;
    }

    // Simular pagamento
    processarPagamento(dados);
}

/**
 * Simula processamento de pagamento
 * Em produção, seria integrado com Stripe/Mercado Pago via backend seguro
 */
function processarPagamento(dados) {
    const msgEl = document.getElementById('checkoutMsg');
    mostrarMensagem('Processando pagamento...', 'warning', msgEl);

    // Simular delay de processamento
    setTimeout(() => {
        // Simular sucesso/falha (85% sucesso para demo)
        const sucesso = Math.random() < 0.85;

        if (sucesso) {
            // Simular integração com provedor configurado
            if (appState.configPagamento.provedor === 'stripe') {
                criarPagamentoStripe(dados);
            } else {
                criarPagamentoMercadoPago(dados);
            }

            // Finalize a compra
            finalizarCompraComSucesso(dados);
        } else {
            mostrarMensagem('Pagamento recusado. Tente novamente.', 'error', msgEl);
        }
    }, 1500);
}

/**
 * Simula integração com Stripe
 * Em produção: POST request ao backend -> Stripe API
 */
function criarPagamentoStripe(dados) {
    console.log('Integrando com Stripe...', {
        publicKey: appState.configPagamento.stripePublicKey,
        cartao: dados.cartao.slice(-4),
        email: dados.email
    });

    // Simulação: em produção, o backend chamaria Stripe.com/api/v1/charges
    // com a chave secreta (NUNCA enviar chave secreta para frontend)
    
    return {
        sucesso: true,
        transacaoId: 'ch_stripe_' + Date.now(),
        provedor: 'stripe'
    };
}

/**
 * Simula integração com Mercado Pago
 * Em produção: POST request ao backend -> Mercado Pago API
 */
function criarPagamentoMercadoPago(dados) {
    console.log('Integrando com Mercado Pago...', {
        publicKey: appState.configPagamento.mercadoPagoPublicKey,
        email: dados.email
    });

    // Simulação: em produção, o backend chamaria api.mercadopago.com/v1/payments
    // com a chave secreta
    
    return {
        sucesso: true,
        transacaoId: 'mp_' + Date.now(),
        provedor: 'mercadoPago'
    };
}

/**
 * Finaliza compra após pagamento aprovado
 * Remove itens do estoque dos produtores
 */
function finalizarCompraComSucesso(dados) {
    const msgEl = document.getElementById('checkoutMsg');

    // Criar pedido
    const novoPedido = {
        id: 'pedido_' + Date.now(),
        usuarioId: appState.usuarioLogado.id,
        usuarioNome: dados.nome,
        usuarioEmail: dados.email,
        itens: [...appState.carrinho],
        total: calcularTotalCarrinho(),
        data: new Date().toISOString(),
        status: 'confirmado',
        endereco: dados.endereco,
        cidade: dados.cidade
    };

    // Atualizar estoque: remover itens disponíveis
    for (let item of novoPedido.itens) {
        const produtor = appState.produtores.find(p => p.id === item.produtorId);
        if (produtor) {
            const itemEstoque = produtor.listaDeItens.find(i => i.id === item.id);
            if (itemEstoque) {
                // Marcar como indisponível para impedir venda dupla
                itemEstoque.disponivel = false;
            }
        }
    }

    // Adicionar pedido ao histórico
    appState.pedidos.push(novoPedido);

    // Adicionar pedido ao usuário
    if (appState.usuarioLogado.role === 'user') {
        appState.usuarioLogado.pedidos = appState.usuarioLogado.pedidos || [];
        appState.usuarioLogado.pedidos.push(novoPedido.id);
    }

    // Limpar carrinho
    appState.carrinho = [];
    salvarDados();

    // Feedback
    mostrarMensagem(
        `Compra realizada com sucesso! Pedido: ${novoPedido.id}`,
        'success',
        msgEl
    );

    setTimeout(() => {
        fecharCheckout();
        atualizarUI();
        renderizarProdutos();
    }, 2000);
}

// ========================================
// PAINEL ADMIN - PRODUTORES
// ========================================

function handleNovoProductorForm(e) {
    e.preventDefault();

    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    const nome = sanitizar(document.getElementById('novoProductorNome').value);
    const email = sanitizar(document.getElementById('novoProductorEmail').value);
    const msgEl = document.getElementById('novoProductorMsg');

    if (!nome || nome.length < 3) {
        mostrarMensagem('Nome inválido', 'error', msgEl);
        return;
    }
    if (!validarEmail(email)) {
        mostrarMensagem('Email inválido', 'error', msgEl);
        return;
    }

    if (appState.produtores.some(p => p.email === email)) {
        mostrarMensagem('Email já cadastrado', 'error', msgEl);
        return;
    }

    const novoProdutor = {
        id: 'produtor_' + Date.now(),
        nome,
        email,
        listaDeItens: []
    };

    appState.produtores.push(novoProdutor);
    salvarDados();
    mostrarMensagem('Produtor cadastrado com sucesso!', 'success', msgEl);
    document.getElementById('novoProductorForm').reset();
    renderizarProdutores();

    setTimeout(() => msgEl.textContent = '', 3000);
}

function abrirModalNovoItem(produtorId) {
    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    document.getElementById('novoItemProductorId').value = produtorId;
    document.getElementById('novoItemModal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('novoItemModal').style.display = 'none';
    document.getElementById('novoItemForm').reset();
}

function handleNovoItemForm(e) {
    e.preventDefault();

    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    const produtorId = document.getElementById('novoItemProductorId').value;
    const nome = sanitizar(document.getElementById('novoItemNome').value);
    const descricao = sanitizar(document.getElementById('novoItemDescricao').value);
    const preco = parseFloat(document.getElementById('novoItemPreco').value);
    const msgEl = document.getElementById('novoItemMsg');

    if (!nome || !descricao) {
        mostrarMensagem('Preencha todos os campos', 'error', msgEl);
        return;
    }
    if (preco <= 0) {
        mostrarMensagem('Preço deve ser maior que zero', 'error', msgEl);
        return;
    }

    const produtor = appState.produtores.find(p => p.id === produtorId);
    if (!produtor) {
        mostrarMensagem('Produtor não encontrado', 'error', msgEl);
        return;
    }

    const novoItem = {
        id: 'item_' + Date.now(),
        nome,
        descricao,
        preco,
        produtorId,
        disponivel: true
    };

    produtor.listaDeItens.push(novoItem);
    salvarDados();
    mostrarMensagem('Item adicionado com sucesso!', 'success', msgEl);
    fecharModal();
    renderizarProdutos();
    renderizarProdutores();

    setTimeout(() => msgEl.textContent = '', 3000);
}

function removerProdutor(produtorId) {
    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    if (confirm('Tem certeza? Isso removerá todos os itens associados.')) {
        appState.produtores = appState.produtores.filter(p => p.id !== produtorId);
        salvarDados();
        renderizarProdutores();
        renderizarProdutos();
    }
}

function removerItemProdutor(produtorId, itemId) {
    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    const produtor = appState.produtores.find(p => p.id === produtorId);
    if (produtor) {
        produtor.listaDeItens = produtor.listaDeItens.filter(i => i.id !== itemId);
        salvarDados();
        renderizarProdutores();
        renderizarProdutos();
    }
}

// ========================================
// RENDERIZAÇÃO DE UI - PRODUTOS
// ========================================

function renderizarProdutos() {
    const container = document.getElementById('produtosList');

    // Coletar todos os itens disponíveis de todos os produtores
    let todosItens = [];
    for (let produtor of appState.produtores) {
        for (let item of produtor.listaDeItens) {
            if (item.disponivel) {
                todosItens.push({
                    ...item,
                    produtorNome: produtor.nome
                });
            }
        }
    }

    if (todosItens.length === 0) {
        container.innerHTML = '<p>Nenhum produto disponível no momento.</p>';
        return;
    }

    let html = '';
    todosItens.forEach(item => {
        html += `
            <div class="produto-card">
                <h3>${sanitizar(item.nome)}</h3>
                <p>${sanitizar(item.descricao)}</p>
                <div class="produto-produtor">Por: ${sanitizar(item.produtorNome)}</div>
                <div class="produto-preco">R$ ${item.preco.toFixed(2)}</div>
                <button class="btn btn-primary" onclick="adicionarAoCarrinho('${sanitizar(item.id)}')">
                    Adicionar ao Carrinho
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========================================
// RENDERIZAÇÃO DE UI - PRODUTORES (ADMIN)
// ========================================

function renderizarProdutores() {
    if (!usuarioAtualEhAdmin()) return;

    const container = document.getElementById('produtoresList');

    if (appState.produtores.length === 0) {
        container.innerHTML = '<p>Nenhum produtor cadastrado.</p>';
        return;
    }

    let html = '';
    appState.produtores.forEach(produtor => {
        html += `
            <div class="produtor-card">
                <h3>${sanitizar(produtor.nome)}</h3>
                <div class="produtor-email">${sanitizar(produtor.email)}</div>

                <div class="produtor-itens">
                    <strong>Itens no estoque (${produtor.listaDeItens.length}):</strong>
        `;

        if (produtor.listaDeItens.length === 0) {
            html += '<p>Nenhum item cadastrado</p>';
        } else {
            produtor.listaDeItens.forEach(item => {
                const statusDisp = item.disponivel ? '✓ Disponível' : '✗ Vendido';
                html += `
                    <div class="produtor-item">
                        <div class="produtor-item-info">
                            <strong>${sanitizar(item.nome)}</strong><br>
                            ${sanitizar(item.descricao)}<br>
                            <span class="produtor-item-preco">R$ ${item.preco.toFixed(2)}</span>
                            <span class="produtor-item-status">${statusDisp}</span>
                        </div>
                        <button class="btn btn-danger btn-small" 
                            onclick="removerItemProdutor('${sanitizar(produtor.id)}', '${sanitizar(item.id)}')">
                            Remover
                        </button>
                    </div>
                `;
            });
        }

        html += `
                </div>
                <button class="btn btn-primary" onclick="abrirModalNovoItem('${sanitizar(produtor.id)}')">
                    + Adicionar Item
                </button>
                <button class="btn btn-danger" onclick="removerProdutor('${sanitizar(produtor.id)}')">
                    Remover Produtor
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========================================
// RENDERIZAÇÃO - PEDIDOS
// ========================================

function renderizarPedidos() {
    let container;
    let pedidosParaMostrar = [];

    if (usuarioAtualEhAdmin()) {
        // Admin vê todos os pedidos
        container = document.getElementById('pedidosAdminList');
        pedidosParaMostrar = appState.pedidos;
    } else if (usuarioEstaLogado() && appState.usuarioLogado.role === 'user') {
        // Usuário vê apenas seus pedidos
        container = document.getElementById('meusPedidosList');
        const meusIds = appState.usuarioLogado.pedidos || [];
        pedidosParaMostrar = appState.pedidos.filter(p => meusIds.includes(p.id));
    }

    if (!container) return;

    if (pedidosParaMostrar.length === 0) {
        container.innerHTML = '<p>Nenhum pedido encontrado.</p>';
        return;
    }

    let html = '';
    pedidosParaMostrar.forEach(pedido => {
        let itensHtml = '';
        pedido.itens.forEach(item => {
            itensHtml += `
                <div class="pedido-item">
                    ${sanitizar(item.nome)} - R$ ${item.preco.toFixed(2)}
                </div>
            `;
        });

        html += `
            <div class="pedido-card">
                <div class="pedido-header">
                    <div>
                        <div class="pedido-id">Pedido: ${sanitizar(pedido.id)}</div>
                        <div style="color: #d1d5db; font-size: 0.9rem;">
                            ${new Date(pedido.data).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                    <div class="pedido-status">${pedido.status}</div>
                </div>
                <div class="pedido-itens">
                    ${itensHtml}
                </div>
                <div class="pedido-total">Total: R$ ${pedido.total.toFixed(2)}</div>
                <div style="color: #9ca3af; font-size: 0.85rem; margin-top: 0.5rem;">
                    ${sanitizar(pedido.usuarioNome)} | ${sanitizar(pedido.endereco)}, ${sanitizar(pedido.cidade)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========================================
// CONFIGURAÇÕES DE PAGAMENTO
// ========================================

function handleConfigPagamentoForm(e) {
    e.preventDefault();

    if (!usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado', 'error');
        return;
    }

    const provedor = document.getElementById('provedorPagamento').value;
    const stripeKey = sanitizar(document.getElementById('stripePublicKey').value);
    const mpKey = sanitizar(document.getElementById('mercadoPagoPublicKey').value);
    const msgEl = document.getElementById('configPagamentoMsg');

    // Validação básica
    if (!provedor) {
        mostrarMensagem('Selecione um provedor', 'error', msgEl);
        return;
    }

    // Salvar configurações
    appState.configPagamento = {
        provedor,
        stripePublicKey: stripeKey || appState.configPagamento.stripePublicKey,
        mercadoPagoPublicKey: mpKey || appState.configPagamento.mercadoPagoPublicKey
    };

    try {
        localStorage.setItem(PAGAMENTO_CONFIG_KEY, JSON.stringify(appState.configPagamento));
        mostrarMensagem('Configurações salvas com sucesso!', 'success', msgEl);
        setTimeout(() => msgEl.textContent = '', 3000);
    } catch (e) {
        mostrarMensagem('Erro ao salvar configurações', 'error', msgEl);
    }
}

// ========================================
// NAVEGAÇÃO E SEÇÕES
// ========================================

function mostrarSecao(secao) {
    // Ocultar todas as seções
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Proteger acesso ao admin
    if (secao === 'admin' && !usuarioAtualEhAdmin()) {
        mostrarMensagem('Acesso negado: apenas administradores', 'error');
        mostrarSecao('loja');
        return;
    }

    // Mostrar seção
    const sectionEl = document.getElementById(secao + 'Section');
    if (sectionEl) {
        sectionEl.classList.add('active');
    }

    // Ativar botão de navegação
    document.querySelector(`[data-section="${secao}"]`)?.classList.add('active');
}

function atualizarUI() {
    const userDisplay = document.getElementById('userDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLinks = document.querySelectorAll('.admin-only');
    const meusPedidosBox = document.getElementById('meusPedidosBox');
    const loginButtonsContainer = document.getElementById('loginButtonsContainer');
    const finalizarBtn = document.getElementById('finalizarCompraBtn');

    if (usuarioEstaLogado()) {
        userDisplay.textContent = `${appState.usuarioLogado.nome} (${appState.usuarioLogado.role})`;
        logoutBtn.style.display = 'inline-block';

        if (usuarioAtualEhAdmin()) {
            adminLinks.forEach(link => link.style.display = 'block');
        } else {
            adminLinks.forEach(link => link.style.display = 'none');
            if (meusPedidosBox) meusPedidosBox.style.display = 'block';
        }

        finalizarBtn.style.display = 'block';
        if (loginButtonsContainer) loginButtonsContainer.style.display = 'none';
    } else {
        userDisplay.textContent = 'Não autenticado';
        logoutBtn.style.display = 'none';
        adminLinks.forEach(link => link.style.display = 'none');
        if (meusPedidosBox) meusPedidosBox.style.display = 'none';
        finalizarBtn.style.display = 'none';
        if (loginButtonsContainer) loginButtonsContainer.style.display = 'grid';
        appState.carrinho = [];
        atualizarCarrinho();
    }
}

function mostrarMensagem(texto, tipo, elementoMsg = null) {
    if (!elementoMsg) {
        const div = document.createElement('div');
        div.className = `msg ${tipo}`;
        div.textContent = texto;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    } else {
        elementoMsg.textContent = texto;
        elementoMsg.className = `msg ${tipo}`;
    }
}

// ========================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar dados
    carregarDados();
    carregarConfigPagamento();

    // Atualizar UI
    atualizarUI();
    renderizarProdutos();
    if (usuarioAtualEhAdmin()) {
        renderizarProdutores();
        renderizarPedidos();
    }

    // Navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            mostrarSecao(btn.dataset.section);
        });
    });

    // Tabs de admin
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
            renderizarPedidos();
        });
    });

    // Formulários
    document.getElementById('loginForm').addEventListener('submit', handleLoginForm);
    document.getElementById('registroForm').addEventListener('submit', handleRegistroForm);
    document.getElementById('loginAdminForm').addEventListener('submit', handleLoginAdminForm);
    document.getElementById('novoProductorForm').addEventListener('submit', handleNovoProductorForm);
    document.getElementById('novoItemForm').addEventListener('submit', handleNovoItemForm);
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutForm);
    document.getElementById('configPagamentoForm').addEventListener('submit', handleConfigPagamentoForm);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Carrinho
    document.getElementById('finalizarCompraBtn').addEventListener('click', abrirCheckout);

    // Inicializar modal de login
    inicializarTabasLogin();

    // Botões de acesso ao login (quando não logado)
    const loginButtonsContainer = document.getElementById('loginButtonsContainer');
    if (loginButtonsContainer) {
        const botoesLogin = loginButtonsContainer.querySelectorAll('button');
        botoesLogin.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const texto = e.target.textContent;
                if (texto.includes('Usuário')) {
                    abrirLoginModal('login');
                } else if (texto.includes('Registrar')) {
                    abrirLoginModal('registro');
                } else if (texto.includes('Admin')) {
                    abrirLoginModal('admin');
                }
            });
        });
    }

    // Carregar configurações no painel
    document.getElementById('provedorPagamento').value = appState.configPagamento.provedor || 'stripe';
    document.getElementById('stripePublicKey').value = appState.configPagamento.stripePublicKey || '';
    document.getElementById('mercadoPagoPublicKey').value = appState.configPagamento.mercadoPagoPublicKey || '';
});

// ========================================
// NOTAS DE SEGURANÇA E PRÓXIMOS PASSOS
// ========================================

/*
 * IMPORTANTE - IMPLEMENTAR NO BACKEND:
 * 
 * 1. AUTENTICAÇÃO REAL:
 *    - Usar bcrypt/Argon2 para hash de senha
 *    - Implementar tokens JWT
 *    - Session management seguro
 *    - Rate limiting em tentativas de login
 * 
 * 2. VALIDAÇÃO:
 *    - Todas as validações devem ser refeitas no backend
 *    - Validação de permissões DEVE estar no servidor
 *    - Verificação de estoque em transação atômica
 * 
 * 3. PAGAMENTO:
 *    - Integrar com APIs reais de Stripe/Mercado Pago
 *    - NUNCA enviar dados de cartão via frontend
 *    - Usar tokenização de pagamento (Stripe Elements, etc)
 *    - Implementar webhook para confirmação de pagamento
 * 
 * 4. DADOS SENSÍVEIS:
 *    - Nunca armazenar senhas em localStorage (mesmo hasheadas)
 *    - Usar HTTPS para todas as comunicações
 *    - Implementar CSRF tokens
 *    - Sanitização no servidor também
 * 
 * 5. LOGGING E AUDITORIA:
 *    - Log de todas as alterações de estoque
 *    - Registro de pedidos com timestamp servidor
 *    - Detecção de fraude
 *    - Auditoria de acessos admin
 * 
 * Este código é uma DEMONSTRAÇÃO educacional de conceitos de segurança.
 * Para produção, use frameworks web estabelecidos (Django, Rails, Express, etc)
 * com bibliotecas de segurança testadas.
 */
