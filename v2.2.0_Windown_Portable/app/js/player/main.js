document.addEventListener('DOMContentLoaded', async () => {
    try {
        // UI・機能コンポーネントの初期化
        window.HeaderController.init();
        window.SidebarController.init();
        window.MainViewController.init();
        window.PlayerController.init();
        window.ModalSongSelect.init();

        // 起動時の表示調整
        const settings = await eel.get_app_settings()();
        
        // ★設定が「新しいウィンドウで開く」がONの場合、「トップへ」ボタンを隠す
        if (settings.open_player_new_window) {
            const backLinkArea = document.querySelector('.header-left');
            if (backLinkArea) {
                backLinkArea.style.display = 'none';
            }
        }

        // v1.0.0-beta3: 旧形式の歌詞データがあれば移行を実行
        await eel.migrate_lyrics_to_db()();

        // データの読み込み
        await window.SidebarController.loadPlaylists();

    } catch (e) {
        console.error("Initialization Error:", e);
    }
});