// ==================== APP STATE ====================
class AppState {
    constructor() {
        this.currentUser = null;
        this.loadUserData();
        this.loadPlanData();
    }

    loadUserData() {
        const stored = localStorage.getItem('users');
        this.users = stored ? JSON.parse(stored) : this.getDefaultUsers();
        
        const sessionUser = sessionStorage.getItem('currentUser');
        this.currentUser = sessionUser ? JSON.parse(sessionUser) : null;
    }

    getDefaultUsers() {
        return [
            {
                id: 1,
                username: 'admin',
                password: 'admin123',
                loginTime: 60,
                createdAt: new Date().toISOString(),
                isAdmin: true
            }
        ];
    }

    saveUsers() {
        localStorage.setItem('users', JSON.stringify(this.users));
    }

    loadPlanData() {
        const stored = localStorage.getItem('plans');
        this.plans = stored ? JSON.parse(stored) : this.getDefaultPlans();
    }

    getDefaultPlans() {
        return [
            { id: 1, name: 'Padrão 30 minutos', value: 30, unit: 'minutes' },
            { id: 2, name: 'Diário', value: 1, unit: 'days' },
            { id: 3, name: 'Semanal', value: 1, unit: 'weeks' },
            { id: 4, name: 'Mensal', value: 1, unit: 'months' }
        ];
    }

    savePlans() {
        localStorage.setItem('plans', JSON.stringify(this.plans));
    }

    setCurrentUser(user) {
        this.currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
    }
}

// ==================== APP CLASS ====================
class CentralApp {
    constructor() {
        this.state = new AppState();
        this.initEventListeners();
        this.checkAuthStatus();
    }

    initEventListeners() {
        // LOGIN FORM
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));

        // LOGOUT
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // SIDEBAR MENU
        document.querySelectorAll('.menu-item').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.closest('.menu-item')));
        });

        // CREATE USER FORM
        document.getElementById('createUserForm').addEventListener('submit', (e) => this.handleCreateUser(e));

        // PLANOS
        const createPlanForm = document.getElementById('createPlanForm');
        if (createPlanForm) createPlanForm.addEventListener('submit', (e) => this.handleCreatePlan(e));

        // SEARCH USERS
        document.getElementById('searchUsers').addEventListener('input', (e) => this.filterUsers(e.target.value));

        // SETTINGS
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());

        // MODAL
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelTimeBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveTimeBtn').addEventListener('click', () => this.saveLoginTime());
    }

    checkAuthStatus() {
        if (this.state.currentUser) {
            this.showAdminPage();
        } else {
            this.showLoginPage();
        }
    }

    showLoginPage() {
        document.getElementById('loginPage').classList.add('active');
        document.getElementById('adminPage').classList.remove('active');
    }

    showAdminPage() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('adminPage').classList.add('active');
        document.getElementById('currentUser').textContent = this.state.currentUser.username;
        this.loadUsersTable();
        this.updateSettings();
        this.populatePlanSelect();
        this.loadPlansTable();
        this.loadToolsManifest();
    }

    // ==================== LOGIN ====================
    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        errorDiv.classList.remove('show');

        const user = this.state.users.find(u => u.username === username && u.password === password);

        if (user && user.isAdmin) {
            this.state.setCurrentUser(user);
            document.getElementById('loginForm').reset();
            this.showAdminPage();
        } else {
            errorDiv.textContent = 'Usuário ou senha incorretos!';
            errorDiv.classList.add('show');
        }
    }

    handleLogout() {
        if (confirm('Tem certeza que deseja sair?')) {
            this.state.logout();
            this.showLoginPage();
            document.getElementById('loginForm').reset();
        }
    }

    // ==================== USER MANAGEMENT ====================
    handleCreateUser(e) {
        e.preventDefault();
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const selectedPlanId = document.getElementById('planSelect') ? document.getElementById('planSelect').value : 'custom';
        const customTime = parseInt(document.getElementById('newLoginTime').value) || 30;
        let loginTime = customTime;
        if (selectedPlanId && selectedPlanId !== 'custom') {
            const plan = this.state.plans.find(p => String(p.id) === String(selectedPlanId));
            if (plan) loginTime = this.convertPlanToMinutes(plan);
        }

        const errorDiv = document.getElementById('createError');
        const successDiv = document.getElementById('createSuccess');

        errorDiv.classList.remove('show');
        successDiv.classList.remove('show');

        if (username.length < 3) {
            errorDiv.textContent = 'Usuário deve ter pelo menos 3 caracteres!';
            errorDiv.classList.add('show');
            return;
        }

        if (password.length < 4) {
            errorDiv.textContent = 'Senha deve ter pelo menos 4 caracteres!';
            errorDiv.classList.add('show');
            return;
        }

        if (this.state.users.some(u => u.username === username)) {
            errorDiv.textContent = 'Este usuário já existe!';
            errorDiv.classList.add('show');
            return;
        }

        const newUser = {
            id: Date.now(),
            username,
            password,
            loginTime,
            createdAt: new Date().toISOString(),
            isAdmin: false
        };

        this.state.users.push(newUser);
        this.state.saveUsers();

        successDiv.textContent = `Usuário "${username}" criado com sucesso!`;
        successDiv.classList.add('show');

        document.getElementById('createUserForm').reset();
        document.getElementById('newLoginTime').value = '30';

        // repopular select caso tenha planos novos
        this.populatePlanSelect();

        setTimeout(() => {
            successDiv.classList.remove('show');
            this.loadUsersTable();
        }, 2000);
    }

    loadUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        const users = this.state.users.filter(u => !u.isAdmin);

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Nenhum usuário criado ainda</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${user.loginTime}</td>
                <td>${new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="button-small" onclick="app.editLoginTime('${user.username}', ${user.loginTime})">
                            ⏱️ Tempo
                        </button>
                        <button class="button-small delete" onclick="app.deleteUser('${user.username}')">
                            🗑️ Deletar
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    filterUsers(searchTerm) {
        const tbody = document.getElementById('usersTableBody');
        const rows = tbody.querySelectorAll('tr');

        rows.forEach(row => {
            const username = row.querySelector('td strong')?.textContent || '';
            if (username.toLowerCase().includes(searchTerm.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    editLoginTime(username, currentTime) {
        document.getElementById('editUsername').value = username;
        document.getElementById('editLoginTime').value = currentTime;
        
        const modal = document.getElementById('editTimeModal');
        modal.classList.add('active');

        // Guardar o username para usar no save
        modal.dataset.username = username;
    }

    saveLoginTime() {
        const modal = document.getElementById('editTimeModal');
        const username = modal.dataset.username;
        const newTime = parseInt(document.getElementById('editLoginTime').value);

        if (newTime < 1) {
            alert('O tempo deve ser maior que 0!');
            return;
        }

        const user = this.state.users.find(u => u.username === username);
        if (user) {
            user.loginTime = newTime;
            this.state.saveUsers();
            this.loadUsersTable();
            this.closeModal();
        }
    }

    deleteUser(username) {
        if (confirm(`Tem certeza que deseja deletar o usuário "${username}"?`)) {
            this.state.users = this.state.users.filter(u => u.username !== username);
            this.state.saveUsers();
            this.loadUsersTable();
        }
    }

    // ==================== TAB SWITCHING ====================
    switchTab(menuItem) {
        // Remove active de todos os menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });

        // Remove active de todos os tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Ativa o menu item clicado
        menuItem.classList.add('active');

        // Ativa o tab correspondente
        const tabName = menuItem.dataset.tab;
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }
    }

    // ==================== SETTINGS ====================
    updateSettings() {
        const nonAdminUsers = this.state.users.filter(u => !u.isAdmin);
        document.getElementById('totalUsers').textContent = nonAdminUsers.length;
        document.getElementById('activeUsers').textContent = nonAdminUsers.length;

        const dataSize = (new Blob([JSON.stringify(this.state.users)]).size / 1024).toFixed(2);
        document.getElementById('spaceUsed').textContent = `${dataSize} KB`;
    }

    // ==================== PLANOS ====================
    convertPlanToMinutes(plan) {
        const v = Number(plan.value) || 0;
        switch (plan.unit) {
            case 'minutes': return Math.max(1, Math.round(v));
            case 'hours': return Math.max(1, Math.round(v * 60));
            case 'days': return Math.max(1, Math.round(v * 24 * 60));
            case 'weeks': return Math.max(1, Math.round(v * 7 * 24 * 60));
            case 'months': return Math.max(1, Math.round(v * 30 * 24 * 60));
            default: return Math.max(1, Math.round(v));
        }
    }

    populatePlanSelect() {
        const select = document.getElementById('planSelect');
        if (!select) return;
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = 'custom';
        placeholder.textContent = '— Selecionar plano (ou usar custom) —';
        select.appendChild(placeholder);

        this.state.plans.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.value} ${p.unit})`;
            select.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Custom (minutos)';
        select.appendChild(customOpt);
    }

    handleCreatePlan(e) {
        e.preventDefault();
        const name = document.getElementById('planName').value.trim();
        const value = parseInt(document.getElementById('planValue').value) || 1;
        const unit = document.getElementById('planUnit').value;
        const msg = document.getElementById('planMsg');

        if (!name) {
            msg.textContent = 'Nome do plano é obrigatório';
            msg.classList.add('show');
            return;
        }

        const plan = { id: Date.now(), name, value, unit };
        this.state.plans.push(plan);
        this.state.savePlans();
        msg.textContent = `Plano "${name}" criado.`;
        msg.classList.add('show');
        document.getElementById('createPlanForm').reset();
        this.populatePlanSelect();
        this.loadPlansTable();
        setTimeout(() => msg.classList.remove('show'), 2000);
    }

    loadPlansTable() {
        const tbody = document.getElementById('plansTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!this.state.plans || this.state.plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999">Nenhum plano</td></tr>';
            return;
        }
        this.state.plans.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td>${p.value} ${p.unit}</td>
                <td>
                    <button class="button-small delete" onclick="app.deletePlan(${p.id})">🗑️ Deletar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    deletePlan(id) {
        if (!confirm('Deletar este plano?')) return;
        this.state.plans = this.state.plans.filter(p => p.id !== id);
        this.state.savePlans();
        this.populatePlanSelect();
        this.loadPlansTable();
    }

    // ==================== FERRAMENTAS / SITES ====================
    async loadToolsManifest() {
        try {
            const res = await fetch('Ferramentas/manifest.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('Manifest não encontrado');
            const json = await res.json();
            this.tools = Array.isArray(json) ? json : (json.tools || []);
            this.renderToolsList();
        } catch (err) {
            const container = document.getElementById('toolsList');
            if (container) container.innerHTML = '<div style="color:#999">Nenhum manifest de ferramentas (Ferramentas/manifest.json)</div>';
        }
    }

    renderToolsList() {
        const container = document.getElementById('toolsList');
        if (!container) return;
        container.innerHTML = '';
        if (!this.tools || this.tools.length === 0) {
            container.innerHTML = '<div style="color:#999">Nenhuma ferramenta registrada.</div>';
            return;
        }
        this.tools.forEach(t => {
            const b = document.createElement('button');
            b.className = 'menu-item';
            b.style.display = 'inline-flex';
            b.style.alignItems = 'center';
            b.textContent = t.name || t.id || t.path;
            b.onclick = () => this.openTool(t.path, t.name || t.path);
            container.appendChild(b);
        });
    }

    openTool(path, name) {
        const frame = document.getElementById('toolFrame');
        const container = document.getElementById('toolFrameContainer');
        const title = document.getElementById('toolFrameTitle');
        if (!frame || !container) return;
        frame.src = path;
        title.textContent = name;
        container.style.display = '';
    }

    exportData() {
        const dataStr = JSON.stringify(this.state.users, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_users_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    clearAllData() {
        if (confirm('ATENÇÃO: Isto deletará TODOS os dados do sistema! Tem certeza?')) {
            if (confirm('Última confirmação: Isto é irreversível!')) {
                localStorage.removeItem('users');
                this.state.users = this.state.getDefaultUsers();
                this.state.saveUsers();
                this.loadUsersTable();
                this.updateSettings();
                alert('Todos os dados foram resetados!');
            }
        }
    }

    // ==================== MODAL ====================
    closeModal() {
        document.getElementById('editTimeModal').classList.remove('active');
    }
}

// ==================== INITIALIZE APP ====================
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CentralApp();
});
