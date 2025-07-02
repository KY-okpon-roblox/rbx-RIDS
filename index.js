
document.addEventListener('DOMContentLoaded', () => {
    // --- START: Configuration ---
    //
    // 重要: 認証情報はサーバーサイドに移行されました。
    // プロジェクトの環境変数 `USER_CREDENTIALS` に設定してください。
    // 例: [{"username": "user", "password": "password"}]
    //
    const operationStatuses = [
        '運転見合わせ', '遅延', '平常運転', '平常運転復帰', '運転再開', '列車運休', '終日運転見合わせまたは運転取りやめ'
    ];

    const companyData = {
        'Hexa Railway Group': ['すみれが丘地下鉄すみれが丘線', 'すみれが丘地下鉄茜通り菊野線', '雨ヶ瀬近郊新鉄道あまがせニュータウン線', '織華鉄道鳴海線', 'MRT港線'],
        '尾羽急電鉄': ['尾羽急線', '尾羽急本線', '尾羽急高速線', '尾羽支線', '飛岡支線', '飛金線', '金田線', '空港線', '井問線', '千鳥支線', '箱倉支線'],
    };
    const companyNames = ['Hexa Railway Group', '尾羽急電鉄', 'その他'];

    const predefinedWebhooks = [
        { name: '運行情報', url: 'https://discord.com/api/webhooks/1388858411432673421/7czl1K4gmys-S0eWxURDId9URUFEgnK_8v5zA9u4zMI_9kt2_hkrCU9rEX98QHAz6Rv4' },
        { name: '一般聞き専', url: 'https://discord.com/api/webhooks/1389205514445131907/fgVvEpgujETm85_iVy38E_qmgigeIVT54ifZ29R997FGeiwu0QDIx71qVaNu4gITiVCM' },
        { name: '指令VC1', url: 'https://discord.com/api/webhooks/1389208314046451873/6UrKU10Ni4IxIKrkMIeVPqVGE5-Rt_dzECB9Oblx9L6oqb8aP4dPAJkhGY2ixLbdaktA' },
        { name: '指令VC2', url: 'https://discord.com/api/webhooks/1389208159482150972/d8dHVwXYu4aOREYPPbbYMTQx7OdDphZ6kiiSPhZpmfVxlRvR4IF761-9GT3wWMpI_QqJ' },
    ];

    const TRAIN_AVATAR_URL = 'https://1.bp.blogspot.com/-rBFzjQbEFj4/VhB9jvnHAmI/AAAAAAAAyzs/R1Dwa7c5l78/s800/businessman_dekiru.png';
    // --- END: Configuration ---


    // --- START: Element Selectors ---
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginErrorMessage = document.getElementById('login-error-message');
    const loginButton = loginForm.querySelector('button[type="submit"]');

    const channelSelect = document.getElementById('channelSelect');
    const operationStatusSelect = document.getElementById('operationStatus');
    const companyNameSelect = document.getElementById('companyName');
    const trainLineContainer = document.getElementById('train-line-container');
    const delayReasonContainer = document.getElementById('delay-reason-container');
    const affectedSectionContainer = document.getElementById('affected-section-container');
    const cancelledTrainsContainer = document.getElementById('cancelled-trains-container');
    const cancelledTrainsLabel = document.getElementById('cancelledTrainsLabel');
    const customMessageInput = document.getElementById('customMessage');
    const mentionInput = document.getElementById('mention');
    const testSendButton = document.getElementById('test-send-button');
    const testSendButtonText = document.getElementById('test-send-button-text');
    const sendButton = document.getElementById('send-button');
    const sendButtonText = document.getElementById('send-button-text');
    const statusToast = document.getElementById('status-toast');
    const statusToastIcon = document.getElementById('status-toast-icon');
    const statusToastMessage = document.getElementById('status-toast-message');

    const formInputs = {
        delayReason: document.getElementById('delayReason'),
        affectedSection: document.getElementById('affectedSection'),
        cancelledTrains: document.getElementById('cancelledTrains'),
    };
    // --- END: Element Selectors ---


    // --- START: State Management ---
    let isLoading = false;
    let isTestLoading = false;
    let formData = {
        companyName: companyNames[0],
        operationStatus: operationStatuses[1],
        trainLine: '',
        delayReason: '人身事故',
        affectedSection: '',
        cancelledTrains: '',
        customMessage: '',
        mention: '',
    };
    // --- END: State Management ---


    // --- START: Services ---
    async function sendToDiscord(webhookUrl, payload) {
        const discordPayload = {
            ...payload,
            username: '運行情報bot',
            avatar_url: TRAIN_AVATAR_URL,
        };
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordPayload),
            });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: '不明なWebhookエラー' }));
                console.error('Discord API Error:', errorBody);
                throw new Error(`Discordへの送信に失敗しました (ステータス: ${response.status})。URLが正しいか確認してください。`);
            }
        } catch (error) {
            console.error("Failed to send to Discord:", error);
            throw error instanceof Error ? error : new Error('Discordへの送信中にネットワークエラーが発生しました。');
        }
    }

    function generateTrainDelayMessage(data) {
        const { trainLine, delayReason, affectedSection, customMessage, operationStatus, cancelledTrains } = data;
        const time = new Date().toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' });
        let coreMessage;
        switch (operationStatus) {
            case '運転見合わせ':
                coreMessage = `${trainLine}は、${time}現在、${delayReason}の影響で、${affectedSection}で運転を見合わせています。`;
                break;
            case '遅延':
                coreMessage = `${trainLine}は、${time}現在、${delayReason}の影響で、${affectedSection}の一部列車に遅れと運休が出ています。`;
                break;
            case '平常運転':
                coreMessage = `${trainLine}は、${time}現在、概ね平常通り運転しております。`;
                break;
            case '平常運転復帰':
                coreMessage = `${trainLine}は、${time}現在、概ね平常運転に戻りました。`;
                break;
            case '運転再開':
                coreMessage = `${trainLine}は、${delayReason}の影響で、${affectedSection}で運転を見合わせていましたが、${time}に運転を再開し、${affectedSection}の一部列車に遅れと運休が出ています。`;
                break;
            case '列車運休':
                coreMessage = `${trainLine}は、${time}現在、${delayReason}の影響で、${cancelledTrains}が運休となっています。`;
                break;
            case '終日運転見合わせまたは運転取りやめ':
                coreMessage = `${trainLine}は、${delayReason}の影響で、${cancelledTrains}の運転を終日取りやめます。`;
                break;
            default:
                coreMessage = `${trainLine}の運行情報を確認しています。`;
        }
        const customMessageBlock = customMessage ? `\n\n${customMessage}` : '';
        return `**【${trainLine} 運行情報】**\n\n${coreMessage}${customMessageBlock}`.trim();
    }
    // --- END: Services ---


    // --- START: UI Logic ---
    let statusTimeout;
    function displayStatus(type, message) {
        clearTimeout(statusTimeout);
        
        const icons = {
            success: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
            error: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
            info: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>`,
        };
        const colors = {
            success: 'bg-green-500/20 text-green-300 border-green-500/30',
            error: 'bg-red-500/20 text-red-300 border-red-500/30',
            info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        };
        
        statusToast.className = `fixed bottom-4 right-4 max-w-sm w-full z-50 p-4 rounded-lg flex items-center gap-3 transition-all duration-300 shadow-lg border ${colors[type]}`;
        statusToastIcon.innerHTML = icons[type];
        statusToastMessage.textContent = message;
        
        statusToast.classList.remove('hidden');
        statusTimeout = window.setTimeout(() => statusToast.classList.add('hidden'), 5000);
    }
    
    function updateFormVisibility() {
        const status = formData.operationStatus;
        delayReasonContainer.classList.toggle('hidden', ['平常運転', '平常運転復帰'].includes(status));
        affectedSectionContainer.classList.toggle('hidden', !['運転見合わせ', '遅延', '運転再開'].includes(status));
        cancelledTrainsContainer.classList.toggle('hidden', !['列車運休', '終日運転見合わせまたは運転取りやめ'].includes(status));

        if (!cancelledTrainsContainer.classList.contains('hidden')) {
            const isTrainSpecific = status === '列車運休';
            cancelledTrainsLabel.textContent = isTrainSpecific ? '運休対象列車' : '運休対象列車または支障区間';
            formInputs.cancelledTrains.placeholder = isTrainSpecific ? '例: 特急あずさ3号' : '例: 全ての特急列車';
        }
    }

    function updateTrainLineInput() {
        trainLineContainer.innerHTML = ''; // Clear previous input/select
        const lines = companyData[formData.companyName];
        
        let element;
        if (lines) {
            element = document.createElement('div');
            element.className = 'relative w-full';
            element.innerHTML = `
                <select id="trainLine" name="trainLine" required class="w-full appearance-none px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out">
                    <option value="" disabled selected>路線を選択してください</option>
                    ${lines.map(line => `<option value="${line}">${line}</option>`).join('')}
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>
            `;
        } else {
            element = document.createElement('input');
            element.id = 'trainLine';
            element.setAttribute('name', 'trainLine');
            element.setAttribute('type', 'text');
            element.setAttribute('placeholder', '例: 中央・総武線');
            element.className = 'w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out';
            element.required = true;
        }
        
        trainLineContainer.appendChild(element);
        const trainLineEl = document.getElementById('trainLine');
        trainLineEl.value = formData.trainLine;
        trainLineEl.addEventListener('change', (e) => {
            formData.trainLine = e.target.value
        });
    }
    
    function validateForm() {
        const { operationStatus, trainLine, delayReason, affectedSection, cancelledTrains } = formData;
        if (!trainLine) {
            displayStatus('error', '路線名は必須です。');
            return false;
        }
        if (!['平常運転', '平常運転復帰'].includes(operationStatus) && !delayReason) {
            displayStatus('error', '遅延理由は必須です。');
            return false;
        }
        if (['運転見合わせ', '遅延', '運転再開'].includes(operationStatus) && !affectedSection) {
            displayStatus('error', '支障区間は必須です。');
            return false;
        }
        if (['列車運休', '終日運転見合わせまたは運転取りやめ'].includes(operationStatus) && !cancelledTrains) {
            const fieldName = operationStatus === '列車運休' ? '運休対象列車' : '運休対象列車または支障区間';
            displayStatus('error', `${fieldName}は必須です。`);
            return false;
        }
        return true;
    }
    
    function setLoading(loading, type) {
        if (type === 'test') isTestLoading = loading;
        if (type === 'main') isLoading = loading;

        testSendButton.disabled = isLoading || isTestLoading;
        sendButton.disabled = isLoading || isTestLoading;
        
        testSendButtonText.textContent = isTestLoading ? '送信中...' : 'テスト送信';
        sendButtonText.textContent = isLoading ? '送信中...' : '運行情報を送信';
    }
    // --- END: UI Logic ---


    // --- START: Event Handlers ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.disabled = true;
        loginButton.textContent = 'ログイン中...';
        loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameInput.value,
                    password: passwordInput.value
                }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                authSection.classList.add('hidden');
                appSection.classList.remove('hidden');
            } else {
                loginErrorMessage.textContent = result.message || 'ユーザー名またはパスワードが正しくありません。';
                loginError.classList.remove('hidden');
                passwordInput.value = '';
            }
        } catch (error) {
            loginErrorMessage.textContent = 'ログイン中にエラーが発生しました。後でもう一度お試しください。';
            loginError.classList.remove('hidden');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'ログイン';
        }
    });

    sendButton.addEventListener('click', async () => {
        const webhookUrl = channelSelect.value;
        if (!webhookUrl || webhookUrl.startsWith('YOUR_WEBHOOK_URL_HERE')) {
            displayStatus('error', '有効なWebhook URLを選択してください。');
            return;
        }
        if (!validateForm()) return;

        setLoading(true, 'main');
        try {
            const message = generateTrainDelayMessage(formData);
            displayStatus('info', 'Discordへ通知を送信中です...');
            const fullMessage = `${formData.mention ? formData.mention + '\n' : ''}${message}`;
            await sendToDiscord(webhookUrl, { content: fullMessage });
            displayStatus('success', '通知が正常に送信されました！');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
            displayStatus('error', `送信に失敗しました: ${errorMessage}`);
        } finally {
            setLoading(false, 'main');
        }
    });

    testSendButton.addEventListener('click', async () => {
        const webhookUrl = channelSelect.value;
        if (!webhookUrl || webhookUrl.startsWith('YOUR_WEBHOOK_URL_HERE')) {
             displayStatus('error', '有効なWebhook URLを選択してください。');
            return;
        }
        setLoading(true, 'test');
        try {
            const testMessage = `${formData.mention ? formData.mention + '\n' : ''}これはテスト通知です。\n**【${formData.trainLine || 'テスト路線'}】**\n現在、平常通り運行しております。`;
            await sendToDiscord(webhookUrl, { content: testMessage });
            displayStatus('success', 'テスト通知が正常に送信されました！');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
            displayStatus('error', `テスト送信に失敗しました: ${errorMessage}`);
        } finally {
            setLoading(false, 'test');
        }
    });
    
    // Form data binding
    operationStatusSelect.addEventListener('change', (e) => {
        formData.operationStatus = e.target.value;
        updateFormVisibility();
    });
    companyNameSelect.addEventListener('change', (e) => {
        formData.companyName = e.target.value;
        formData.trainLine = '';
        updateTrainLineInput();
    });
    
    Object.keys(formInputs).forEach(key => {
        formInputs[key].addEventListener('input', (e) => {
            formData[key] = e.target.value;
        });
    });
    customMessageInput.addEventListener('input', (e) => {
        formData.customMessage = e.target.value;
    });
    mentionInput.addEventListener('input', (e) => {
        formData.mention = e.target.value;
    });
    
    // --- END: Event Handlers ---


    // --- START: Initialization ---
    function initialize() {
        // Populate dropdowns
        if (predefinedWebhooks.length > 0) {
            channelSelect.innerHTML = predefinedWebhooks.map(wh => `<option value="${wh.url}">${wh.name}</option>`).join('');
        } else {
            channelSelect.innerHTML = `<option value="" disabled>Webhookが未設定です</option>`;
            channelSelect.disabled = true;
        }
        
        operationStatusSelect.innerHTML = operationStatuses.map(s => `<option value="${s}">${s}</option>`).join('');
        operationStatusSelect.value = formData.operationStatus;

        companyNameSelect.innerHTML = companyNames.map(name => `<option value="${name}">${name}</option>`).join('');
        companyNameSelect.value = formData.companyName;

        // Set initial form state
        Object.keys(formInputs).forEach(key => {
            if(formData[key]) {
                formInputs[key].value = formData[key];
            }
        });
        
        updateTrainLineInput();
        updateFormVisibility();
    }
    
    initialize();
    // --- END: Initialization ---
});
