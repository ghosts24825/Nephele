// ============================================================
// Supabase 云同步接口
// ============================================================

const SupabaseClient = (function() {
    'use strict';

    const SUPABASE_URL = 'https://bbwykvuqtjnorfkkrafr.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_G3_WV2wpOc8vnXntHM0THQ_npmXJaRG';

    let _client = null;

    function initClient() {
        if (typeof supabase !== 'undefined') {
            _client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase client initialized.');
        } else {
            console.warn('Supabase SDK is not loaded.');
        }
    }

    async function saveToCloud(username, data) {
        if (!_client) {
            throw new Error('Supabase client is not initialized.');
        }

        const payload = {
            username,
            app_state: data,
            updated_at: new Date().toISOString()
        };

        // Some deployments may not have a unique constraint on username.
        // Check first so repeat saves do not create duplicate rows.
        const { data: existingRows, error: existingError } = await _client
            .from('user_configs')
            .select('username')
            .eq('username', username)
            .limit(1);

        if (existingError) {
            throw new Error('Failed to check existing cloud data: ' + existingError.message);
        }

        let writeError = null;

        if (existingRows?.length) {
            const { error } = await _client
                .from('user_configs')
                .update({
                    app_state: payload.app_state,
                    updated_at: payload.updated_at
                })
                .eq('username', username);
            writeError = error;
        } else {
            const { error } = await _client
                .from('user_configs')
                .insert(payload);
            writeError = error;
        }

        if (writeError) {
            throw new Error('Cloud save failed: ' + writeError.message);
        }

        return { success: true, message: 'Cloud save succeeded.' };
    }

    async function loadFromCloud(username) {
        if (!_client) {
            throw new Error('Supabase client is not initialized.');
        }

        const { data, error } = await _client
            .from('user_configs')
            .select('app_state, updated_at')
            .eq('username', username)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(1);

        if (error) {
            throw new Error('Cloud load failed: ' + error.message);
        }

        const latest = Array.isArray(data) ? data[0] : data;
        if (!latest || !latest.app_state) {
            throw new Error('No cloud data found for this username.');
        }

        return latest.app_state;
    }

    function getCloudUsername() {
        return localStorage.getItem('generator_cloud_username_v1') || '';
    }

    function saveCloudUsername(username) {
        localStorage.setItem('generator_cloud_username_v1', username);
    }

    return {
        init: initClient,
        saveToCloud,
        loadFromCloud,
        getCloudUsername,
        saveCloudUsername
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        SupabaseClient.init();
    });
} else {
    SupabaseClient.init();
}
