// ==================== APP STATE ====================
class AppState {
    constructor() {
        this.currentUser = null;
        this.loadUserData();
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
        const loginTime = parseInt(document.getElementById('newLoginTime').value) || 30;

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
