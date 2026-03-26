// ============================================================
//  AI 服务和 API 供应商管理
// ============================================================

const AIService = (function() {
    'use strict';
    
    // ============================================================
    //  API 供应商配置
    // ============================================================
    const LS_AI_PROVIDERS = 'ss_ai_providers_v2';
    const LS_AI_CURRENT_P = 'ss_ai_cur_provider_v2';
    
    let selectedModel = '';
    let currentAbortController = null;
    
    // 获取所有供应商
    function getProviders() {
        try {
            return JSON.parse(localStorage.getItem(LS_AI_PROVIDERS)) || {};
        } catch(e) {
            return {};
        }
    }
    
    // 保存供应商
    function saveProviders(providers) {
        localStorage.setItem(LS_AI_PROVIDERS, JSON.stringify(providers));
    }
    
    // 获取当前供应商 ID
    function getCurrentProviderId() {
        return localStorage.getItem(LS_AI_CURRENT_P) || null;
    }
    
    // 设置当前供应商 ID
    function setCurrentProviderId(id) {
        localStorage.setItem(LS_AI_CURRENT_P, id);
    }
    
    // 初始化供应商系统
    function initProviderSystem() {
        let providers = getProviders();
        let currentId = getCurrentProviderId();
        
        if (Object.keys(providers).length === 0) {
            const id = generateId();
            providers[id] = {
                name: '默认供应商',
                baseUrl: '',
                apiKey: '',
                selectedModel: ''
            };
            saveProviders(providers);
            currentId = id;
            setCurrentProviderId(id);
        }
        
        if (!providers[currentId]) {
            currentId = Object.keys(providers)[0];
            setCurrentProviderId(currentId);
        }
        
        return { providers, currentId };
    }
    
    // 生成唯一 ID
    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }
    
    // 获取当前供应商配置
    function getCurrentProviderConfig() {
        const id = getCurrentProviderId();
        const providers = getProviders();
        return providers[id] || null;
    }
    
    // 保存当前供应商配置
    function saveCurrentProviderConfig(config) {
        const id = getCurrentProviderId();
        if (!id) return;
        
        const providers = getProviders();
        if (!providers[id]) return;
        
        providers[id] = { ...providers[id], ...config };
        saveProviders(providers);
    }
    
    // 获取选中的模型
    function getSelectedModel() {
        return selectedModel;
    }
    
    // 设置选中的模型
    function setSelectedModel(model) {
        selectedModel = model;
        saveCurrentProviderConfig({ selectedModel: model });
    }
    
    // ============================================================
    //  API 连接和模型获取
    // ============================================================
    
    // 测试连接并获取模型列表
    async function fetchModels(baseUrl, apiKey) {
        const url = baseUrl.trim().replace(/\/+$/, '');
        
        if (!url) {
            throw new Error('请填写 API 地址');
        }
        
        try {
            const response = await fetch(`${url}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const models = (data.data || data.models || [])
                .map(m => m.id || m)
                .filter(Boolean);
            
            if (!models.length) {
                throw new Error('无可用模型');
            }
            
            return models;
        } catch (error) {
            throw new Error(`连接失败：${error.message}`);
        }
    }
    
    // ============================================================
    //  AI 生成核心逻辑
    // ============================================================
    
    // 执行 AI 生成
    async function executeGeneration(systemMsg, userMsg, options = {}) {
        const config = getCurrentProviderConfig();
        
        if (!config || !config.baseUrl) {
            throw new Error('请先配置 API 地址');
        }
        
        if (!selectedModel) {
            throw new Error('请先选择模型');
        }
        
        const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
        const apiKey = config.apiKey.trim();
        const useStream = options.stream !== false;
        
        try {
            currentAbortController = new AbortController();
            
            const payload = {
                model: selectedModel,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: userMsg }
                ],
                temperature: options.temperature || 0.85,
                stream: useStream
            };
            
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload),
                signal: currentAbortController.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            if (useStream) {
                return await handleStreamResponse(response);
            } else {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || '';
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求已取消');
            }
            throw error;
        } finally {
            currentAbortController = null;
        }
    }
    
    // 处理流式响应
    async function handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                
                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') continue;
                
                try {
                    const chunk = JSON.parse(dataStr);
                    const delta = chunk.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullText += delta;
                        // 触发流式更新事件
                        if (typeof window.onAIStreamUpdate === 'function') {
                            window.onAIStreamUpdate(fullText);
                        }
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
        
        return fullText;
    }
    
    // 取消当前请求
    function cancelGeneration() {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
    }
    
    // ============================================================
    //  模块 Schema 定义
    // ============================================================
    
    const MODULE_JSON_SCHEMA = {
        basic: `    "basic": { "char_name":"", "chinese_name":"", "nickname":"", "age":"", "birthday_date":"", "birthday_zodiac":"", "gender":"", "height":"", "identity":[], "archetype":[], "social":[] }`,
        background: `    "background": { "childhood_range":"0-12岁", "childhood":[], "teenage_range":"13-18岁", "teenage":[], "youth_range":"19-24岁", "youth":[], "current_range":"", "current":[] }`,
        appearance: `    "appearance": { "hair":"", "eyes":"", "skin":"", "face_style":"", "build":[], "attire_formal":"", "attire_business":"", "attire_casual":"", "attire_home":"" }`,
        personality: `    "personality": { "core_traits":[], "romantic_traits":[], "weakness":[], "likes":[], "dislikes":[], "goals":[] }`,
        behavior: `    "behavior": { "lifestyle":[], "work_behaviors":[], "emotional_angry":"", "emotional_happy":"", "emotional_sad":"", "boundaries":[], "work_skills":[], "life_skills":[], "hobby_skills":[] }`,
        speech: `    "speech": { "speech_style":"", "speech_reasoning":"", "speech_accent":"", "speech_online":"" }`,
        extra: `    "extra": { "additional_notes":"", "catchphrases":[], "mannerisms":[], "trauma":[], "values":[], "conflicts":[], "secrets":[], "relationships":[], "defining_moments":[] }`,
        nsfw: `    "nsfw": { "experiences":"","sexual_organs":"", "sexual_orientation":"", "sexual_role":[], "sexual_habits":[], "kinks":[], "limits":[] }`
    };
    
    function getModuleSchema(modules) {
        const lines = modules.map(m => MODULE_JSON_SCHEMA[m] || '').filter(Boolean);
        return '{\n  "某某主角的名字": {\n' + lines.join(',\n') + '\n  }\n}';
    }
    
    // ============================================================
    //  导出公共 API
    // ============================================================
    
    return {
        // 供应商管理
        initProviderSystem: initProviderSystem,
        getProviders: getProviders,
        saveProviders: saveProviders,
        getCurrentProviderId: getCurrentProviderId,
        setCurrentProviderId: setCurrentProviderId,
        getCurrentProviderConfig: getCurrentProviderConfig,
        saveCurrentProviderConfig: saveCurrentProviderConfig,
        
        // 模型管理
        getSelectedModel: getSelectedModel,
        setSelectedModel: setSelectedModel,
        fetchModels: fetchModels,
        
        // AI 生成
        executeGeneration: executeGeneration,
        cancelGeneration: cancelGeneration,
        
        // Schema
        getModuleSchema: getModuleSchema,
        MODULE_JSON_SCHEMA: MODULE_JSON_SCHEMA
    };
})();

// 全局暴露（用于向后兼容）
window.AIService = AIService;
