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
        this.db = null; // IndexedDB reference for sites
        this.initEventListeners();
        this.checkAuthStatus();
        this.initSitesDB();
    }

    // ------------------ SITES DB (IndexedDB) ------------------
    initSitesDB() {
        const req = indexedDB.open('sites-db', 1);
        req.onupgradeneeded = (ev) => {
            const db = ev.target.result;
            if (!db.objectStoreNames.contains('sites')) {
                db.createObjectStore('sites', { keyPath: 'id' });
            }
        };
        req.onsuccess = (ev) => { this.db = ev.target.result; this.loadManagedSites(); };
        req.onerror = () => { console.warn('IndexedDB não disponível'); };
    }

    dbPut(site) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('DB não inicializado'));
            const tx = this.db.transaction('sites', 'readwrite');
            const store = tx.objectStore('sites');
            const req = store.put(site);
            req.onsuccess = () => resolve(site);
            req.onerror = (e) => reject(e);
        });
    }

    dbGetAll() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction('sites', 'readonly');
            const store = tx.objectStore('sites');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e);
        });
    }

    dbDelete(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            const tx = this.db.transaction('sites', 'readwrite');
            const store = tx.objectStore('sites');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e);
        });
    }

    // ------------------ Gerenciar Sites ------------------
    async loadManagedSites() {
        const list = await this.dbGetAll();
        this.managedSites = list;
        this.renderManagedSites();
    }

    renderManagedSites() {
        const container = document.getElementById('sitesManagerList');
        if (!container) return;
        container.innerHTML = '';
        if (!this.managedSites || this.managedSites.length === 0) {
            container.innerHTML = '<div style="color:#999">Nenhum site importado.</div>';
            return;
        }
        this.managedSites.forEach(s => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px';
            row.style.border = '1px solid #eee';
            row.style.borderRadius = '6px';

            const info = document.createElement('div');
            info.innerHTML = `<strong>${s.name}</strong> <div style="font-size:12px;color:#666">${s.files.length} arquivo(s)</div>`;

            const actions = document.createElement('div');
            actions.style.display = 'flex'; actions.style.gap = '8px';

            const openBtn = document.createElement('button');
            openBtn.className = 'button-small';
            openBtn.textContent = 'Abrir';
            openBtn.onclick = () => this.openManagedSite(s.id);

            actions.appendChild(openBtn);
            // só mostrar editar/deletar para admin
            if (this.state.currentUser && this.state.currentUser.isAdmin) {
                const editBtn = document.createElement('button');
                editBtn.className = 'button-small';
                editBtn.textContent = 'Editar';
                editBtn.onclick = () => this.openSiteEditor(s.id);

                const delBtn = document.createElement('button');
                delBtn.className = 'button-small delete';
                delBtn.textContent = 'Deletar';
                delBtn.onclick = async () => { if (confirm('Deletar site?')) { await this.dbDelete(s.id); await this.loadManagedSites(); }};

                actions.appendChild(editBtn); actions.appendChild(delBtn);
            }

            row.appendChild(info); row.appendChild(actions);
            container.appendChild(row);
        });
    }

    mimeFromPath(path) {
        const ext = (path.split('.').pop() || '').toLowerCase();
        const map = {html:'text/html', htm:'text/html', css:'text/css', js:'application/javascript', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml', ico:'image/x-icon', json:'application/json'};
        return map[ext] || 'application/octet-stream';
    }

    async importZipFile(file) {
        const jszip = window.JSZip;
        if (!jszip) return alert('JSZip não carregado');
        const zip = await jszip.loadAsync(file);
        const files = [];
        const promises = [];
        zip.forEach((relativePath, zipEntry) => {
            promises.push(zipEntry.async('base64').then(b64 => {
                files.push({ path: relativePath, dataURL: `data:${this.mimeFromPath(relativePath)};base64,${b64}` });
            }));
        });
        await Promise.all(promises);
        const id = Date.now();
        const site = { id, name: file.name.replace(/\.(zip)$/i, ''), files, createdAt: new Date().toISOString() };
        await this.dbPut(site);
        await this.loadManagedSites();
    }

    async importHTMLFile(file) {
        const text = await file.text();
        const files = [ { path: 'index.html', dataURL: `data:${this.mimeFromPath('index.html')};base64,${btoa(unescape(encodeURIComponent(text)))}` } ];
        const id = Date.now();
        const site = { id, name: file.name.replace(/\.(html?|htm)$/i,''), files, createdAt: new Date().toISOString() };
        await this.dbPut(site);
        await this.loadManagedSites();
    }

    async openManagedSite(id) {
        const site = (this.managedSites || []).find(s => s.id === id);
        if (!site) return alert('Site não encontrado');
        // criar blob URLs para todos os arquivos
        const map = {};
        for (const f of site.files) {
            const res = await fetch(f.dataURL);
            const blob = await res.blob();
            map[f.path] = URL.createObjectURL(blob);
        }
        // pegar index.html
        let index = site.files.find(x => /index\.html?$/i.test(x.path));
        if (!index) {
            index = site.files[0];
        }
        const indexText = decodeURIComponent(escape(atob(index.dataURL.split(',')[1])));
        // substituir referências relativas por blob URLs
        let processed = indexText;
        // replace src and href occurrences (simple)
        Object.keys(map).forEach(p => {
            const regex = new RegExp(`(["'\(])${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(["'\)])`, 'g');
            processed = processed.replace(regex, `$1${map[p]}$2`);
        });

        const frame = document.getElementById('toolFrame');
        const container = document.getElementById('toolFrameContainer');
        const title = document.getElementById('toolFrameTitle');
        if (!frame || !container) return;
        frame.srcdoc = processed;
        title.textContent = site.name;
        container.style.display = '';
    }

    async openSiteEditor(id) {
        const site = (this.managedSites || []).find(s => s.id === id);
        if (!site) return;
        // abrir modal com primeiro arquivo (index)
        const f = site.files.find(x => /index\.html?$/i.test(x.path)) || site.files[0];
        const modal = document.getElementById('siteEditorModal');
        const title = document.getElementById('siteEditorTitle');
        const filename = document.getElementById('editorFilename');
        const content = document.getElementById('editorContent');
        title.textContent = `Editar: ${site.name}`;
        filename.value = f.path;
        content.value = decodeURIComponent(escape(atob(f.dataURL.split(',')[1])));
        modal.classList.add('active');

        // salvar handler
        const saveBtn = document.getElementById('saveSiteFileBtn');
        saveBtn.onclick = async () => {
            f.dataURL = `data:${this.mimeFromPath(f.path)};base64,${btoa(unescape(encodeURIComponent(content.value)))}`;
            await this.dbPut(site);
            await this.loadManagedSites();
            modal.classList.remove('active');
        };
        document.getElementById('closeSiteEditorBtn').onclick = () => modal.classList.remove('active');
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

        const cancelPlanBtn = document.getElementById('cancelPlanBtn');
        if (cancelPlanBtn) cancelPlanBtn.addEventListener('click', () => this.cancelPlanEdit());

        // remover estilo inválido quando selecionar um plano e mostrar campo custom
        const planSelect = document.getElementById('planSelect');
        if (planSelect) {
            planSelect.addEventListener('change', (e) => {
                e.target.classList.remove('invalid');
                const customInput = document.getElementById('newLoginTime');
                if (!customInput) return;
                if (e.target.value === 'custom') {
                    customInput.style.display = '';
                    customInput.disabled = false;
                } else {
                    customInput.style.display = 'none';
                    customInput.disabled = true;
                }
            });
        }

        // FERRAMENTAS (adicionar via dashboard)
        const addToolForm = document.getElementById('addToolForm');
        if (addToolForm) addToolForm.addEventListener('submit', (e) => this.handleAddTool(e));

        // SITES: importar/criar
        const importBtn = document.getElementById('importSiteBtn');
        if (importBtn) importBtn.addEventListener('click', (e) => this.handleImportSite(e));
        const createSiteBtn = document.getElementById('createSiteBtn');
        if (createSiteBtn) createSiteBtn.addEventListener('click', (e) => this.handleCreateSiteManual(e));

        // SEARCH USERS
        document.getElementById('searchUsers').addEventListener('input', (e) => this.filterUsers(e.target.value));

        // SETTINGS
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());

        // MODAL
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelTimeBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveTimeBtn').addEventListener('click', () => this.saveLoginTime());

        // site editor modal close/save
        const siteModalClose = document.querySelector('#siteEditorModal .modal-close');
        if (siteModalClose) siteModalClose.addEventListener('click', () => document.getElementById('siteEditorModal').classList.remove('active'));

        // SIDEBAR TOGGLE
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        // init admin settings form listener
        this.initAdminSettings();
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main-content');
        if (!sidebar || !main) return;
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('full-width');
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
        this.renderStoredTools();

        // ajustar UI conforme permissão
        this.restrictUIByRole();
        // mostrar seção de admin nas configurações se for admin
        const adminSection = document.getElementById('adminSettingsSection');
        if (adminSection) adminSection.style.display = (this.state.currentUser && this.state.currentUser.isAdmin) ? '' : 'none';
        // se usuário não for admin, forçar abrir a aba de ferramentas
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) {
            const toolsBtn = document.querySelector('.menu-item[data-tab="tools"]');
            if (toolsBtn) this.switchTab(toolsBtn);
        }
    }

    restrictUIByRole() {
        const isAdmin = !!(this.state.currentUser && this.state.currentUser.isAdmin);
        // esconder elementos com data-role="admin" quando não for admin
        document.querySelectorAll('[data-role="admin"]').forEach(el => {
            if (!isAdmin) el.style.display = 'none'; else el.style.display = '';
        });
        // esconder admin-only action buttons in tables (extra safety)
        if (!isAdmin) {
            // remove edit/delete buttons for users and plans from DOM by hiding
            document.querySelectorAll('.button-small.delete, .button-small[onclick*="editPlan"], .button-small[onclick*="editLoginTime"]').forEach(b => b.style.display = 'none');
        }
    }

    // ==================== LOGIN ====================
    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        errorDiv.classList.remove('show');

        const user = this.state.users.find(u => u.username === username && u.password === password);

        if (user) {
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
        const selectedPlanId = document.getElementById('planSelect') ? document.getElementById('planSelect').value : '';
        let loginTime = 0;
        if (!selectedPlanId) {
            const errorDiv = document.getElementById('createError');
            errorDiv.textContent = 'Selecione um plano para o usuário.';
            errorDiv.classList.add('show');
            const sel = document.getElementById('planSelect');
            if (sel) sel.classList.add('invalid');
            return;
        }
        if (selectedPlanId === 'custom') {
            const customTime = parseInt(document.getElementById('newLoginTime').value) || 0;
            if (customTime < 1) {
                const errorDiv = document.getElementById('createError');
                errorDiv.textContent = 'Tempo custom deve ser pelo menos 1 minuto.';
                errorDiv.classList.add('show');
                return;
            }
            loginTime = customTime;
        } else {
            const plan = this.state.plans.find(p => String(p.id) === String(selectedPlanId));
            if (plan) loginTime = this.convertPlanToMinutes(plan);
        }

        const errorDiv = document.getElementById('createError');
        const successDiv = document.getElementById('createSuccess');

        // somente admin pode criar usuários
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) {
            errorDiv.textContent = 'Apenas administradores podem criar usuários.';
            errorDiv.classList.add('show');
            return;
        }

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

        const isAdmin = !!(this.state.currentUser && this.state.currentUser.isAdmin);
        users.forEach(user => {
            const tr = document.createElement('tr');
            let actions = '';
            if (isAdmin) {
                actions = `
                    <div class="action-buttons">
                        <button class="button-small" onclick="app.editLoginTime('${user.username}', ${user.loginTime})">⏱️ Tempo</button>
                        <button class="button-small delete" onclick="app.deleteUser('${user.username}')">🗑️ Deletar</button>
                    </div>`;
            }
            tr.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${user.loginTime}</td>
                <td>${new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>${actions}</td>
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
        // somente admin
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) {
            alert('Apenas administradores podem deletar usuários.');
            return;
        }
        if (confirm(`Tem certeza que deseja deletar o usuário "${username}"?`)) {
            this.state.users = this.state.users.filter(u => u.username !== username);
            this.state.saveUsers();
            this.loadUsersTable();
        }
    }

    // ==================== TAB SWITCHING ====================
    switchTab(menuItem) {
        // verificar permissão por role (data-role)
        const required = menuItem.dataset.role;
        if (required === 'admin' && !(this.state.currentUser && this.state.currentUser.isAdmin)) {
            alert('Acesso negado: apenas administradores podem abrir esta aba.');
            const toolsBtn = document.querySelector('.menu-item[data-tab="tools"]');
            if (toolsBtn) {
                // ativa aba tools
                document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
                toolsBtn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                const tabElement = document.getElementById('tools-tab');
                if (tabElement) tabElement.classList.add('active');
            }
            return;
        }
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

    // ==================== ADMIN PASSWORD ====================
    initAdminSettings() {
        const form = document.getElementById('changeAdminForm');
        if (form) form.addEventListener('submit', (e) => this.handleChangeAdminPassword(e));
    }

    handleChangeAdminPassword(e) {
        e.preventDefault();
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) return alert('Apenas admin');
        const newPass = document.getElementById('newAdminPassword').value;
        const confirmPass = document.getElementById('confirmAdminPassword').value;
        const msg = document.getElementById('adminChangeMsg');
        if (!newPass || newPass.length < 4) {
            msg.textContent = 'Senha deve ter pelo menos 4 caracteres';
            msg.classList.add('show');
            return;
        }
        if (newPass !== confirmPass) {
            msg.textContent = 'Senhas não coincidem';
            msg.classList.add('show');
            return;
        }
        // encontrar usuário admin
        const admin = this.state.users.find(u => u.isAdmin);
        if (admin) {
            admin.password = newPass;
            this.state.saveUsers();
            msg.textContent = 'Senha do admin atualizada.';
            msg.classList.add('show');
            setTimeout(() => msg.classList.remove('show'), 2000);
            document.getElementById('changeAdminForm').reset();
        }
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
        placeholder.value = '';
        placeholder.textContent = '— Selecionar plano —';
        select.appendChild(placeholder);

        this.state.plans.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.value} ${p.unit})`;
            select.appendChild(opt);
        });
        // opção custom para permitir tempo manual
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

        // apenas admin pode criar/editar planos
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) {
            msg.textContent = 'Apenas administradores podem gerenciar planos.';
            msg.classList.add('show');
            return;
        }

        if (!name) {
            msg.textContent = 'Nome do plano é obrigatório';
            msg.classList.add('show');
            return;
        }

        const form = document.getElementById('createPlanForm');
        const editId = form.dataset.editId;
        if (editId) {
            // editar plano existente
            const plan = this.state.plans.find(p => String(p.id) === String(editId));
            if (plan) {
                plan.name = name;
                plan.value = value;
                plan.unit = unit;
                this.state.savePlans();
                msg.textContent = `Plano "${name}" atualizado.`;
                msg.classList.add('show');
                delete form.dataset.editId;
                const createBtn = document.getElementById('createPlanBtn');
                if (createBtn) createBtn.textContent = 'Criar Plano';
                const cancelBtn = document.getElementById('cancelPlanBtn');
                if (cancelBtn) cancelBtn.style.display = 'none';
            }
        } else {
            const plan = { id: Date.now(), name, value, unit };
            this.state.plans.push(plan);
            this.state.savePlans();
            msg.textContent = `Plano "${name}" criado.`;
            msg.classList.add('show');
        }

        document.getElementById('createPlanForm').reset();
        this.populatePlanSelect();
        this.loadPlansTable();
        setTimeout(() => msg.classList.remove('show'), 2000);
    }

    editPlan(id) {
        const plan = this.state.plans.find(p => p.id === id);
        if (!plan) return;
        document.getElementById('planName').value = plan.name;
        document.getElementById('planValue').value = plan.value;
        document.getElementById('planUnit').value = plan.unit;
        const form = document.getElementById('createPlanForm');
        form.dataset.editId = plan.id;
        const createBtn = document.getElementById('createPlanBtn');
        if (createBtn) createBtn.textContent = 'Salvar Alterações';
        const cancelBtn = document.getElementById('cancelPlanBtn');
        if (cancelBtn) cancelBtn.style.display = '';
    }

    cancelPlanEdit() {
        const form = document.getElementById('createPlanForm');
        if (!form) return;
        delete form.dataset.editId;
        form.reset();
        const createBtn = document.getElementById('createPlanBtn');
        if (createBtn) createBtn.textContent = 'Criar Plano';
        const cancelBtn = document.getElementById('cancelPlanBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    loadPlansTable() {
        const tbody = document.getElementById('plansTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!this.state.plans || this.state.plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999">Nenhum plano</td></tr>';
            return;
        }
        const isAdmin = !!(this.state.currentUser && this.state.currentUser.isAdmin);
        this.state.plans.forEach(p => {
            const tr = document.createElement('tr');
            let actionsHtml = '';
            if (isAdmin) {
                actionsHtml = `<button class="button-small" onclick="app.editPlan(${p.id})">✏️ Editar</button> <button class="button-small delete" onclick="app.deletePlan(${p.id})">🗑️ Deletar</button>`;
            }
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td>${p.value} ${p.unit}</td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ==================== FERRAMENTAS LOCAIS (fallback) ====================
    handleAddTool(e) {
        e.preventDefault();
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) return alert('Apenas administradores podem adicionar ferramentas.');
        const name = document.getElementById('toolName').value.trim();
        const path = document.getElementById('toolPath').value.trim();
        if (!name || !path) return;
        const stored = localStorage.getItem('localTools');
        const arr = stored ? JSON.parse(stored) : [];
        arr.push({ id: Date.now(), name, path, local: true });
        localStorage.setItem('localTools', JSON.stringify(arr));
        document.getElementById('addToolForm').reset();
        this.renderStoredTools();
    }

    renderStoredTools() {
        const stored = localStorage.getItem('localTools');
        const arr = stored ? JSON.parse(stored) : [];
        if (!arr || arr.length === 0) return;
        // merge with existing tools (from manifest) when rendering
        this.tools = this.tools || [];
        // do not duplicate if already present
        arr.forEach(a => {
            if (!this.tools.find(t => t.path === a.path && t.name === a.name)) this.tools.push(a);
        });
        this.renderToolsList();
    }

    // permitir remover ferramentas locais
    removeLocalTool(id) {
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) return alert('Apenas administradores podem remover ferramentas.');
        const stored = localStorage.getItem('localTools');
        const arr = stored ? JSON.parse(stored) : [];
        const filtered = arr.filter(x => x.id !== id);
        localStorage.setItem('localTools', JSON.stringify(filtered));
        // atualizar lista no dashboard
        this.tools = (this.tools || []).filter(t => !(t.id === id));
        this.renderToolsList();
    }

    deletePlan(id) {
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) {
            alert('Apenas administradores podem deletar planos.');
            return;
        }
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
            // also merge localTools (if any)
            const stored = localStorage.getItem('localTools');
            const arr = stored ? JSON.parse(stored) : [];
            arr.forEach(a => {
                if (!this.tools.find(t => t.path === a.path && t.name === a.name)) this.tools.push(a);
            });
            this.renderToolsList();
        } catch (err) {
            const container = document.getElementById('toolsList');
            if (container) container.innerHTML = '<div style="color:#999">Nenhum manifest de ferramentas (Ferramentas/manifest.json)</div>';
        }
    }

    // ------------------ HANDLERS DE UI SITES ------------------
    async handleImportSite(e) {
        e.preventDefault();
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) return alert('Apenas administradores podem importar sites.');
        const input = document.getElementById('siteFileInput');
        if (!input || !input.files || input.files.length === 0) return alert('Selecione um arquivo ZIP ou HTML');
        const file = input.files[0];
        if (/\.zip$/i.test(file.name)) {
            await this.importZipFile(file);
        } else if (/\.html?$|\.htm$/i.test(file.name)) {
            await this.importHTMLFile(file);
        } else {
            alert('Tipo de arquivo não suportado');
        }
        input.value = '';
    }

    async handleCreateSiteManual(e) {
        e.preventDefault();
        if (!(this.state.currentUser && this.state.currentUser.isAdmin)) return alert('Apenas administradores podem criar sites.');
        const name = prompt('Nome do site:');
        if (!name) return;
        const id = Date.now();
        const files = [ { path: 'index.html', dataURL: `data:text/html;base64,${btoa('<!doctype html><html><head><meta charset="utf-8"><title>'+name+'</title></head><body><h1>'+name+'</h1><p>Site criado manualmente.</p></body></html>')}` } ];
        const site = { id, name, files, createdAt: new Date().toISOString() };
        await this.dbPut(site);
        await this.loadManagedSites();
    }

    renderToolsList() {
        const container = document.getElementById('toolsList');
        if (!container) return;
        container.innerHTML = '';
        if (!this.tools || this.tools.length === 0) {
            container.innerHTML = '<div style="color:#999">Nenhuma ferramenta registrada.</div>';
            return;
        }
        const isAdmin = !!(this.state.currentUser && this.state.currentUser.isAdmin);
        this.tools.forEach(t => {
            const wrap = document.createElement('div');
            wrap.style.display = 'inline-flex';
            wrap.style.gap = '8px';
            wrap.style.alignItems = 'center';

            const b = document.createElement('button');
            b.className = 'menu-item';
            b.textContent = t.name || t.id || t.path;
            b.onclick = () => this.openTool(t.path, t.name || t.path);

            wrap.appendChild(b);

            // se a ferramenta tiver um id (local), permitir remoção
            if (t.local && isAdmin) {
                const del = document.createElement('button');
                del.className = 'button-small delete';
                del.textContent = '🗑️';
                del.onclick = (ev) => { ev.stopPropagation(); this.removeLocalTool(t.id); };
                wrap.appendChild(del);
            }

            container.appendChild(wrap);
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
});
