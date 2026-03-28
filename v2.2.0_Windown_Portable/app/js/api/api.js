let myIp = "";
let currentCode = "";
let timerInterval = null;
let remainingSeconds = 0;

async function updateSessions() {
    const sessions = await eel.get_active_sessions()();
    const list = document.getElementById('sessionsList');
    if (sessions.length === 0) {
        list.innerHTML = '<li class="no-sessions">接続中のデバイスはありません。</li>';
        return;
    }
    
    list.innerHTML = sessions.map(s => {
        const minutes = Math.floor(s.remaining / 60);
        const seconds = s.remaining % 60;
        const timeStr = `${minutes}分${seconds.toString().padStart(2, '0')}秒`;
        
        return `
            <li class="session-item">
                <div class="session-item-info">
                    <div class="session-item-device">${s.device}</div>
                    <div class="session-item-ip">${s.ip}</div>
                </div>
                <div class="session-item-actions">
                    <div class="session-item-time">${timeStr}</div>
                    <button class="btn-disconnect" onclick="forceDisconnect('${s.ip}', '${s.device}')">切断</button>
                </div>
            </li>
        `;
    }).join('');
}

async function forceDisconnect(ip, device) {
    if(confirm(`${device} の接続を解除しますか？`)) {
        await eel.force_disconnect_session(ip, device)();
        updateSessions();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const info = await eel.get_connect_info()();
    myIp = info.ip;
    document.getElementById('displayIp').textContent = myIp;
    eel.set_sync_window_state(true);

    window.onbeforeunload = () => { 
        eel.set_sync_window_state(false);
        // ★ 修正点: ウィンドウを閉じる際に全セッションをクリアする
        eel.clear_all_sessions()();
    };

    document.getElementById('btnShowQr').addEventListener('click', () => {
        const wrapper = document.getElementById('qr-wrapper');
        const container = document.getElementById('qrcode-container');
        container.innerHTML = "";
        new QRCode(container, { text: JSON.stringify({ ip: myIp, code: currentCode }), width: 180, height: 180 });
        wrapper.style.display = 'block';
        document.getElementById('btnShowQr').style.display = 'none';
    });

    document.getElementById('btnHideQr').addEventListener('click', () => {
        document.getElementById('qr-wrapper').style.display = 'none';
        document.getElementById('btnShowQr').style.display = 'block';
    });

    document.getElementById('btnApprove').addEventListener('click', async () => {
        await eel.respond_to_request(true)();
        document.getElementById('approvalActions').style.display = 'none';
        document.getElementById('codeDisplayArea').style.display = 'block';
    });

    document.getElementById('btnReject').addEventListener('click', async () => {
        await eel.respond_to_request(false)();
        document.getElementById('requestModal').style.display = 'none';
    });

    setInterval(() => {
        updateSessions();
        if (remainingSeconds > 0) {
            remainingSeconds--;
            const timer = document.getElementById('codeTimer');
            if (timer) timer.textContent = remainingSeconds;
        }
    }, 1000);
});

eel.expose(update_auth_code);
function update_auth_code(code, seconds) {
    currentCode = code;
    remainingSeconds = seconds;
    const display = document.getElementById('authCodeDisplay');
    if (display) display.textContent = code;
    const wrapper = document.getElementById('qr-wrapper');
    if (wrapper && wrapper.style.display === 'block') {
        const container = document.getElementById('qrcode-container');
        container.innerHTML = "";
        new QRCode(container, { text: JSON.stringify({ ip: myIp, code: currentCode }), width: 180, height: 180 });
    }
}

eel.expose(notify_auth_request);
function notify_auth_request(req) {
    const deviceInfo = `${req.device || '不明なデバイス'} - ${req.os || '不明なOS'}`;
    document.getElementById('reqDeviceInfo').textContent = deviceInfo;
    
    document.getElementById('requestModal').style.display = 'flex';
    document.getElementById('approvalActions').style.display = 'block';
    document.getElementById('codeDisplayArea').style.display = 'none';
}

eel.expose(notify_auth_success);
function notify_auth_success(device) {
    document.getElementById('requestModal').style.display = 'none';
    const toast = document.getElementById('toast');
    toast.textContent = `${device} が接続されました`;
    toast.style.opacity = '1';
    toast.style.bottom = '40px';
    setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '30px'; }, 3000);
}

eel.expose(reset_pc_ui);
function reset_pc_ui() {
    document.getElementById('requestModal').style.display = 'none';
}