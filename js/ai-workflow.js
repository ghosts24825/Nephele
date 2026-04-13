const AiWorkflowModule = (function() {
    'use strict';

    function create(deps) {
        const {
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
        } = deps;

        let streamingTarget = null;

    function getProtagonistPrompt(world) {
        return world.protagonists.map(item => [
            `\u3010\u4e3b\u89d2\u3011\uff1a${item.name || '\u672a\u547d\u540d'}`,
            `\u3010\u5c5e\u6027/\u5b9a\u4f4d\u3011\uff1a${item.roleType || '\u672a\u8bbe\u5b9a'}`,
            `\u3010\u8bbe\u5b9a\u7b80\u8ff0\u3011\uff1a${item.summary || '\u6682\u65e0'}`
        ].join("\n")).join("\n\n");
    }

    function collectCharacterText(value, bucket = []) {
        if (value == null) return bucket;
        if (typeof value === 'string') {
            const text = value.trim();
            if (text) bucket.push(text);
            return bucket;
        }
        if (Array.isArray(value)) {
            value.forEach(item => collectCharacterText(item, bucket));
            return bucket;
        }
        if (typeof value === 'object') {
            Object.values(value).forEach(item => collectCharacterText(item, bucket));
        }
        return bucket;
    }

    function inferProtagonistRole(data, fallback = '\u7537\u4e3b\u653b') {
        const gender = String(data?.basic?.gender || '').trim();
        const identityText = collectCharacterText(data?.basic?.identity || []).join(' / ');
        const roleHints = `${gender} ${identityText}`;
        if (/女/.test(roleHints) && /受/.test(roleHints)) return '\u5973\u4e3b\u53d7';
        if (/女/.test(roleHints) && /攻/.test(roleHints)) return '\u5973\u4e3b\u653b';
        if (/男/.test(roleHints) && /受/.test(roleHints)) return '\u7537\u4e3b\u53d7';
        if (/男/.test(roleHints) && /攻/.test(roleHints)) return '\u7537\u4e3b\u653b';
        if (/女/.test(roleHints)) return '\u5973\u4e3b';
        if (/男/.test(roleHints)) return '\u7537\u4e3b';
        return fallback;
    }

    function buildProtagonistSummary(data) {
        const lines = [];
        const pushLine = (label, value) => {
            const parts = collectCharacterText(value);
            if (!parts.length) return;
            lines.push(`${label}\uff1a${parts.join(' / ')}`);
        };
        pushLine('\u5b9a\u4f4d', data?.basic?.identity || data?.basic?.archetype);
        pushLine('\u793e\u4ea4', data?.basic?.social);
        pushLine('\u6027\u683c', data?.personality?.core_traits || data?.personality?.romantic_traits);
        pushLine('\u52a8\u673a', data?.personality?.goals);
        pushLine('\u4e60\u60ef', data?.behavior?.lifestyle || data?.behavior?.work_behaviors);
        pushLine('\u80cc\u666f', data?.background?.current || data?.background?.youth || data?.background?.teenage || data?.background?.childhood);
        pushLine('\u8865\u5145', data?.extra?.additional_notes || data?.extra?.defining_moments || data?.extra?.relationships);
        const summary = lines.join('\n');
        if (summary) return summary;
        const fallback = collectCharacterText(data).slice(0, 6).join(' / ');
        return fallback || '\u6682\u65e0';
    }

    function mapRawCharToProtagonists(rawChar, existing = []) {
        if (!rawChar?.trim()) return existing;
        try {
            const parsed = JSON.parse(rawChar);
            const entries = Object.entries(parsed);
            if (!entries.length) return existing;
            return entries.map(([name, data], index) => {
                const previous = existing[index] || existing.find(item => item.name === name);
                const displayName = data?.basic?.chinese_name || data?.basic?.char_name || name || previous?.name || `\u4e3b\u89d2 ${index + 1}`;
                return {
                    id: previous?.id || generateId(),
                    name: displayName,
                    roleType: previous?.roleType || inferProtagonistRole(data, previous?.roleType || '\u7537\u4e3b\u653b'),
                    summary: buildProtagonistSummary(data)
                };
            });
        } catch {
            return existing;
        }
    }

    function normalizeJsonResponse(content) {
        return content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    function normalizeYamlResponse(content) {
        return content.trim().replace(/^```yaml\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    async function runGeneration({ system, user, outputId, buttonId, statusId, after }) {
        saveAiDrafts();
        if (!window.AIService?.executeGeneration) {
            setButtonBusy(buttonId, statusId, false, 'AI 服务未就绪');
            return null;
        }
        streamingTarget = outputId;
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
            streamingTarget = null;
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
        const preferredWorldbook = world.worldbook || world.ai.rawWorld || '\u6682\u65e0\u4e16\u754c\u4e66';
        const user = [
            `<current_worldbook>\n${preferredWorldbook}\n</current_worldbook>`,
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
                updateCurrentWorld(target => {
                    target.ai.rawChar = normalized;
                    target.ai.openingPersonaCards = normalized;
                });
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
        const modules = Array.from(document.querySelectorAll('input[name="worldModule"]:checked')).map(input => {
            const config = WORLD_MODULE_CONFIGS.find(item => item.key === input.value);
            if (!config) return null;
            const value = document.getElementById(config.textareaId)?.value.trim() || '';
            if (!value) return null;
            return [config.label, value];
        }).filter(Boolean);
        if (!modules.length) {
            showToast('请至少填写一个要扩写的模块要求');
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
                    target.ai.openingWorldbook = normalized;
                });
                renderWorldData();
            }
        });
    }


        function handleStreamUpdate(content) {
            if (!streamingTarget) return;
            const target = document.getElementById(streamingTarget);
            if (target) target.textContent = content;
        }

        return {
            generateWithAI,
            generateWorldbookWithAI,
            getProtagonistPrompt,
            handleStreamUpdate,
            runGeneration
        };
    }

    return { create };
})();

window.AiWorkflowModule = AiWorkflowModule;
