const StateModule = (function() {
    'use strict';

    const STORAGE = {
        worlds: 'generator_worlds_v4',
        currentWorld: 'generator_current_world_v4',
        theme: 'generator_theme_v1',
        font: 'generator_font_v1',
        customFont: 'generator_custom_font_v1',
        cloudUsername: 'generator_cloud_username_v1',
        globalInspo: 'generator_global_inspo_v1'
    };

    const DEFAULT_BRANCH_TEMPLATE = `你需要生成以<branches></branches>包裹的选项分支，每个选项限制在300字内:

<details>
<summary>剧情分支</summary>
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

    const WORLD_MODULE_CONFIGS = [
        {
            key: 'era_background',
            textareaId: 'wb_era_background',
            label: '时代背景',
            hintId: 'wb_era_background_hint',
            defaultHint: '请明确小世界所处的时代、社会环境、发展水平与整体氛围。'
        },
        {
            key: 'special_settings',
            textareaId: 'wb_special_settings',
            label: '特殊设定',
            hintId: 'wb_special_settings_hint',
            defaultHint: '请补充这个世界独有的规则、力量体系、文化习俗、限制条件或隐藏机制。'
        },
        {
            key: 'npcs',
            textareaId: 'wb_npcs',
            label: '重要配角',
            hintId: 'wb_npcs_hint',
            defaultHint: '请规划与主角关系密切、能推动剧情的重要角色或势力。'
        },
        {
            key: 'persona_correction',
            textareaId: 'wb_persona_correction',
            label: '人设修正',
            hintId: 'wb_persona_correction_hint',
            defaultHint: '如果主角设定与世界存在冲突，请在这里提示 AI 做兼容与补强。'
        },
        {
            key: 'extra',
            textareaId: 'wb_extra',
            label: '额外补充',
            hintId: 'wb_extra_hint',
            defaultHint: '补充任何你希望世界书额外覆盖的写作重点、主题或氛围要求。'
        }
    ];

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
                openingPersonaCards: '',
                openingWorldbook: '',
                branchTemplate: DEFAULT_BRANCH_TEMPLATE,
                rawChar: '',
                rawWorld: '',
                rawStory: '',
                renderedStory: '',
                storyHtml: '',
                storyBranchesHtml: '',
                storyBranches: [],
                chapterEntries: [],
                currentChapterIndex: 0,
                selectedBranch: '',
                storyHistory: [],
                worldModuleDrafts: {},
                worldModuleSelection: {}
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
        world.ai.openingPersonaCards ||= '';
        world.ai.openingWorldbook ||= '';
        world.ai.storyHistory ||= [];
        world.ai.storyBranches ||= [];
        world.ai.chapterEntries ||= [];
        world.ai.currentChapterIndex = Number.isInteger(world.ai.currentChapterIndex) ? world.ai.currentChapterIndex : Math.max((world.chapters?.length || 1) - 1, 0);
        world.ai.renderedStory ||= world.ai.rawStory || '';
        world.ai.storyHtml ||= '';
        world.ai.storyBranchesHtml ||= '';
        world.ai.selectedBranch ||= '';
        world.ai.worldModuleDrafts ||= {};
        world.ai.worldModuleSelection ||= {};
        if (!world.ai.chapterEntries.length && world.ai.renderedStory) {
            const title = world.chapters?.length ? world.chapters[world.chapters.length - 1] : '\u7b2c\u4e00\u7ae0';
            world.ai.chapterEntries.push({
                title,
                content: world.ai.renderedStory,
                branches: Array.isArray(world.ai.storyBranches) ? [...world.ai.storyBranches] : [],
                sourceBranch: ''
            });
        }
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
                font: data?.font || data?.generator_font_v1 || localStorage.getItem(STORAGE.font) || 'system',
                customFont: data?.customFont || data?.generator_custom_font_v1 || localStorage.getItem(STORAGE.customFont) || '',
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


    return {
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
        syncGlobalInspoToAllWorlds,
        updateCurrentWorld,
        updateGlobalInspo,
        writeJson
    };
})();

window.StateModule = StateModule;
