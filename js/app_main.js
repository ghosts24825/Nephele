(() => {
    'use strict';

    const STORAGE = {
        worlds: 'generator_worlds_v4',
        currentWorld: 'generator_current_world_v4',
        theme: 'generator_theme_v1',
        cloudUsername: 'generator_cloud_username_v1',
        globalInspo: 'generator_global_inspo_v1'
    };

    const DEFAULT_BRANCH_TEMPLATE = `你需要生成以<branches></branches>包裹的选项分支，每个选项限制在300字内:

<details>
<summary>𓋫 𓏴𓏴 𓏵‧₊🎮剧情分支₊‧𓏵 𓏴𓏴 𓋫</summary>
<branches>
（每行生成一个选项，一共6个，包含推动剧情向最合理情况发展、剧情转折、将剧情逐渐推向nsfw的选项、快速推进或时间转换的、搞笑/抽象/出乎意料的选项）
</branches>
</details>

说明:
- 行动主体必须写明姓名，采用第三人称，主体可以为不同角色
- 选项必须保持和前文的连贯性，不破坏叙事体验
- 选项不需要加序号、项目符号等
- 输出格式（必须严格执行HTML嵌套）：
  - <branches> 标签必须且只能存在于 <details> 内部
  - 禁止遗漏 <details> 的闭合标签
- 当{{getvar::神秘补丁5}} {{getvar::神秘补丁6}}激活时，遵守相关要求

{{setvar::branches::branches}}`;

    const DEFAULT_INSPO = {
        persona: [],
        trope: [],
        storyKeyword: ['雨夜', '初雪', '意外相遇', '久别重逢', '酒吧', '街角', '失忆', '醉酒', '擦肩而过', '危机', '暗巷', '宴会', '契约', '误会', '争吵', '救美', '被困', '电梯故障', '病房', '相亲', '车祸', '晚宴逃跑', '错认', '停电', '真心话大冒险']
    };

    const MODULE_GUIDE_LABELS = {
        basic: '基础档案',
        background: '成长经历',
        appearance: '外貌造型',
        personality: '性格特质',
        behavior: '行为习惯',
        speech: '说话风格',
        extra: '深层细节',
        nsfw: '成人向信息'
    };

    const MODULE_JSON_SCHEMA = {
        basic: '"basic": {\n      "char_name": "",\n      "chinese_name": "",\n      "nickname": "",\n      "age": "",\n      "birthday_date": "",\n      "birthday_zodiac": "",\n      "gender": "",\n      "height": "",\n      "identity": [],\n      "archetype": [],\n      "social": []\n    }',
        background: '"background": {\n      "childhood_range": "0-12岁",\n      "childhood": [],\n      "teenage_range": "13-18岁",\n      "teenage": [],\n      "youth_range": "19-24岁",\n      "youth": [],\n      "current_range": "",\n      "current": []\n    }',
        appearance: '"appearance": {\n      "hair": "",\n      "eyes": "",\n      "skin": "",\n      "face_style": "",\n      "build": [],\n      "attire_formal": "",\n      "attire_business": "",\n      "attire_casual": "",\n      "attire_home": ""\n    }',
        personality: '"personality": {\n      "core_traits": [],\n      "romantic_traits": [],\n      "weakness": [],\n      "likes": [],\n      "dislikes": [],\n      "goals": []\n    }',
        behavior: '"behavior": {\n      "lifestyle": [],\n      "work_behaviors": [],\n      "emotional_angry": "",\n      "emotional_happy": "",\n      "emotional_sad": "",\n      "boundaries": [],\n      "work_skills": [],\n      "life_skills": [],\n      "hobby_skills": []\n    }',
        speech: '"speech": {\n      "speech_style": "",\n      "speech_reasoning": "",\n      "speech_accent": "",\n      "speech_online": ""\n    }',
        extra: '"extra": {\n      "additional_notes": "",\n      "catchphrases": [],\n      "mannerisms": [],\n      "trauma": [],\n      "values": [],\n      "conflicts": [],\n      "secrets": [],\n      "relationships": [],\n      "defining_moments": []\n    }',
        nsfw: '"nsfw": {\n      "experiences": "",\n      "sexual_organs": "",\n      "sexual_orientation": "",\n      "sexual_role": [],\n      "sexual_habits": [],\n      "kinks": [],\n      "limits": []\n    }'
    };

    let currentImportType = null;
    let currentStreamingTarget = null;
    let currentWorkspacePanel = 'original';

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function createDefaultGlobalInspo() {
        return {
            pools: { persona: [], trope: [], storyKeyword: [] },
            selected: { persona: [], trope: [], storyKeyword: [] }
        };
    }

    function normalizeInspoShape(value) {
        const fallback = createDefaultGlobalInspo();
        const pools = value?.pools || {};
        const selected = value?.selected || {};
        return {
            pools: {
                persona: Array.isArray(pools.persona) ? pools.persona : [],
                trope: Array.isArray(pools.trope) ? pools.trope : [],
                storyKeyword: Array.isArray(pools.storyKeyword) ? pools.storyKeyword : []
            },
            selected: {
                persona: Array.isArray(selected.persona) ? selected.persona : [],
                trope: Array.isArray(selected.trope) ? selected.trope : [],
                storyKeyword: Array.isArray(selected.storyKeyword) ? selected.storyKeyword : []
            }
        };
    }

    function getGlobalInspo() {
        return normalizeInspoShape(readJson(STORAGE.globalInspo, createDefaultGlobalInspo()));
    }

    function saveGlobalInspo(globalInspo) {
        writeJson(STORAGE.globalInspo, normalizeInspoShape(globalInspo));
    }

    function applyGlobalInspoToWorld(world, globalInspo = getGlobalInspo()) {
        const normalized = normalizeInspoShape(globalInspo);
        world.pools = {
            persona: [...normalized.pools.persona],
            trope: [...normalized.pools.trope],
            storyKeyword: [...normalized.pools.storyKeyword]
        };
        world.selected = {
            persona: [...normalized.selected.persona],
            trope: [...normalized.selected.trope],
            storyKeyword: [...normalized.selected.storyKeyword]
        };
    }

    function syncGlobalInspoToAllWorlds(globalInspo = getGlobalInspo()) {
        const worlds = getWorlds();
        Object.values(worlds).forEach(world => {
            ensureWorldShape(world);
            applyGlobalInspoToWorld(world, globalInspo);
        });
        saveWorlds(worlds);
        return worlds;
    }

    function migrateGlobalInspoFromWorlds() {
        const existing = getGlobalInspo();
        const hasExisting = Object.values(existing.pools).some(items => items.length) || Object.values(existing.selected).some(items => items.length);
        if (hasExisting) {
            syncGlobalInspoToAllWorlds(existing);
            return;
        }

        const worlds = getWorlds();
        const merged = createDefaultGlobalInspo();
        Object.values(worlds).forEach(world => {
            ['persona', 'trope', 'storyKeyword'].forEach(category => {
                const poolItems = Array.isArray(world?.pools?.[category]) ? world.pools[category] : [];
                const selectedItems = Array.isArray(world?.selected?.[category]) ? world.selected[category] : [];
                merged.pools[category] = Array.from(new Set([...merged.pools[category], ...poolItems]));
                merged.selected[category] = Array.from(new Set([...merged.selected[category], ...selectedItems]));
            });
        });
        saveGlobalInspo(merged);
        syncGlobalInspoToAllWorlds(merged);
    }

    function updateGlobalInspo(mutator) {
        const globalInspo = getGlobalInspo();
        mutator(globalInspo);
        saveGlobalInspo(globalInspo);
        syncGlobalInspoToAllWorlds(globalInspo);
        return globalInspo;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function generateId() {
        return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function showToast(message, duration = 2200) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        window.setTimeout(() => toast.classList.remove('show'), duration);
    }

    function scrollResultIntoView(outputId) {
        const output = document.getElementById(outputId);
        const resultSection = output?.closest('.ai-raw-reply-section') || output;
        if (!resultSection) return;
        window.setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    }

    function createDefaultWorld(name = '世界 1') {
        return {
            name,
            worldbook: '',
            chapters: ['第一章'],
            protagonists: [],
            pools: { persona: [], trope: [], storyKeyword: [] },
            selected: { persona: [], trope: [], storyKeyword: [] },
            ai: {
                persona: '',
                worldPersona: '',
                storyPersona: '',
                storyRequest: '',
                branchTemplate: DEFAULT_BRANCH_TEMPLATE,
                rawChar: '',
                rawWorld: '',
                rawStory: '',
                renderedStory: '',
                storyHtml: '',
                storyBranchesHtml: '',
                storyBranches: [],
                selectedBranch: '',
                storyHistory: []
            }
        };
    }

    function createDefaultProtagonist(index) {
        return { id: generateId(), name: `\u4e3b\u89d2 ${index}`, roleType: '\u7537\u4e3b\u653b', summary: '' };
    }

    function getWorlds() {
        return readJson(STORAGE.worlds, {});
    }

    function saveWorlds(worlds) {
        writeJson(STORAGE.worlds, worlds);
    }

    function getCurrentWorldId() {
        return localStorage.getItem(STORAGE.currentWorld) || '';
    }

    function setCurrentWorldId(worldId) {
        localStorage.setItem(STORAGE.currentWorld, worldId);
    }

    function getCurrentWorld() {
        return getWorlds()[getCurrentWorldId()] || null;
    }

    function updateCurrentWorld(mutator) {
        const worlds = getWorlds();
        const worldId = getCurrentWorldId();
        const world = worlds[worldId];
        if (!world) return null;
        mutator(world, worlds);
        saveWorlds(worlds);
        return world;
    }

    function ensureWorldSystem() {
        const worlds = getWorlds();
        const ids = Object.keys(worlds);
        if (!ids.length) {
            const worldId = generateId();
            worlds[worldId] = createDefaultWorld();
            applyGlobalInspoToWorld(worlds[worldId]);
            saveWorlds(worlds);
            setCurrentWorldId(worldId);
            return;
        }
        if (!worlds[getCurrentWorldId()]) {
            setCurrentWorldId(ids[0]);
        }
    }

    function ensureWorldShape(world) {
        world.ai ||= {};
        world.ai.branchTemplate ||= DEFAULT_BRANCH_TEMPLATE;
        world.ai.storyHistory ||= [];
        world.ai.storyBranches ||= [];
        world.ai.renderedStory ||= world.ai.rawStory || '';
        world.ai.storyHtml ||= '';
        world.ai.storyBranchesHtml ||= '';
        world.ai.selectedBranch ||= '';
        applyGlobalInspoToWorld(world);
    }

    function normalizeCloudPayload(data) {
        if (data?.worlds) {
            const modernWorlds = parseJsonMaybe(data.worlds, {});
            let mergedWorlds = { ...modernWorlds };
            let currentWorld = data.currentWorld || '';

            if (data?.ss_worlds) {
                const legacyPayload = normalizeCloudPayload({
                    ss_worlds: data.ss_worlds,
                    ss_current_world_v2: data.ss_current_world_v2,
                    ss_current_world: data.ss_current_world,
                    ss_theme_v1: data.ss_theme_v1,
                    globalInspo: data.globalInspo
                });
                const legacyWorlds = parseJsonMaybe(legacyPayload?.worlds, {});
                mergedWorlds = { ...legacyWorlds, ...modernWorlds };
                currentWorld = currentWorld || legacyPayload?.currentWorld || '';
            }

            if (data.globalInspo) {
                try {
                    saveGlobalInspo(typeof data.globalInspo === 'string' ? JSON.parse(data.globalInspo) : data.globalInspo);
                } catch {}
            }
            return {
                worlds: JSON.stringify(mergedWorlds),
                currentWorld: mergedWorlds[currentWorld] ? currentWorld : (Object.keys(mergedWorlds)[0] || ''),
                theme: data?.theme || data?.generator_theme_v1 || data?.ss_theme_v1 || localStorage.getItem(STORAGE.theme) || 'light',
                globalInspo: data?.globalInspo
            };
        }

        function parseJsonMaybe(value, fallback) {
            if (value == null || value === '') return fallback;
            if (typeof value !== 'string') return value;
            try {
                return JSON.parse(value);
            } catch {
                return fallback;
            }
        }

        if (data?.ss_worlds) {
            const legacyWorlds = parseJsonMaybe(data.ss_worlds, {});
            const legacyCurrentWorld =
                data.ss_current_world_v2 ||
                data.ss_current_world ||
                Object.keys(legacyWorlds)[0] ||
                '';
            const normalizedWorlds = {};

            Object.entries(legacyWorlds || {}).forEach(([worldId, legacyWorld]) => {
                const wrappedWorld = createDefaultWorld(legacyWorld?.name || '云端世界');
                wrappedWorld.worldbook = legacyWorld?.worldbook || legacyWorld?.setting || '';
                wrappedWorld.chapters = Array.isArray(legacyWorld?.chapters) && legacyWorld.chapters.length
                    ? legacyWorld.chapters
                    : ['第1章'];
                wrappedWorld.protagonists = Array.isArray(legacyWorld?.protagonists)
                    ? legacyWorld.protagonists.map((item, index) => ({
                        id: item?.id || generateId(),
                        name: item?.name || `主角 ${index + 1}`,
                        roleType: item?.roleType || item?.role || '男主攻',
                        summary: item?.summary || item?.brief || ''
                    }))
                    : [];
                wrappedWorld.pools = {
                    persona: Array.isArray(legacyWorld?.pools?.persona) ? legacyWorld.pools.persona : [],
                    trope: Array.isArray(legacyWorld?.pools?.trope) ? legacyWorld.pools.trope : [],
                    storyKeyword: Array.isArray(legacyWorld?.pools?.storyKeyword) ? legacyWorld.pools.storyKeyword : []
                };
                wrappedWorld.selected = {
                    persona: Array.isArray(legacyWorld?.selected?.persona) ? legacyWorld.selected.persona : [],
                    trope: Array.isArray(legacyWorld?.selected?.trope)
                        ? legacyWorld.selected.trope
                        : (Array.isArray(legacyWorld?.selectedInspos) ? legacyWorld.selectedInspos : []),
                    storyKeyword: Array.isArray(legacyWorld?.selected?.storyKeyword)
                        ? legacyWorld.selected.storyKeyword
                        : (Array.isArray(legacyWorld?.selectedStoryKeywords) ? legacyWorld.selectedStoryKeywords : [])
                };
                wrappedWorld.ai = { ...wrappedWorld.ai, ...(legacyWorld?.ai || {}) };
                ensureWorldShape(wrappedWorld);
                normalizedWorlds[worldId] = wrappedWorld;
            });

            return {
                worlds: JSON.stringify(normalizedWorlds),
                currentWorld: normalizedWorlds[legacyCurrentWorld] ? legacyCurrentWorld : (Object.keys(normalizedWorlds)[0] || ''),
                theme: data?.theme || data?.generator_theme_v1 || data?.ss_theme_v1 || localStorage.getItem(STORAGE.theme) || 'light',
                globalInspo: data?.globalInspo
            };
        }

        const worldId = generateId();
        const wrappedWorld = createDefaultWorld(data?.name || '云端导入世界');
        wrappedWorld.worldbook = data?.worldbook || '';
        wrappedWorld.chapters = Array.isArray(data?.chapters) && data.chapters.length ? data.chapters : ['第一章'];
        wrappedWorld.protagonists = Array.isArray(data?.protagonists) ? data.protagonists : [];
        wrappedWorld.pools = data?.pools || wrappedWorld.pools;
        wrappedWorld.selected = data?.selected || wrappedWorld.selected;
        wrappedWorld.ai = { ...wrappedWorld.ai, ...(data?.ai || {}) };
        ensureWorldShape(wrappedWorld);

        return {
            worlds: JSON.stringify({ [worldId]: wrappedWorld }),
            currentWorld: worldId,
            theme: data?.theme || localStorage.getItem(STORAGE.theme) || 'light',
            globalInspo: data?.globalInspo
        };
    }

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
        document.getElementById('panel-ai')?.classList.toggle('view-hidden', panel !== 'ai');
        document.getElementById('panel-story')?.classList.toggle('view-hidden', panel !== 'story');
        const navOriginal = document.getElementById('nav-original');
        const navAi = document.getElementById('nav-ai');
        const navStory = document.getElementById('nav-story');
        navOriginal?.classList.toggle('active', panel === 'original');
        navAi?.classList.toggle('active', panel === 'ai');
        navStory?.classList.toggle('active', panel === 'story');

        if (window.matchMedia?.('(max-width: 992px)').matches) {
            const activeNav = panel === 'original' ? navOriginal : (panel === 'ai' ? navAi : navStory);
            activeNav?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    function getSupabaseApi() {
        return typeof SupabaseClient !== 'undefined' ? SupabaseClient : window.SupabaseClient;
    }

    function renderBookshelf() {
        const worlds = getWorlds();
        const grid = document.getElementById('bookGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="book-card book-card-new" onclick="createNewWorld()">
                <div class="book-card-inner">
                    <div class="book-icon">＋</div>
                    <div class="book-title">新建世界</div>
                </div>
            </div>
        `;

        Object.entries(worlds).forEach(([worldId, world]) => {
            ensureWorldShape(world);
            const card = document.createElement('div');
            card.className = 'book-card';
            card.innerHTML = `
                <div class="book-card-inner">
                    <div class="book-icon">📘</div>
                    <div class="book-title">${escapeHtml(world.name)}</div>
                    <div class="book-meta">
                        <div class="book-stats">
                            <span class="book-stat">主角 ${world.protagonists.length}</span>
                            <span class="book-stat">章节 ${world.chapters.length}</span>
                        </div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => enterWorkspace(worldId));
            grid.appendChild(card);
        });
    }

    function renderChapterList(world) {
        const container = document.getElementById('chapterList');
        if (!container) return;
        container.innerHTML = world.chapters.length
            ? world.chapters.map((chapter, index) => `<div class="chapter-item">${index + 1}. ${escapeHtml(chapter)}</div>`).join('')
            : '<div class="chapter-item">暂无章节</div>';
    }

    function renderProtagonists(world) {
        const container = document.getElementById('protagonistsContainer');
        if (!container) return;
        const roleOptions = ['\u7537\u4e3b\u653b', '\u7537\u4e3b\u53d7', '\u5973\u4e3b\u653b', '\u5973\u4e3b\u53d7', '\u7537\u4e3b', '\u5973\u4e3b'];
        if (!world.protagonists.length) {
            container.innerHTML = '<div class="reader-empty">\u6682\u65e0\u4e3b\u89d2\uff0c\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u6dfb\u52a0\u3002</div>';
            return;
        }

        container.innerHTML = world.protagonists.map((item, index) => {
            const options = roleOptions.map(option => '<option value="' + option + '" ' + (item.roleType === option ? 'selected' : '') + '>' + option + '</option>').join('');

            return [
                '<div class="protagonist-card">',
                '    <div class="protagonist-card-header">',
                '        <strong>\u4e3b\u89d2 ' + (index + 1) + '</strong>',
                '        <button class="btn-header-small btn-danger" type="button" onclick="removeProtagonist(\'' + item.id + '\')">\u5220\u9664</button>',
                '    </div>',
                '    <div class="protagonist-card-meta protagonist-card-meta-single">',
                '        <select onchange="updateProtagonistField(\'' + item.id + '\', \'roleType\', this.value)">' + options + '</select>',
                '    </div>',
                '    <input type="text" value="' + escapeHtml(item.name || '') + '" placeholder="\u4e3b\u89d2\u59d3\u540d" oninput="updateProtagonistField(\'' + item.id + '\', \'name\', this.value)">',
                '    <textarea rows="4" placeholder="\u7b80\u8981\u8bb0\u5f55\u8fd9\u4e2a\u4e3b\u89d2\u7684\u5b9a\u4f4d\u3001\u6027\u683c\u3001\u76ee\u6807\u6216\u5173\u7cfb\u3002" oninput="updateProtagonistField(\'' + item.id + '\', \'summary\', this.value)">' + escapeHtml(item.summary || '') + '</textarea>',
                '</div>'
            ].join('');
        }).join('');
    }

    function renderTagGroup(category, items, selected) {
        const containerId = { persona: 'personaTags', trope: 'tropeTags', storyKeyword: 'storyKeywordTags' }[category];
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!items.length) {
            container.innerHTML = '<span class="current-inspo-empty">暂无词条</span>';
            return;
        }
        container.innerHTML = items.map((item, index) => `
            <button type="button" class="inspo-tag${selected.includes(item) ? ' selected' : ''}" onclick="toggleInspoWord('${category}', ${index})">
                ${escapeHtml(item)}
                <span class="namer-tag-del" onclick="removeInspoWord('${category}', ${index}, event)">×</span>
            </button>
        `).join('');
    }

    function renderSelectedInspos(world) {
        ensureWorldShape(world);
        const container = document.getElementById('currentInspoTags');
        if (!container) return;
        const tags = [
            ...world.selected.persona.map(value => ({ type: 'persona', value })),
            ...world.selected.trope.map(value => ({ type: 'trope', value }))
        ];
        container.innerHTML = tags.length
            ? tags.map(tag => `
                <span class="current-inspo-tag">
                    ${escapeHtml(tag.value)}
                    <button type="button" onclick="deselectInspoWord('${tag.type}', decodeURIComponent('${encodeURIComponent(tag.value)}'))">×</button>
                </span>
            `).join('')
            : '<span class="current-inspo-empty">暂未选择灵感词条</span>';
    }

    function renderReader(world) {
        const reader = document.getElementById('readerContent');
        const chapterBanner = document.getElementById('storyChapterBanner');
        if (!reader) return;
        if (chapterBanner) {
            chapterBanner.textContent = world.chapters?.length ? world.chapters[world.chapters.length - 1] : '\u7b2c\u4e00\u7ae0';
        }
        if (!world.ai.renderedStory) {
            reader.innerHTML = '<div class="reader-empty">\u751f\u6210\u540e\u7684\u6545\u4e8b\u4f1a\u663e\u793a\u5728\u8fd9\u91cc</div>';
            return;
        }
        reader.innerHTML = `<div class="reader-story-text">${escapeHtml(world.ai.renderedStory)}</div>`;
    }

    function renderStoryBranches(world) {
        const panel = document.getElementById('storyBranchPanel');
        const list = document.getElementById('storyBranchList');
        if (!panel || !list) return;
        if (!world.ai.storyBranches.length) {
            panel.classList.remove('has-branches');
            list.innerHTML = '';
            return;
        }
        panel.classList.add('has-branches');
        list.innerHTML = world.ai.storyBranches.map((branch, index) => `
            <button type="button" class="story-branch-btn${world.ai.selectedBranch === branch ? ' active' : ''}" onclick="selectStoryBranch(${index})">
                ${escapeHtml(branch)}
            </button>
        `).join('');
    }

    function renderParsedCharacterCards(world) {
        const container = document.getElementById('aiParsedCardsChar');
        if (!container) return;
        const raw = world.ai.rawChar?.trim();
        if (!raw) {
            container.innerHTML = '';
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            container.innerHTML = Object.entries(parsed).map(([name, data]) => `
                <div class="parsed-char-card">
                    <div class="parsed-char-header">
                        <strong>${escapeHtml(name)}</strong>
                        <span>${escapeHtml((data.basic?.identity || []).join(' / ') || (data.basic?.archetype || []).join(' / ') || '角色卡')}</span>
                    </div>
                    <div class="parsed-char-body">
                        <div class="parsed-char-summary">
                            <div class="parsed-char-field"><strong>人物关键词</strong><span>${escapeHtml(world.selected.persona.join(' / ') || '未附带')}</span></div>
                            <div class="parsed-char-field"><strong>剧情关键词</strong><span>${escapeHtml(world.selected.trope.join(' / ') || '未附带')}</span></div>
                        </div>
                        <div class="parsed-char-full">${escapeHtml(JSON.stringify(data, null, 2))}</div>
                    </div>
                </div>
            `).join('');
        } catch {
            container.innerHTML = `<div class="parsed-char-card"><div class="parsed-char-header"><strong>原始输出</strong><span>未解析</span></div><div class="parsed-char-body"><div class="parsed-char-full">${escapeHtml(raw)}</div></div></div>`;
        }
    }

    function syncTropeTextarea(world) {
        const textarea = document.getElementById('aiTrope');
        if (textarea) textarea.value = world.selected.trope.join('、');
    }

    function getSelectedCharModules() {
        return Array.from(document.querySelectorAll('input[name="aiModule"]:checked')).map(input => input.value);
    }

    function updateModulePreview() {
        const preview = document.getElementById('moduleJsonPreview');
        if (!preview) return;
        const modules = getSelectedCharModules();
        preview.textContent = `{\n  "该主角的名字": {\n${modules.map(module => `    ${MODULE_JSON_SCHEMA[module]}`).join(',\n')}\n  }\n}`;
    }

    function renderWorldData() {
        const world = getCurrentWorld();
        if (!world) return;
        ensureWorldShape(world);
        document.getElementById('workspaceTitle').textContent = world.name;
        document.getElementById('worldWorldbook').value = world.worldbook || '';
        document.getElementById('aiPersona').value = world.ai.persona || document.getElementById('aiPersona').value;
        document.getElementById('aiWorldPersona').value = world.ai.worldPersona || document.getElementById('aiWorldPersona').value;
        document.getElementById('aiStoryPersona').value = world.ai.storyPersona || document.getElementById('aiStoryPersona').value;
        document.getElementById('aiStoryRequest').value = world.ai.storyRequest || document.getElementById('aiStoryRequest').value;
        document.getElementById('storyBranchTemplate').value = world.ai.branchTemplate || DEFAULT_BRANCH_TEMPLATE;
        document.getElementById('aiRawReplyContentChar').textContent = world.ai.rawChar || '';
        document.getElementById('aiRawReplyContentWorld').textContent = world.ai.rawWorld || '';
        document.getElementById('aiRawReplyContentStory').textContent = world.ai.rawStory || '';
        document.getElementById('aiRawReplySectionChar')?.classList.toggle('view-hidden', !world.ai.rawChar);
        document.getElementById('aiRawReplySectionWorld')?.classList.toggle('view-hidden', !world.ai.rawWorld);
        document.getElementById('aiRawReplySectionStory')?.classList.toggle('view-hidden', !world.ai.rawStory);
        renderChapterList(world);
        renderProtagonists(world);
        renderTagGroup('persona', world.pools.persona, world.selected.persona);
        renderTagGroup('trope', world.pools.trope, world.selected.trope);
        renderTagGroup('storyKeyword', world.pools.storyKeyword, world.selected.storyKeyword);
        renderSelectedInspos(world);
        syncTropeTextarea(world);
        renderParsedCharacterCards(world);
        updateModulePreview();
        renderReader(world);
        renderStoryBranches(world);
    }

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
        const worlds = getWorlds();
        const worldId = generateId();
        worlds[worldId] = createDefaultWorld(name);
        applyGlobalInspoToWorld(worlds[worldId]);
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
            world.ai.branchTemplate = document.getElementById('storyBranchTemplate')?.value || DEFAULT_BRANCH_TEMPLATE;
        });
    }

    function saveStoryBranchTemplate() {
        saveAiDrafts();
    }

    function toggleAiModules(mode) {
        const container = document.getElementById(mode === 'world' ? 'aiWorldModulesContainer' : 'aiCharModulesContainer');
        const arrow = document.getElementById(mode === 'world' ? 'aiWorldModulesToggleArrow' : 'aiCharModulesToggleArrow');
        if (!container || !arrow) return;
        const hidden = container.style.display === 'none';
        container.style.display = hidden ? '' : 'none';
        arrow.textContent = hidden ? '▼' : '▶';
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

    function copyReaderStory() {
        const world = getCurrentWorld();
        if (!world?.ai.renderedStory) {
            showToast('没有可复制的故事');
            return;
        }
        navigator.clipboard.writeText(world.ai.renderedStory).then(() => showToast('已复制正文')).catch(() => showToast('复制失败'));
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
        document.getElementById('modelList').innerHTML = '';
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

    function getProtagonistPrompt(world) {
        return world.protagonists.map(item => [
            `\u3010\u4e3b\u89d2\u3011\uff1a${item.name || '\u672a\u547d\u540d'}`,
            `\u3010\u5c5e\u6027/\u5b9a\u4f4d\u3011\uff1a${item.roleType || '\u672a\u8bbe\u5b9a'}`,
            `\u3010\u8bbe\u5b9a\u7b80\u8ff0\u3011\uff1a${item.summary || '\u6682\u65e0'}`
        ].join("\n")).join("\n\n");
    }

    function normalizeJsonResponse(content) {
        return content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    function normalizeYamlResponse(content) {
        return content.trim().replace(/^```yaml\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    function normalizeStoryResponse(content) {
        return content.trim().replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    function parseStoryResponse(content) {
        const normalized = normalizeStoryResponse(content);
        const storyMatch = normalized.match(/<story>([\s\S]*?)<\/story>/i);
        const detailsMatch = normalized.match(/<details>[\s\S]*?<\/details>/i);
        const branchesMatch = normalized.match(/<branches>([\s\S]*?)<\/branches>/i);
        const story = storyMatch ? storyMatch[1].trim() : normalized.replace(/<details>[\s\S]*<\/details>/i, '').trim();
        const branchesHtml = detailsMatch ? detailsMatch[0].trim() : '';
        const branches = branchesMatch
            ? branchesMatch[1].split(/\r?\n/).map(line => line.replace(/^[\s\-•\d.]+/, '').trim()).filter(Boolean)
            : [];
        return { raw: normalized, story, branchesHtml, branches };
    }

    async function runGeneration({ system, user, outputId, buttonId, statusId, after }) {
        saveAiDrafts();
        if (!window.AIService?.executeGeneration) {
            setButtonBusy(buttonId, statusId, false, 'AI 服务未就绪');
            return null;
        }
        currentStreamingTarget = outputId;
        const output = document.getElementById(outputId);
        if (output) output.textContent = '';
        setButtonBusy(buttonId, statusId, true, '生成中...');
        try {
            const content = await window.AIService.executeGeneration(system, user, {
                stream: document.getElementById('enableStream')?.checked !== false
            });
            if (output) output.textContent = content;
            if (after) after(content);
            setButtonBusy(buttonId, statusId, false, '生成完成');
            scrollResultIntoView(outputId);
            return content;
        } catch (error) {
            setButtonBusy(buttonId, statusId, false, error.message || '生成失败');
            return null;
        } finally {
            currentStreamingTarget = null;
        }
    }

    async function generateWithAI() {
        const world = getCurrentWorld();
        if (!world?.protagonists.length) {
            showToast('请先添加至少一个主角');
            return;
        }
        const modules = getSelectedCharModules();
        if (!modules.length) {
            showToast('请至少勾选一个详细模块');
            return;
        }
        const guides = modules.map(module => `【${MODULE_GUIDE_LABELS[module]}】\n${document.getElementById(`guide_${module}`)?.value || ''}`).join('\n\n');
        const schemaStr = `{\n  "该主角的名字": {\n${modules.map(module => `    ${MODULE_JSON_SCHEMA[module]}`).join(',\n')}\n  }\n}`;
        const tropeText = document.getElementById('sendTropeToAi')?.checked ? world.selected.trope.join('、') : '';
        const system = `<persona>\n${document.getElementById('aiPersona')?.value || ''}\n</persona>`;
        const user = [
            `<generated_worldbook>\n${world.ai.rawWorld || world.worldbook || '暂无世界书'}\n</generated_worldbook>`,
            `<original_protagonists>\n${getProtagonistPrompt(world)}\n</original_protagonists>`,
            `<persona_keywords>\n${world.selected.persona.join('、') || '未选择'}\n</persona_keywords>`,
            tropeText ? `<global_trope>\n${tropeText}\n</global_trope>` : '',
            `<module_guides>\n${guides}\n</module_guides>`,
            `<instructions>\n请参考 AI 生成的世界书、现有主角设定和灵感池，为每一位主角生成详细的人设卡。\n你需要将每一个主角的数据放到同一个 JSON 对象中，使用各自的名字作为顶级键名。\n请严格按照以下 JSON 结构返回，不要输出 Markdown 或额外说明：\n${schemaStr}\n</instructions>`
        ].filter(Boolean).join('\n\n');
        await runGeneration({
            system,
            user,
            outputId: 'aiRawReplyContentChar',
            buttonId: 'btnGenerateChar',
            statusId: 'aiStatusTextChar',
            after: raw => {
                const normalized = normalizeJsonResponse(raw);
                updateCurrentWorld(target => { target.ai.rawChar = normalized; });
                renderWorldData();
            }
        });
    }

    async function generateWorldbookWithAI() {
        const world = getCurrentWorld();
        if (!world?.protagonists.length) {
            showToast('请先添加至少一个主角');
            return;
        }
        const modules = [
            ['时代背景', document.getElementById('wb_era_background')?.value || ''],
            ['特殊设定', document.getElementById('wb_special_settings')?.value || ''],
            ['重要配角', document.getElementById('wb_npcs')?.value || ''],
            ['人设修正', document.getElementById('wb_persona_correction')?.value || ''],
            ['额外补充', document.getElementById('wb_extra')?.value || '']
        ].filter(([, value]) => value.trim());
        if (!modules.length) {
            showToast('请至少填写一个世界书模块');
            return;
        }
        const tropeText = document.getElementById('sendTropeToWorld')?.checked ? world.selected.trope.join('、') : '';
        const system = `<persona>\n${document.getElementById('aiWorldPersona')?.value || ''}\n</persona>`;
        const user = [
            `<current_worldbook>\n${world.worldbook || '暂无'}\n</current_worldbook>`,
            `<protagonists>\n${getProtagonistPrompt(world)}\n</protagonists>`,
            `<persona_keywords>\n${world.selected.persona.join('、') || '未选择'}\n</persona_keywords>`,
            tropeText ? `<global_trope>\n${tropeText}\n</global_trope>` : '',
            `<world_modules>\n${modules.map(([label, value]) => `【${label}】\n${value}`).join('\n\n')}\n</world_modules>`,
            `<instructions>\n请参考主角设定、人物关键词池和剧情关键词池，生成适合小说创作的世界书。\n请严格只输出 YAML，不要输出 Markdown 代码块，不要附加解释文字。\n输出结构示例：\nworldbook:\n  era_background: |\n    ...\n  special_settings: |\n    ...\n  npcs: |\n    ...\n  persona_correction: |\n    ...\n  extra: |\n    ...\n</instructions>`
        ].filter(Boolean).join('\n\n');
        await runGeneration({
            system,
            user,
            outputId: 'aiRawReplyContentWorld',
            buttonId: 'btnGenerateWorld',
            statusId: 'aiStatusTextWorld',
            after: raw => {
                const normalized = normalizeYamlResponse(raw);
                updateCurrentWorld(target => {
                    target.ai.rawWorld = normalized;
                    target.worldbook = normalized;
                });
                renderWorldData();
            }
        });
    }

    function buildStoryPrompt(world, isContinuation) {
        const branchTemplate = world.ai.branchTemplate || DEFAULT_BRANCH_TEMPLATE;
        const selectedBranch = world.ai.selectedBranch || '未选择分支，由你自然续接剧情';
        const storyKeywords = world.selected.storyKeyword.join('、') || '未选择';
        const tropeText = document.getElementById('sendTropeToStory')?.checked ? world.selected.trope.join('、') : '';
        const charJson = world.ai.rawChar || '暂无 AI 人设卡';
        const storyContext = world.ai.renderedStory || '暂无已生成正文';
        return [
            `<generated_worldbook>\n${world.ai.rawWorld || world.worldbook || '暂无世界书'}\n</generated_worldbook>`,
            `<generated_character_cards>\n${charJson}\n</generated_character_cards>`,
            `<original_protagonists>\n${getProtagonistPrompt(world)}\n</original_protagonists>`,
            `<story_keywords>\n${storyKeywords}\n</story_keywords>`,
            tropeText ? `<global_trope>\n${tropeText}\n</global_trope>` : '',
            isContinuation ? `<existing_story>\n${storyContext}\n</existing_story>` : '',
            isContinuation ? `<selected_branch>\n${selectedBranch}\n</selected_branch>` : '',
            `<branch_template>\n${branchTemplate}\n</branch_template>`,
            `<request>\n${document.getElementById('aiStoryRequest')?.value || ''}\n</request>`,
            `<instructions>\n${isContinuation ? '请结合已有故事、所选分支、世界书、人设卡和关键词继续生成后续正文。' : '请结合世界书、人设卡、主角设定和故事关键词生成故事开头。'}\n输出必须严格使用以下结构：\n<story>\n故事正文\n</story>\n<details>\n<summary>保留或重写标题均可</summary>\n<branches>\n每行一个分支选项，共 6 行\n</branches>\n</details>\n分支内容必须遵守 branch_template 中的全部要求。\n</instructions>`
        ].filter(Boolean).join('\n\n');
    }

    async function generateStoryWithAI() {
        const world = getCurrentWorld();
        if (!world?.protagonists.length) {
            showToast('请先添加至少一个主角');
            return;
        }
        if (!world.ai.rawWorld && !world.worldbook) {
            showToast('请先生成或填写世界书');
            return;
        }
        if (!world.ai.rawChar) {
            showToast('请先生成人设卡');
            return;
        }
        const request = document.getElementById('aiStoryRequest')?.value.trim() || '';
        if (!request) {
            showToast('请填写故事开头要求');
            return;
        }
        const isContinuation = Boolean(world.ai.renderedStory && world.ai.selectedBranch);
        const system = `<persona>\n${document.getElementById('aiStoryPersona')?.value || ''}\n</persona>`;
        const user = buildStoryPrompt(world, isContinuation);
        await runGeneration({
            system,
            user,
            outputId: 'aiRawReplyContentStory',
            buttonId: 'btnGenerateStory',
            statusId: 'aiStoryStatusText',
            after: raw => {
                const parsed = parseStoryResponse(raw);
                updateCurrentWorld(target => {
                    ensureWorldShape(target);
                    target.ai.rawStory = parsed.raw;
                    target.ai.renderedStory = isContinuation ? `${target.ai.renderedStory}\n\n${parsed.story}`.trim() : parsed.story;
                    target.ai.storyHtml = parsed.story;
                    target.ai.storyBranchesHtml = parsed.branchesHtml;
                    target.ai.storyBranches = parsed.branches;
                    if (isContinuation) {
                        target.ai.storyHistory.push({ branch: target.ai.selectedBranch, appended: parsed.story });
                    }
                    target.ai.selectedBranch = '';
                });
                renderWorldData();
            }
        });
    }

    function selectStoryBranch(index) {
        const world = getCurrentWorld();
        if (!world?.ai.storyBranches?.[index]) return;
        const nextChapterNumber = (world.chapters?.length || 0) + 1;
        const nextChapterName = '\u7b2c' + nextChapterNumber + '\u7ae0';
        updateCurrentWorld(target => {
            target.ai.selectedBranch = target.ai.storyBranches[index];
            target.chapters ||= [];
            target.chapters.push(nextChapterName);
        });
        switchWorkspacePanel('story');
        renderWorldData();
        showToast('\u5df2\u9009\u62e9\u5267\u60c5\u5206\u652f\uff0c\u6b63\u5728\u751f\u6210' + nextChapterName);
        generateStoryWithAI();
    }

    async function saveToCloud() {
        const username = getCloudUsernameInput()?.value.trim();
        const statusNode = getSyncStatusNode();
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
            if (data.globalInspo) {
                try {
                    saveGlobalInspo(typeof data.globalInspo === 'string' ? JSON.parse(data.globalInspo) : data.globalInspo);
                } catch {}
            }
            localStorage.setItem(STORAGE.cloudUsername, username);
            ensureWorldSystem();
            migrateGlobalInspoFromWorlds();
            applyTheme();
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
    }

    function toggleTheme() {
        const theme = document.getElementById('checkbox')?.checked ? 'dark' : 'light';
        localStorage.setItem(STORAGE.theme, theme);
        applyTheme();
    }

    function openSettingsModal() {
        document.getElementById('modal-settings')?.classList.add('active');
    }

    function closeSettingsModal() {
        document.getElementById('modal-settings')?.classList.remove('active');
    }

    function getCloudUsernameInput() {
        return document.querySelector('#modal-settings #cloudUsername') || document.getElementById('cloudUsername');
    }

    function getSyncStatusNode() {
        return document.querySelector('#modal-settings #syncStatus') || document.getElementById('syncStatus');
    }

    function initCloudUsername() {
        const input = getCloudUsernameInput();
        if (input) input.value = localStorage.getItem(STORAGE.cloudUsername) || '';
    }

    function bindDraftInputs() {
        ['aiPersona', 'aiWorldPersona', 'aiStoryPersona', 'aiStoryRequest', 'storyBranchTemplate'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', saveAiDrafts);
        });
        document.querySelectorAll('input[name="aiModule"]').forEach(input => {
            input.addEventListener('change', updateModulePreview);
        });
    }

    function initModalClose() {
        document.addEventListener('click', event => {
            if (event.target?.id === 'modal-settings') closeSettingsModal();
            if (event.target?.id === 'importModal') closeImportModal();
        });
    }

    function initStreamingBridge() {
        window.onAIStreamUpdate = content => {
            if (!currentStreamingTarget) return;
            const target = document.getElementById(currentStreamingTarget);
            if (target) target.textContent = content;
        };
    }

    function init() {
        ensureWorldSystem();
        migrateGlobalInspoFromWorlds();
        applyTheme();
        initCloudUsername();
        ensureProviderSystem();
        initModalClose();
        initStreamingBridge();
        bindDraftInputs();
        renderBookshelf();
        renderWorldData();
        document.getElementById('page-start')?.classList.remove('page-hidden');
        document.getElementById('page-home')?.classList.add('page-hidden');
        document.getElementById('page-workspace')?.classList.add('page-hidden');
        switchWorkspacePanel('original');
    }

    Object.assign(window, {
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
        saveStoryBranchTemplate,
        toggleAiModules,
        toggleJsonPreview,
        toggleRawReplyChar,
        copyRawReply,
        copyReaderStory,
        generateWithAI,
        generateWorldbookWithAI,
        generateStoryWithAI,
        selectStoryBranch,
        openSettingsModal,
        closeSettingsModal,
        toggleTheme,
        saveToCloud,
        loadFromCloud,
        switchProvider,
        saveCurrentProviderConfig,
        newProvider,
        renameProvider,
        deleteProvider,
        toggleApiKey,
        fetchModels,
        loadWorldData: renderWorldData
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
