const RenderModule = (function() {
    'use strict';

    function create(deps) {
        const {
            DEFAULT_BRANCH_TEMPLATE,
            MODULE_JSON_SCHEMA,
            WORLD_MODULE_CONFIGS,
            enterWorkspace,
            ensureWorldShape,
            escapeHtml,
            getCurrentWorld,
            getWorlds,
            updateWorldModuleHint
        } = deps;

    function renderBookshelf() {
        const worlds = getWorlds();
        const grid = document.getElementById('bookGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="book-card book-card-new" data-action="world:create">
                <div class="book-card-inner">
                    <div class="book-icon"><svg class="icon-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg></div>
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
                    <div class="book-icon"><svg class="icon-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 5a5 5 0 0 1 7 0v16a5 5 0 0 0-7 0V5Z"></path><path d="M21 5a5 5 0 0 0-7 0v16a5 5 0 0 1 7 0V5Z"></path></svg></div>
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
    }    function renderProtagonists(world) {
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
                '        <button class="btn-header-small btn-danger" type="button" data-action="protagonist:remove" data-id="' + escapeHtml(item.id) + '">\u5220\u9664</button>',
                '    </div>',
                '    <div class="protagonist-card-meta protagonist-card-meta-single">',
                '        <select data-change-action="protagonist:update" data-id="' + escapeHtml(item.id) + '" data-field="roleType">' + options + '</select>',
                '    </div>',
                '    <input type="text" value="' + escapeHtml(item.name || '') + '" placeholder="\u4e3b\u89d2\u59d3\u540d" data-input-action="protagonist:update" data-id="' + escapeHtml(item.id) + '" data-field="name">',
                '    <textarea rows="4" placeholder="\u7b80\u8981\u8bb0\u5f55\u8fd9\u4e2a\u4e3b\u89d2\u7684\u5b9a\u4f4d\u3001\u6027\u683c\u3001\u76ee\u6807\u6216\u5173\u7cfb\u3002" data-input-action="protagonist:update" data-id="' + escapeHtml(item.id) + '" data-field="summary">' + escapeHtml(item.summary || '') + '</textarea>',
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
            <button type="button" class="inspo-tag${selected.includes(item) ? ' selected' : ''}" data-action="inspo:toggle" data-category="${category}" data-index="${index}">
                ${escapeHtml(item)}
                <span class="namer-tag-del" data-action="inspo:remove" data-category="${category}" data-index="${index}">×</span>
            </button>
        `).join('');
    }

    function renderSelectedInspos(world) {
        ensureWorldShape(world);
        const containers = Array.from(document.querySelectorAll('[data-role="selected-inspos"]'));
        if (!containers.length) return;
        const tags = [
            ...world.selected.persona.map(value => ({ type: 'persona', value })),
            ...world.selected.trope.map(value => ({ type: 'trope', value }))
        ];
        const markup = tags.length
            ? tags.map(tag => `
                <span class="current-inspo-tag">
                    ${escapeHtml(tag.value)}
                    <button type="button" data-action="inspo:deselect" data-category="${tag.type}" data-value="${escapeHtml(tag.value)}">×</button>
                </span>
            `).join('')
            : '<span class="current-inspo-empty">暂未选择灵感词条</span>';
        containers.forEach(container => {
            container.innerHTML = markup;
        });
    }

    function renderReader(world) {
        const reader = document.getElementById('readerContent');
        const chapterBanner = document.getElementById('storyChapterBanner');
        const chapterSelect = document.getElementById('storyChapterSelect');
        const continueButton = document.getElementById('btnContinueSelectedBranch');
        const regenerateButton = document.getElementById('btnRegenerateChapter');
        if (!reader) return;
        const entries = Array.isArray(world.ai.chapterEntries) ? world.ai.chapterEntries : [];
        const latestIndex = entries.length ? entries.length - 1 : Math.max((world.chapters?.length || 1) - 1, 0);
        const currentIndex = Math.min(Math.max(world.ai.currentChapterIndex || 0, 0), latestIndex);
        const currentEntry = entries[currentIndex] || null;
        if (chapterBanner) {
            chapterBanner.textContent = currentEntry?.title || (world.chapters?.[currentIndex] || '\u7b2c\u4e00\u7ae0');
        }
        if (chapterSelect) {
            const titles = world.chapters?.length ? world.chapters : ['\u7b2c\u4e00\u7ae0'];
            chapterSelect.innerHTML = titles.map((title, index) => `<option value="${index}" ${index === currentIndex ? 'selected' : ''}>${escapeHtml(title)}</option>`).join('');
        }
        if (regenerateButton) {
            regenerateButton.disabled = currentIndex !== latestIndex;
        }
        if (continueButton) {
            const canContinue = currentIndex === latestIndex && currentEntry?.branches?.length && world.ai.selectedBranch;
            continueButton.disabled = !canContinue;
        }
        if (!currentEntry?.content) {
            reader.innerHTML = '<div class="reader-empty">\u751f\u6210\u540e\u7684\u6545\u4e8b\u4f1a\u663e\u793a\u5728\u8fd9\u91cc</div>';
            return;
        }
        reader.innerHTML = `<div class="reader-story-text">${escapeHtml(currentEntry.content)}</div>`;
    }

    function renderStoryBranches(world) {
        const panel = document.getElementById('storyBranchPanel');
        const list = document.getElementById('storyBranchList');
        const note = document.getElementById('storyBranchHint');
        if (!panel || !list) return;
        const entries = Array.isArray(world.ai.chapterEntries) ? world.ai.chapterEntries : [];
        const latestIndex = entries.length ? entries.length - 1 : 0;
        const currentIndex = Math.min(Math.max(world.ai.currentChapterIndex || 0, 0), latestIndex);
        const currentEntry = entries[currentIndex];
        const branches = Array.isArray(currentEntry?.branches) ? currentEntry.branches : [];
        const selectable = currentIndex === latestIndex;
        if (!branches.length) {
            panel.classList.remove('has-branches');
            list.innerHTML = '';
            if (note) note.textContent = currentIndex === latestIndex ? '\u672c\u7ae0\u6682\u65e0\u53ef\u7ee7\u7eed\u7684\u5267\u60c5\u5206\u652f' : '\u65e7\u7ae0\u4ec5\u4f9b\u9605\u8bfb\uff0c\u4e0d\u53ef\u7ee7\u7eed\u751f\u6210';
            return;
        }
        panel.classList.add('has-branches');
        if (note) note.textContent = selectable ? '\u5148\u9009\u62e9\u4e00\u4e2a\u5206\u652f\uff0c\u518d\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u7ee7\u7eed\u751f\u6210' : '\u65e7\u7ae0\u53ea\u8bfb\u67e5\u770b\uff0c\u53ea\u6709\u5f53\u524d\u6700\u65b0\u7ae0\u53ef\u9009\u62e9\u5206\u652f\u7ee7\u7eed';
        list.innerHTML = branches.map((branch, index) => `
            <button type="button" class="story-branch-btn${world.ai.selectedBranch === branch ? ' active' : ''}" data-action="story:branch-select" data-index="${index}" ${selectable ? '' : 'disabled'}>
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
            container.innerHTML = Object.entries(parsed).map(([name, data], index) => `
                <div class="parsed-char-card">
                    <div class="parsed-char-header">
                        <div class="parsed-char-title">
                            <strong>${escapeHtml(name)}</strong>
                            <span>${escapeHtml((data.basic?.identity || []).join(' / ') || (data.basic?.archetype || []).join(' / ') || '角色卡')}</span>
                        </div>
                        <button class="btn-copy-small" type="button" data-action="ai:copy-character-card" data-index="${index}">复制</button>
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
        const openingPersonaCards = document.getElementById('openingPersonaCards');
        const openingWorldbook = document.getElementById('openingWorldbook');
        if (openingPersonaCards) openingPersonaCards.value = world.ai.openingPersonaCards || '';
        if (openingWorldbook) openingWorldbook.value = world.ai.openingWorldbook || '';
        document.getElementById('storyBranchTemplate').value = world.ai.branchTemplate || DEFAULT_BRANCH_TEMPLATE;
        WORLD_MODULE_CONFIGS.forEach(config => {
            const textarea = document.getElementById(config.textareaId);
            const checkbox = document.querySelector(`input[name="worldModule"][value="${config.key}"]`);
            if (textarea) textarea.value = world.ai.worldModuleDrafts?.[config.key] || '';
            if (checkbox) checkbox.checked = world.ai.worldModuleSelection?.[config.key] !== false;
            updateWorldModuleHint(config.textareaId, config.hintId);
        });
        document.getElementById('aiRawReplyContentChar').textContent = world.ai.rawChar || '';
        document.getElementById('aiRawReplyContentWorld').textContent = world.ai.rawWorld || '';
        document.getElementById('aiRawReplyContentStory').textContent = world.ai.rawStory || '';
        document.getElementById('aiRawReplySectionChar')?.classList.toggle('view-hidden', !world.ai.rawChar);
        document.getElementById('aiRawReplySectionWorld')?.classList.toggle('view-hidden', !world.ai.rawWorld);
        document.getElementById('aiRawReplySectionStory')?.classList.toggle('view-hidden', !world.ai.rawStory);
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


        return {
            getSelectedCharModules,
            renderBookshelf,
            renderParsedCharacterCards,
            renderReader,
            renderSelectedInspos,
            renderStoryBranches,
            renderTagGroup,
            renderWorldData,
            syncTropeTextarea,
            updateModulePreview
        };
    }

    return { create };
})();

window.RenderModule = RenderModule;

