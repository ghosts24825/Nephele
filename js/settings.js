const SettingsModule = (function() {
    'use strict';

    function create(deps) {
        const {
            STORAGE,
            autoSaveWorld,
            ensureProviderSystemDependencies,
            ensureWorldSystem,
            escapeHtml,
            generateId,
            getGlobalInspo,
            getSupabaseApi,
            migrateGlobalInspoFromWorlds,
            normalizeCloudPayload,
            readJson,
            renderBookshelf,
            renderWorldData,
            saveAiDrafts,
            saveGlobalInspo,
            setApiStatus,
            showToast
        } = deps;

        function renderProviderSelect(providers, currentId) {
            const select = document.getElementById('providerSelect');
            if (!select) return;
            select.innerHTML = '';
            Object.entries(providers).forEach(([id, config]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = config.name || '默认配置';
                option.selected = id === currentId;
                select.appendChild(option);
            });
        }

        function renderModelList(models, selectedModel) {
            const list = document.getElementById('modelList');
            if (!list) return;
            list.innerHTML = '';
            models.forEach(modelId => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `model-card${modelId === selectedModel ? ' selected' : ''}`;
                button.innerHTML = `<span class="model-dot"></span>${escapeHtml(modelId)}`;
                button.addEventListener('click', () => {
                    window.AIService?.setSelectedModel(modelId);
                    saveCurrentProviderConfig();
                    renderModelList(models, modelId);
                    setApiStatus('valid', `已选择模型：${modelId}`);
                });
                list.appendChild(button);
            });
        }

        function loadProviderConfig(providerId) {
            const providers = window.AIService?.getProviders?.() || {};
            const config = providers[providerId];
            if (!config) return;
            document.getElementById('aiBaseUrl').value = config.baseUrl || '';
            document.getElementById('aiApiKey').value = config.apiKey || '';
            if (config.selectedModel) {
                window.AIService?.setSelectedModel(config.selectedModel);
                setApiStatus('valid', `已选择模型：${config.selectedModel}`);
            } else {
                setApiStatus('', '未连接');
            }
        }

        function ensureProviderSystem() {
            if (!window.AIService?.initProviderSystem) return;
            ensureProviderSystemDependencies?.();
            const { providers, currentId } = window.AIService.initProviderSystem();
            renderProviderSelect(providers, currentId);
            loadProviderConfig(currentId);
        }

        function saveCurrentProviderConfig() {
            if (!window.AIService?.saveCurrentProviderConfig) return;
            window.AIService.saveCurrentProviderConfig({
                baseUrl: document.getElementById('aiBaseUrl')?.value.trim() || '',
                apiKey: document.getElementById('aiApiKey')?.value.trim() || '',
                selectedModel: window.AIService.getSelectedModel?.() || ''
            });
        }

        function switchProvider(providerId) {
            saveCurrentProviderConfig();
            window.AIService?.setCurrentProviderId?.(providerId);
            loadProviderConfig(providerId);
            const modelList = document.getElementById('modelList');
            if (modelList) modelList.innerHTML = '';
        }

        function newProvider() {
            const name = window.prompt('新配置名称', '默认配置');
            if (!name || !window.AIService?.getProviders) return;
            const providers = window.AIService.getProviders();
            const id = generateId();
            providers[id] = { name: name.trim() || '默认配置', baseUrl: '', apiKey: '', selectedModel: '' };
            window.AIService.saveProviders(providers);
            window.AIService.setCurrentProviderId(id);
            renderProviderSelect(providers, id);
            loadProviderConfig(id);
        }

        function renameProvider() {
            if (!window.AIService?.getCurrentProviderId) return;
            const id = window.AIService.getCurrentProviderId();
            const providers = window.AIService.getProviders();
            const current = providers[id];
            if (!current) return;
            const name = window.prompt('新的配置名称', current.name || '默认配置');
            if (!name) return;
            current.name = name.trim() || current.name;
            window.AIService.saveProviders(providers);
            renderProviderSelect(providers, id);
        }

        function deleteProvider() {
            if (!window.AIService?.getProviders) return;
            const providers = window.AIService.getProviders();
            const ids = Object.keys(providers);
            if (ids.length <= 1) {
                showToast('至少保留一个配置');
                return;
            }
            const id = window.AIService.getCurrentProviderId();
            delete providers[id];
            const nextId = Object.keys(providers)[0];
            window.AIService.saveProviders(providers);
            window.AIService.setCurrentProviderId(nextId);
            renderProviderSelect(providers, nextId);
            loadProviderConfig(nextId);
        }

        async function fetchModels() {
            saveCurrentProviderConfig();
            const baseUrl = document.getElementById('aiBaseUrl')?.value.trim() || '';
            const apiKey = document.getElementById('aiApiKey')?.value.trim() || '';
            if (!window.AIService?.fetchModels) {
                showToast('AI 服务未就绪');
                return;
            }
            if (!baseUrl) {
                setApiStatus('invalid', '请先填写 API 地址');
                return;
            }
            setApiStatus('loading', '正在拉取模型...');
            try {
                const models = await window.AIService.fetchModels(baseUrl, apiKey);
                renderModelList(models, window.AIService.getSelectedModel?.() || '');
                setApiStatus('valid', `已拉取 ${models.length} 个模型`);
                saveCurrentProviderConfig();
            } catch (error) {
                setApiStatus('invalid', error.message || '拉取失败');
            }
        }

        function toggleApiKey() {
            const input = document.getElementById('aiApiKey');
            if (input) input.type = input.type === 'password' ? 'text' : 'password';
        }

        function getCloudUsernameInput() {
            return document.querySelector('#modal-settings #cloudUsername') || document.getElementById('cloudUsername');
        }

        function initCloudUsername() {
            const input = getCloudUsernameInput();
            if (input) input.value = localStorage.getItem(STORAGE.cloudUsername) || '';
        }

        function getBackupStatusNode() {
            return document.getElementById('backupStatus');
        }

        function setBackupStatus(text) {
            const node = getBackupStatusNode();
            if (node) node.textContent = text;
        }

        function getBackupKeys() {
            const prefixes = ['generator_', 'ss_ai_', 'ss_worlds', 'ss_current_world', 'ss_theme'];
            return Object.keys(localStorage)
                .filter(key => prefixes.some(prefix => key.startsWith(prefix)))
                .sort();
        }

        function buildBackupPayload() {
            const data = {};
            getBackupKeys().forEach(key => {
                data[key] = localStorage.getItem(key);
            });
            return {
                app: 'generator',
                version: 1,
                exportedAt: new Date().toISOString(),
                data
            };
        }

        function exportLocalBackup() {
            try {
                saveAiDrafts();
                autoSaveWorld();
                const payload = buildBackupPayload();
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                anchor.href = url;
                anchor.download = `generator-backup-${stamp}.json`;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
                setBackupStatus('已导出备份');
                showToast('已导出本地备份');
            } catch (error) {
                setBackupStatus('导出失败');
                showToast(error.message || '导出失败');
            }
        }

        function chooseLocalBackup() {
            const input = document.getElementById('localBackupFile');
            if (!input) return;
            input.value = '';
            input.click();
        }

        function normalizeBackupPayload(payload) {
            const data = payload?.data || payload?.localStorage || payload?.storage || null;
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('备份文件格式不正确');
            }
            return data;
        }

        async function importLocalBackup(fileInput) {
            const file = fileInput?.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = normalizeBackupPayload(JSON.parse(text));
                const keys = Object.keys(data);
                if (!keys.length) {
                    throw new Error('备份文件没有可导入的数据');
                }
                const confirmed = window.confirm(`导入会覆盖当前本地创作数据和 AI 配置。确定导入 ${keys.length} 项数据吗？`);
                if (!confirmed) {
                    setBackupStatus('已取消导入');
                    return;
                }
                getBackupKeys().forEach(key => localStorage.removeItem(key));
                keys.forEach(key => {
                    if (typeof data[key] === 'string') {
                        localStorage.setItem(key, data[key]);
                    }
                });
                ensureWorldSystem();
                migrateGlobalInspoFromWorlds();
                applyTheme();
                applyFont();
                initCloudUsername();
                ensureProviderSystem();
                renderBookshelf();
                renderWorldData();
                setBackupStatus('导入成功');
                showToast('已导入本地备份');
            } catch (error) {
                setBackupStatus('导入失败');
                showToast(error.message || '导入失败');
            } finally {
                if (fileInput) fileInput.value = '';
            }
        }

        async function saveToCloud() {
            const username = getCloudUsernameInput()?.value.trim();
            const supabaseApi = getSupabaseApi();
            if (!username) {
                showToast('请先填写同步用户名');
                return;
            }
            if (!supabaseApi?.saveToCloud) {
                showToast('云同步服务未就绪');
                return;
            }
            document.getElementById('syncStatus').textContent = '上传中...';
            try {
                saveAiDrafts();
                autoSaveWorld();
                const localWorlds = readJson(STORAGE.worlds, {});
                let mergedWorlds = { ...localWorlds };
                const currentWorld = localStorage.getItem(STORAGE.currentWorld) || '';
                const theme = localStorage.getItem(STORAGE.theme) || 'light';
                const font = localStorage.getItem(STORAGE.font) || 'system';
                const customFont = localStorage.getItem(STORAGE.customFont) || '';
                const globalInspo = JSON.stringify(getGlobalInspo());
                try {
                    const existingCloud = normalizeCloudPayload(await supabaseApi.loadFromCloud(username));
                    const existingWorlds = existingCloud?.worlds ? JSON.parse(existingCloud.worlds) : {};
                    mergedWorlds = { ...existingWorlds, ...localWorlds };
                } catch {}
                const worlds = JSON.stringify(mergedWorlds);
                await supabaseApi.saveToCloud(username, {
                    worlds,
                    currentWorld,
                    theme,
                    font,
                    customFont,
                    globalInspo,
                    ss_worlds: worlds,
                    ss_current_world_v2: currentWorld,
                    ss_theme_v1: theme
                });
                localStorage.setItem(STORAGE.cloudUsername, username);
                document.getElementById('syncStatus').textContent = '上传成功';
                showToast('已上传到云端');
            } catch (error) {
                document.getElementById('syncStatus').textContent = '上传失败';
                showToast(error.message || '上传失败');
            }
        }

        async function loadFromCloud() {
            const username = getCloudUsernameInput()?.value.trim();
            const supabaseApi = getSupabaseApi();
            if (!username) {
                showToast('请先填写同步用户名');
                return;
            }
            if (!supabaseApi?.loadFromCloud) {
                showToast('云同步服务未就绪');
                return;
            }
            document.getElementById('syncStatus').textContent = '下载中...';
            try {
                const data = normalizeCloudPayload(await supabaseApi.loadFromCloud(username));
                if (data.worlds) localStorage.setItem(STORAGE.worlds, data.worlds);
                if (data.currentWorld) localStorage.setItem(STORAGE.currentWorld, data.currentWorld);
                if (data.theme) localStorage.setItem(STORAGE.theme, data.theme);
                if (data.font && STORAGE.font) localStorage.setItem(STORAGE.font, data.font);
                if (data.customFont && STORAGE.customFont) localStorage.setItem(STORAGE.customFont, data.customFont);
                if (data.globalInspo) {
                    try {
                        saveGlobalInspo(typeof data.globalInspo === 'string' ? JSON.parse(data.globalInspo) : data.globalInspo);
                    } catch {}
                }
                localStorage.setItem(STORAGE.cloudUsername, username);
                ensureWorldSystem();
                migrateGlobalInspoFromWorlds();
                applyTheme();
                applyFont();
                renderBookshelf();
                renderWorldData();
                document.getElementById('syncStatus').textContent = '下载成功';
                showToast('已从云端恢复');
            } catch (error) {
                document.getElementById('syncStatus').textContent = '下载失败';
                showToast(error.message || '下载失败');
            }
        }

        function applyTheme() {
            const theme = localStorage.getItem(STORAGE.theme) || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            const checkbox = document.getElementById('checkbox');
            if (checkbox) checkbox.checked = theme === 'dark';
            const select = document.getElementById('themeSelect');
            if (select) select.value = theme;
        }

        function setTheme(theme) {
            const allowed = ['light', 'sky', 'pink', 'gray', 'dark'];
            const nextTheme = allowed.includes(theme) ? theme : 'light';
            localStorage.setItem(STORAGE.theme, nextTheme);
            applyTheme();
        }

        function toggleTheme() {
            const theme = document.getElementById('checkbox')?.checked ? 'dark' : 'light';
            setTheme(theme);
        }

        function applyFont() {
            const font = localStorage.getItem(STORAGE.font) || 'system';
            const customFont = localStorage.getItem(STORAGE.customFont) || '';
            document.documentElement.setAttribute('data-font', font);
            if (font === 'custom' && customFont.trim()) {
                document.documentElement.style.setProperty('--font-family-ui', `"${customFont.trim()}", Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif`);
            } else {
                document.documentElement.style.removeProperty('--font-family-ui');
            }
            const select = document.getElementById('fontSelect');
            if (select) select.value = font;
            const input = document.getElementById('customFontInput');
            if (input) {
                input.value = customFont;
                input.disabled = font !== 'custom';
            }
        }

        function setFont(font) {
            const allowed = ['system', 'yahei', 'hei', 'serif', 'kai', 'mono', 'custom'];
            const nextFont = allowed.includes(font) ? font : 'system';
            localStorage.setItem(STORAGE.font, nextFont);
            applyFont();
        }

        function setCustomFont(fontName) {
            localStorage.setItem(STORAGE.customFont, fontName || '');
            localStorage.setItem(STORAGE.font, 'custom');
            applyFont();
        }

        function initAppearanceSettings() {
            applyTheme();
            applyFont();
        }

        function setThemeFromSelect(theme) {
            setTheme(theme);
        }

        function openSettingsModal() {
            document.getElementById('modal-settings')?.classList.add('active');
        }

        function closeSettingsModal() {
            document.getElementById('modal-settings')?.classList.remove('active');
        }

        return {
            applyTheme,
            applyFont,
            chooseLocalBackup,
            closeSettingsModal,
            deleteProvider,
            ensureProviderSystem,
            exportLocalBackup,
            fetchModels,
            importLocalBackup,
            initCloudUsername,
            loadFromCloud,
            newProvider,
            openSettingsModal,
            renameProvider,
            saveCurrentProviderConfig,
            saveToCloud,
            switchProvider,
            setCustomFont,
            setFont,
            setTheme,
            setThemeFromSelect,
            initAppearanceSettings,
            toggleApiKey,
            toggleTheme
        };
    }

    return { create };
})();

window.SettingsModule = SettingsModule;
