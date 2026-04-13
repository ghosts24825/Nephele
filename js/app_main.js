(() => {
    'use strict';

    const {
        STORAGE,
        DEFAULT_BRANCH_TEMPLATE,
        DEFAULT_INSPO,
        MODULE_GUIDE_LABELS,
        MODULE_JSON_SCHEMA,
        WORLD_MODULE_CONFIGS,
        applyGlobalInspoToWorld,
        createDefaultProtagonist,
        createDefaultWorld,
        ensureWorldShape,
        ensureWorldSystem,
        escapeHtml,
        generateId,
        getCurrentWorld,
        getCurrentWorldId,
        getGlobalInspo,
        getWorlds,
        migrateGlobalInspoFromWorlds,
        normalizeCloudPayload,
        readJson,
        saveGlobalInspo,
        saveWorlds,
        scrollResultIntoView,
        setCurrentWorldId,
        showToast,
        updateCurrentWorld,
        updateGlobalInspo
    } = window.StateModule;

    let currentImportType = null;
    let currentWorkspacePanel = 'original';
    let settingsActions = null;
    let storyActions = null;
    let renderActions = null;
    let aiActions = null;

    function togglePage(showWorkspace) {
        document.getElementById('page-start')?.classList.add('page-hidden');
        document.getElementById('page-home')?.classList.toggle('page-hidden', showWorkspace);
        document.getElementById('page-workspace')?.classList.toggle('page-hidden', !showWorkspace);
    }

    function enterBookshelf() {
        renderBookshelf();
        togglePage(false);
    }

    function switchWorkspacePanel(panel) {
        currentWorkspacePanel = panel;
        document.getElementById('panel-original')?.classList.toggle('view-hidden', panel !== 'original');
        document.getElementById('panel-inspo')?.classList.toggle('view-hidden', panel !== 'inspo');
        document.getElementById('panel-ai')?.classList.toggle('view-hidden', panel !== 'ai');
        document.getElementById('panel-opening')?.classList.toggle('view-hidden', panel !== 'opening');
        document.getElementById('panel-story')?.classList.toggle('view-hidden', panel !== 'story');
        const navOriginal = document.getElementById('nav-original');
        const navInspo = document.getElementById('nav-inspo');
        const navAi = document.getElementById('nav-ai');
        const navOpening = document.getElementById('nav-opening');
        const navStory = document.getElementById('nav-story');
        navOriginal?.classList.toggle('active', panel === 'original');
        navInspo?.classList.toggle('active', panel === 'inspo');
        navAi?.classList.toggle('active', panel === 'ai');
        navOpening?.classList.toggle('active', panel === 'opening');
        navStory?.classList.toggle('active', panel === 'story');

        if (window.matchMedia?.('(max-width: 992px)').matches) {
            const activeNav = panel === 'original'
                ? navOriginal
                : (panel === 'inspo' ? navInspo : (panel === 'ai' ? navAi : (panel === 'opening' ? navOpening : navStory)));
            activeNav?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    function getSupabaseApi() {
        return typeof SupabaseClient !== 'undefined' ? SupabaseClient : window.SupabaseClient;
    }

    function renderBookshelf() { return renderActions.renderBookshelf(); }
    function renderWorldData() { return renderActions.renderWorldData(); }
    function renderReader(world) { return renderActions.renderReader(world); }
    function getSelectedCharModules() { return renderActions.getSelectedCharModules(); }
    function updateModulePreview() { return renderActions.updateModulePreview(); }

    function enterWorkspace(worldId) {
        setCurrentWorldId(worldId);
        renderWorldData();
        togglePage(true);
        switchWorkspacePanel(currentWorkspacePanel);
    }

    function backToHome() {
        renderBookshelf();
        togglePage(false);
    }

    function createNewWorld() {
        const input = window.prompt('请输入世界名称', `世界 ${Object.keys(getWorlds()).length + 1}`);
        if (!input) return;
        const name = input.trim();
        if (!name) return;
        const clearedGlobalInspo = updateGlobalInspo(globalInspo => {
            Object.keys(globalInspo.selected).forEach(category => {
                globalInspo.selected[category] = [];
            });
        });
        const worlds = getWorlds();
        const worldId = generateId();
        worlds[worldId] = createDefaultWorld(name);
        applyGlobalInspoToWorld(worlds[worldId], clearedGlobalInspo);
        saveWorlds(worlds);
        setCurrentWorldId(worldId);
        renderBookshelf();
        enterWorkspace(worldId);
        showToast('已创建新世界');
    }

    function renameCurrentWorld() {
        const world = getCurrentWorld();
        if (!world) return;
        const input = window.prompt('新的世界名称', world.name);
        if (!input) return;
        const name = input.trim();
        if (!name || name === world.name) return;
        updateCurrentWorld(target => { target.name = name; });
        renderWorldData();
        renderBookshelf();
        showToast('已重命名');
    }

    function deleteCurrentWorld() {
        const worlds = getWorlds();
        const worldId = getCurrentWorldId();
        if (Object.keys(worlds).length <= 1) {
            showToast('至少保留一个世界');
            return;
        }
        if (!window.confirm(`确定删除“${worlds[worldId].name}”吗？`)) return;
        delete worlds[worldId];
        saveWorlds(worlds);
        setCurrentWorldId(Object.keys(worlds)[0]);
        backToHome();
    }

    function addNewChapter() {
        const input = window.prompt('章节名称', '新章节');
        if (!input) return;
        const name = input.trim();
        if (!name) return;
        updateCurrentWorld(world => { world.chapters.push(name); });
        renderWorldData();
    }

    function addProtagonist() {
        updateCurrentWorld(world => {
            world.protagonists.push(createDefaultProtagonist(world.protagonists.length + 1));
        });
        renderWorldData();
    }

    function removeProtagonist(id) {
        updateCurrentWorld(world => {
            world.protagonists = world.protagonists.filter(item => item.id !== id);
        });
        renderWorldData();
    }

    function updateProtagonistField(id, field, value) {
        updateCurrentWorld(world => {
            const target = world.protagonists.find(item => item.id === id);
            if (target) target[field] = value;
        });
    }

    function addInspoWord(category) {
        const inputId = { persona: 'personaInput', trope: 'tropeInput', storyKeyword: 'storyKeywordInput' }[category];
        const input = document.getElementById(inputId);
        const value = input?.value.trim();
        if (!value) return;
        updateGlobalInspo(globalInspo => {
            if (!globalInspo.pools[category].includes(value)) globalInspo.pools[category].push(value);
            if (!globalInspo.selected[category].includes(value)) globalInspo.selected[category].push(value);
        });
        input.value = '';
        renderWorldData();
    }

    function loadDefaultInspos(category) {
        updateGlobalInspo(globalInspo => {
            globalInspo.pools[category] = Array.from(new Set([...globalInspo.pools[category], ...DEFAULT_INSPO[category]]));
        });
        renderWorldData();
        showToast('已载入默认词库');
    }

    function clearInspoPool(category) {
        updateGlobalInspo(globalInspo => {
            globalInspo.pools[category] = [];
            globalInspo.selected[category] = [];
        });
        renderWorldData();
    }

    function toggleInspoWord(category, index) {
        updateGlobalInspo(globalInspo => {
            const value = globalInspo.pools[category][index];
            if (!value) return;
            const hit = globalInspo.selected[category].indexOf(value);
            if (hit >= 0) globalInspo.selected[category].splice(hit, 1);
            else globalInspo.selected[category].push(value);
        });
        renderWorldData();
    }

    function deselectInspoWord(category, value) {
        updateGlobalInspo(globalInspo => {
            globalInspo.selected[category] = globalInspo.selected[category].filter(item => item !== value);
        });
        renderWorldData();
    }

    function removeInspoWord(category, index, event) {
        event.stopPropagation();
        updateGlobalInspo(globalInspo => {
            const value = globalInspo.pools[category][index];
            globalInspo.pools[category].splice(index, 1);
            globalInspo.selected[category] = globalInspo.selected[category].filter(item => item !== value);
        });
        renderWorldData();
    }

    function exportInspoPool(category) {
        const content = getGlobalInspo().pools[category].join('\n');
        if (!content) {
            showToast('当前词库为空');
            return;
        }
        navigator.clipboard.writeText(content).then(() => showToast('已复制词库内容')).catch(() => showToast('复制失败'));
    }

    function openImportModal(category) {
        currentImportType = category;
        document.getElementById('importModalTitle').textContent = {
            persona: '批量导入人物关键词',
            trope: '批量导入剧情关键词',
            storyKeyword: '批量导入故事关键词'
        }[category];
        document.getElementById('importTextarea').value = '';
        document.getElementById('importModal')?.classList.add('active');
    }

    function closeImportModal() {
        document.getElementById('importModal')?.classList.remove('active');
        currentImportType = null;
    }

    function confirmImport() {
        if (!currentImportType) return;
        const values = (document.getElementById('importTextarea')?.value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
        if (!values.length) {
            showToast('没有可导入的内容');
            return;
        }
        updateGlobalInspo(globalInspo => {
            globalInspo.pools[currentImportType] = Array.from(new Set([...globalInspo.pools[currentImportType], ...values]));
        });
        closeImportModal();
        renderWorldData();
        showToast('导入完成');
    }

    function inspoInputKeydown(event, category) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addInspoWord(category);
        }
    }

    function autoSaveWorld() {
        updateCurrentWorld(world => { world.worldbook = document.getElementById('worldWorldbook')?.value || ''; });
        renderReader(getCurrentWorld());
    }

    function saveAiDrafts() {
        updateCurrentWorld(world => {
            ensureWorldShape(world);
            world.ai.persona = document.getElementById('aiPersona')?.value || '';
            world.ai.worldPersona = document.getElementById('aiWorldPersona')?.value || '';
            world.ai.storyPersona = document.getElementById('aiStoryPersona')?.value || '';
            world.ai.storyRequest = document.getElementById('aiStoryRequest')?.value || '';
            world.ai.openingPersonaCards = document.getElementById('openingPersonaCards')?.value || '';
            world.ai.openingWorldbook = document.getElementById('openingWorldbook')?.value || '';
            world.ai.branchTemplate = document.getElementById('storyBranchTemplate')?.value || DEFAULT_BRANCH_TEMPLATE;
            WORLD_MODULE_CONFIGS.forEach(config => {
                const textarea = document.getElementById(config.textareaId);
                const checkbox = document.querySelector(`input[name="worldModule"][value="${config.key}"]`);
                world.ai.worldModuleDrafts[config.key] = textarea?.value || '';
                world.ai.worldModuleSelection[config.key] = checkbox ? checkbox.checked : true;
            });
        });
    }

    function updateWorldModuleHint(textareaId, hintId) {
        const textarea = document.getElementById(textareaId);
        const hint = document.getElementById(hintId);
        if (!textarea || !hint) return;
        hint.classList.toggle('hidden', Boolean(textarea.value.trim()));
    }

    function initWorldModuleHints() {
        WORLD_MODULE_CONFIGS.forEach(config => {
            const textarea = document.getElementById(config.textareaId);
            const hint = document.getElementById(config.hintId);
            if (!textarea || !hint) return;
            if (!hint.textContent.trim()) hint.textContent = config.defaultHint;
            updateWorldModuleHint(config.textareaId, config.hintId);
            textarea.addEventListener('input', () => {
                updateWorldModuleHint(config.textareaId, config.hintId);
                saveAiDrafts();
            });
        });
        document.querySelectorAll('input[name="worldModule"]').forEach(input => {
            input.addEventListener('change', saveAiDrafts);
        });
    }

    function saveStoryBranchTemplate() {
        saveAiDrafts();
    }

    function toggleAiModules(mode) {
        const container = document.getElementById(mode === 'world' ? 'aiWorldModulesContainer' : 'aiCharModulesContainer');
        const arrow = document.getElementById(mode === 'world' ? 'aiWorldModulesToggleArrow' : 'aiCharModulesToggleArrow');
        if (!container || !arrow) return;
        const hidden = container.classList.toggle('view-hidden');
        arrow.textContent = hidden ? '▸' : '▾';
    }

    function toggleFoldSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const nextCollapsed = !section.classList.contains('is-collapsed');
        section.classList.toggle('is-collapsed', nextCollapsed);
        const button = section.querySelector('.fold-toggle');
        const arrow = section.querySelector('.fold-arrow');
        if (button) button.setAttribute('aria-expanded', String(!nextCollapsed));
        if (arrow) arrow.textContent = nextCollapsed ? '▸' : '▾';
    }

    function toggleJsonPreview() {
        const preview = document.getElementById('moduleJsonPreview');
        if (!preview) return;
        updateModulePreview();
        preview.classList.toggle('view-hidden');
    }

    function toggleRawReplyChar() {
        const content = document.getElementById('aiRawReplyContentChar');
        const button = document.getElementById('btnToggleRawChar');
        if (!content || !button) return;
        const hidden = content.classList.toggle('view-hidden');
        button.textContent = hidden ? '显示原文' : '隐藏原文';
    }

    function copyRawReply(kind) {
        const content = document.getElementById(`aiRawReplyContent${kind}`)?.textContent || '';
        if (!content) {
            showToast('没有可复制的内容');
            return;
        }
        navigator.clipboard.writeText(content).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
    }

    function setButtonBusy(buttonId, statusId, busy, text) {
        const button = document.getElementById(buttonId);
        const status = document.getElementById(statusId);
        if (button) button.disabled = busy;
        if (button) button.classList.toggle('is-loading', busy);
        if (status) status.classList.toggle('is-loading', busy);
        if (status) status.textContent = text || '';
    }

    function setApiStatus(state, text) {
        const dot = document.getElementById('apiDot');
        const status = document.getElementById('apiStatusText');
        if (dot) dot.className = `api-dot ${state}`.trim();
        if (status) status.textContent = text;
    }

    function getProtagonistPrompt(world) { return aiActions.getProtagonistPrompt(world); }
    function runGeneration(options) { return aiActions.runGeneration(options); }
    function generateWithAI() { return aiActions.generateWithAI(); }
    function generateWorldbookWithAI() { return aiActions.generateWorldbookWithAI(); }

    function bindDraftInputs() {
        ['aiPersona', 'aiWorldPersona', 'aiStoryPersona', 'aiStoryRequest', 'storyBranchTemplate'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', saveAiDrafts);
        });
        document.querySelectorAll('input[name="aiModule"]').forEach(input => {
            input.addEventListener('change', updateModulePreview);
        });
        initWorldModuleHints();
    }

    function initModalClose() {
        document.addEventListener('click', event => {
            if (event.target?.id === 'modal-settings') settingsActions?.closeSettingsModal();
            if (event.target?.id === 'importModal') closeImportModal();
        });
    }

    function initStreamingBridge() {
        window.onAIStreamUpdate = content => {
            aiActions?.handleStreamUpdate(content);
        };
    }

    function initFeatureModules() {
        if (!renderActions) {
            renderActions = window.RenderModule.create({
                DEFAULT_BRANCH_TEMPLATE,
                MODULE_JSON_SCHEMA,
                WORLD_MODULE_CONFIGS,
                enterWorkspace,
                ensureWorldShape,
                escapeHtml,
                getCurrentWorld,
                getWorlds,
                updateWorldModuleHint
            });
        }
        if (!aiActions) {
            aiActions = window.AiWorkflowModule.create({
                MODULE_GUIDE_LABELS,
                MODULE_JSON_SCHEMA,
                WORLD_MODULE_CONFIGS,
                ensureWorldShape,
                getCurrentWorld,
                getSelectedCharModules,
                renderWorldData,
                saveAiDrafts,
                scrollResultIntoView,
                setButtonBusy,
                showToast,
                updateCurrentWorld
            });
        }
        if (!settingsActions) {
            settingsActions = window.SettingsModule.create({
                STORAGE,
                autoSaveWorld,
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
            });
        }
        if (!storyActions) {
            storyActions = window.StoryModule.create({
                DEFAULT_BRANCH_TEMPLATE,
                ensureWorldShape,
                getCurrentWorld,
                getProtagonistPrompt,
                renderWorldData,
                runGeneration,
                showToast,
                switchWorkspacePanel,
                updateCurrentWorld
            });
        }
    }

    function runAction(action, target, event) {
        const handlers = {
            'ai:copy-raw': () => copyRawReply(target.dataset.kind),
            'ai:draft-save': saveAiDrafts,
            'ai:generate-character': generateWithAI,
            'ai:generate-worldbook': generateWorldbookWithAI,
            'ai:json-preview-toggle': toggleJsonPreview,
            'ai:modules-toggle': () => toggleAiModules(target.dataset.mode),
            'ai:raw-char-toggle': toggleRawReplyChar,
            'backup:choose': () => settingsActions.chooseLocalBackup(),
            'backup:export': () => settingsActions.exportLocalBackup(),
            'backup:import': () => settingsActions.importLocalBackup(target),
            'bookshelf:enter': enterBookshelf,
            'cloud:load': () => settingsActions.loadFromCloud(),
            'cloud:save': () => settingsActions.saveToCloud(),
            'home:back': backToHome,
            'import:close': closeImportModal,
            'import:confirm': confirmImport,
            'inspo:add': () => addInspoWord(target.dataset.category),
            'inspo:clear': () => clearInspoPool(target.dataset.category),
            'inspo:deselect': () => deselectInspoWord(target.dataset.category, target.dataset.value),
            'inspo:export': () => exportInspoPool(target.dataset.category),
            'inspo:import-open': () => openImportModal(target.dataset.category),
            'inspo:load-default': () => loadDefaultInspos(target.dataset.category),
            'inspo:remove': () => {
                event.stopPropagation();
                removeInspoWord(target.dataset.category, Number(target.dataset.index), event);
            },
            'inspo:toggle': () => toggleInspoWord(target.dataset.category, Number(target.dataset.index)),
            'protagonist:add': addProtagonist,
            'protagonist:remove': () => removeProtagonist(target.dataset.id),
            'protagonist:update': () => updateProtagonistField(target.dataset.id, target.dataset.field, target.value),
            'settings:api-key-toggle': () => settingsActions.toggleApiKey(),
            'settings:close': () => settingsActions.closeSettingsModal(),
            'settings:models-fetch': () => settingsActions.fetchModels(),
            'settings:open': () => settingsActions.openSettingsModal(),
            'settings:provider-delete': () => settingsActions.deleteProvider(),
            'settings:provider-new': () => settingsActions.newProvider(),
            'settings:provider-rename': () => settingsActions.renameProvider(),
            'settings:provider-save': () => settingsActions.saveCurrentProviderConfig(),
            'settings:provider-switch': () => settingsActions.switchProvider(target.value),
            'settings:font-custom': () => settingsActions.setCustomFont(target.value),
            'settings:font-select': () => settingsActions.setFont(target.value),
            'settings:theme-select': () => settingsActions.setTheme(target.value),
            'settings:theme-toggle': () => settingsActions.toggleTheme(),
            'story:branch-select': () => storyActions.selectStoryBranch(Number(target.dataset.index)),
            'story:branch-template-save': saveStoryBranchTemplate,
            'story:chapter-change': () => storyActions.changeStoryChapter(target.value),
            'story:continue': () => storyActions.continueStoryFromSelectedBranch(),
            'story:copy-current': () => storyActions.copyReaderStory(),
            'story:generate': () => storyActions.generateStoryWithAI(),
            'story:regenerate': () => storyActions.regenerateCurrentChapter(),
            'ui:fold-toggle': () => toggleFoldSection(target.dataset.section),
            'world:create': createNewWorld,
            'world:delete': deleteCurrentWorld,
            'world:rename': renameCurrentWorld,
            'worldbook:save': autoSaveWorld,
            'workspace:switch': () => switchWorkspacePanel(target.dataset.panel)
        };
        handlers[action]?.();
    }

    function bindActionEvents() {
        document.addEventListener('click', event => {
            const target = event.target.closest('[data-action]');
            if (!target) return;
            runAction(target.dataset.action, target, event);
        });
        document.addEventListener('input', event => {
            const target = event.target.closest('[data-input-action]');
            if (!target) return;
            runAction(target.dataset.inputAction, target, event);
        });
        document.addEventListener('change', event => {
            const target = event.target.closest('[data-change-action]');
            if (!target) return;
            runAction(target.dataset.changeAction, target, event);
        });
        document.addEventListener('keydown', event => {
            const target = event.target.closest('[data-keydown-action]');
            if (!target) return;
            if (target.dataset.keydownAction === 'inspo:input-keydown') {
                inspoInputKeydown(event, target.dataset.category);
            }
        });
    }

    function init() {
        initFeatureModules();
        ensureWorldSystem();
        migrateGlobalInspoFromWorlds();
        settingsActions.initAppearanceSettings();
        settingsActions.initCloudUsername();
        settingsActions.ensureProviderSystem();
        initModalClose();
        initStreamingBridge();
        bindActionEvents();
        bindDraftInputs();
        renderBookshelf();
        renderWorldData();
        document.getElementById('page-start')?.classList.remove('page-hidden');
        document.getElementById('page-home')?.classList.add('page-hidden');
        document.getElementById('page-workspace')?.classList.add('page-hidden');
        switchWorkspacePanel('original');
    }

    window.GeneratorApp = {
        showToast,
        getWorlds,
        saveWorlds,
        getCurWorldId: getCurrentWorldId,
        setCurWorldId: setCurrentWorldId,
        renderBookshelf,
        switchWorkspacePanel,
        enterBookshelf,
        backToHome,
        createNewWorld,
        renameCurrentWorld,
        deleteCurrentWorld,
        addNewChapter,
        addProtagonist,
        removeProtagonist,
        updateProtagonistField,
        addInspoWord,
        loadDefaultInspos,
        clearInspoPool,
        toggleInspoWord,
        deselectInspoWord,
        removeInspoWord,
        exportInspoPool,
        openImportModal,
        closeImportModal,
        confirmImport,
        inspoInputKeydown,
        autoSaveWorld,
        saveAiDrafts,
        saveStoryBranchTemplate,
        toggleAiModules,
        toggleFoldSection,
        updateWorldModuleHint,
        toggleJsonPreview,
        toggleRawReplyChar,
        copyRawReply,
        copyReaderStory: (...args) => storyActions?.copyReaderStory(...args),
        generateWithAI,
        generateWorldbookWithAI,
        generateStoryWithAI: (...args) => storyActions?.generateStoryWithAI(...args),
        selectStoryBranch: (...args) => storyActions?.selectStoryBranch(...args),
        changeStoryChapter: (...args) => storyActions?.changeStoryChapter(...args),
        continueStoryFromSelectedBranch: (...args) => storyActions?.continueStoryFromSelectedBranch(...args),
        regenerateCurrentChapter: (...args) => storyActions?.regenerateCurrentChapter(...args),
        loadWorldData: renderWorldData,
        get settings() { return settingsActions; },
        get story() { return storyActions; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
