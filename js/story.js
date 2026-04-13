const StoryModule = (function() {
    'use strict';

    function create(deps) {
        const {
            DEFAULT_BRANCH_TEMPLATE,
            ensureWorldShape,
            getCurrentWorld,
            getProtagonistPrompt,
            renderWorldData,
            runGeneration,
            showToast,
            switchWorkspacePanel,
            updateCurrentWorld
        } = deps;

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

        function buildStoryPrompt(world, isContinuation) {
            const branchTemplate = world.ai.branchTemplate || DEFAULT_BRANCH_TEMPLATE;
            const preferredWorldbook = world.ai.openingWorldbook || world.ai.rawWorld || world.worldbook || '暂无世界书';
            const protagonistsFormal = world.ai.openingPersonaCards || world.ai.rawChar || getProtagonistPrompt(world) || '暂无主角设定';
            const selectedBranch = world.ai.selectedBranch || '未选择分支，由你自然续接剧情';
            const storyKeywords = world.selected.storyKeyword.join('、') || '未选择';
            const tropeText = document.getElementById('sendTropeToStory')?.checked ? world.selected.trope.join('、') : '';
            const charJson = world.ai.rawChar || '暂无 AI 人设卡';
            const storyContext = world.ai.renderedStory || '暂无已生成正文';
            return [
                `<current_worldbook>\n${preferredWorldbook}\n</current_worldbook>`,
                `<protagonists>\n${protagonistsFormal}\n</protagonists>`,
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
            if (!world.ai.openingWorldbook) {
                showToast('请先生成或填写世界书');
                return;
            }
            if (!world.ai.openingPersonaCards) {
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
                        const chapterTitle = target.chapters?.length ? target.chapters[target.chapters.length - 1] : '第一章';
                        const chapterEntry = {
                            title: chapterTitle,
                            content: parsed.story,
                            branches: parsed.branches,
                            sourceBranch: isContinuation ? target.ai.selectedBranch : ''
                        };
                        target.ai.rawStory = parsed.raw;
                        target.ai.renderedStory = isContinuation ? `${target.ai.renderedStory}\n\n${parsed.story}`.trim() : parsed.story;
                        target.ai.storyHtml = parsed.story;
                        target.ai.storyBranchesHtml = parsed.branchesHtml;
                        target.ai.storyBranches = parsed.branches;
                        if (isContinuation) target.ai.chapterEntries.push(chapterEntry);
                        else if (target.ai.chapterEntries.length) target.ai.chapterEntries[target.ai.chapterEntries.length - 1] = chapterEntry;
                        else target.ai.chapterEntries = [chapterEntry];
                        target.ai.currentChapterIndex = Math.max(target.ai.chapterEntries.length - 1, 0);
                        if (isContinuation) {
                            target.ai.storyHistory.push({ branch: target.ai.selectedBranch, appended: parsed.story });
                        }
                        target.ai.selectedBranch = '';
                    });
                    switchWorkspacePanel('story');
                    renderWorldData();
                }
            });
        }

        function selectStoryBranch(index) {
            const world = getCurrentWorld();
            const entries = Array.isArray(world?.ai?.chapterEntries) ? world.ai.chapterEntries : [];
            const latestIndex = Math.max(entries.length - 1, 0);
            if ((world?.ai?.currentChapterIndex || 0) !== latestIndex) return;
            const branches = entries[latestIndex]?.branches || world?.ai?.storyBranches || [];
            if (!branches[index]) return;
            updateCurrentWorld(target => {
                target.ai.selectedBranch = branches[index];
            });
            renderWorldData();
            showToast('已选中剧情分支');
        }

        function changeStoryChapter(index) {
            const world = getCurrentWorld();
            const entries = Array.isArray(world?.ai?.chapterEntries) ? world.ai.chapterEntries : [];
            const nextIndex = Math.min(Math.max(Number(index) || 0, 0), Math.max(entries.length - 1, 0));
            updateCurrentWorld(target => {
                target.ai.currentChapterIndex = nextIndex;
                if (nextIndex !== Math.max((target.ai.chapterEntries?.length || 1) - 1, 0)) {
                    target.ai.selectedBranch = '';
                }
            });
            renderWorldData();
        }

        function continueStoryFromSelectedBranch() {
            const world = getCurrentWorld();
            const entries = Array.isArray(world?.ai?.chapterEntries) ? world.ai.chapterEntries : [];
            const latestIndex = Math.max(entries.length - 1, 0);
            if ((world?.ai?.currentChapterIndex || 0) !== latestIndex) {
                showToast('只有最新章可继续生成');
                return;
            }
            if (!world.ai.selectedBranch) {
                showToast('请先选择一个剧情分支');
                return;
            }
            const nextChapterNumber = (world.chapters?.length || 0) + 1;
            const nextChapterName = '第' + nextChapterNumber + '章';
            updateCurrentWorld(target => {
                target.chapters ||= [];
                target.chapters.push(nextChapterName);
                target.ai.currentChapterIndex = target.chapters.length - 1;
            });
            showToast('将按选中分支继续生成' + nextChapterName);
            generateStoryWithAI();
        }

        function regenerateCurrentChapter() {
            const world = getCurrentWorld();
            const entries = Array.isArray(world?.ai?.chapterEntries) ? world.ai.chapterEntries : [];
            const currentIndex = world?.ai?.currentChapterIndex || 0;
            const latestIndex = Math.max(entries.length - 1, 0);
            const latestEntry = entries[latestIndex];
            if (currentIndex !== latestIndex) {
                showToast('暂只支持重新生成最新章');
                return;
            }
            if (!latestEntry?.content) {
                showToast('当前章暂无可重新生成的内容');
                return;
            }
            updateCurrentWorld(target => {
                const previousEntries = (target.ai.chapterEntries || []).slice(0, -1);
                target.ai.chapterEntries = previousEntries;
                target.ai.renderedStory = previousEntries.map(item => item.content).filter(Boolean).join('\n\n');
                target.ai.storyBranches = previousEntries.length ? [...(previousEntries[previousEntries.length - 1].branches || [])] : [];
                target.ai.currentChapterIndex = Math.max(previousEntries.length - 1, 0);
                target.ai.selectedBranch = latestEntry.sourceBranch || '';
                target.chapters = (target.chapters || ['第一章']).slice(0, Math.max((target.chapters || []).length - 1, 1));
            });
            renderWorldData();
            generateStoryWithAI();
        }

        function copyReaderStory() {
            const world = getCurrentWorld();
            const entries = Array.isArray(world?.ai?.chapterEntries) ? world.ai.chapterEntries : [];
            const currentIndex = Math.min(Math.max(world?.ai?.currentChapterIndex || 0, 0), Math.max(entries.length - 1, 0));
            const currentEntry = entries[currentIndex];
            if (!currentEntry?.content) {
                showToast('没有可复制的故事');
                return;
            }
            navigator.clipboard.writeText(currentEntry.content).then(() => showToast('已复制正文')).catch(() => showToast('复制失败'));
        }

        return {
            changeStoryChapter,
            continueStoryFromSelectedBranch,
            copyReaderStory,
            generateStoryWithAI,
            regenerateCurrentChapter,
            selectStoryBranch
        };
    }

    return { create };
})();

window.StoryModule = StoryModule;
