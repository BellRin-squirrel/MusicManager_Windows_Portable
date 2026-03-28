window.PlayerUtils = {
    showLoading: function() {
        const overlay = document.getElementById('playerLoadingOverlay');
        if(overlay) {
            overlay.style.display = 'flex';
            this.updateLoadingProgress(0, 0, "データ処理中...");
        }
    },
    hideLoading: function() {
        const overlay = document.getElementById('playerLoadingOverlay');
        if(overlay) overlay.style.display = 'none';
    },
    
    // テキスト形式での進捗更新
    updateLoadingProgress: function(current, total, headerMsg) {
        const headEl = document.getElementById('loadingHeaderText');
        const detailEl = document.getElementById('loadingDetailText');
        
        if (headEl) headEl.textContent = headerMsg;
        if (!detailEl) return;
        
        let percent = 0;
        if (total > 0) percent = Math.floor((current / total) * 100);

        detailEl.textContent = `処理中... ${current} / ${total} (${percent}%)`;
    },

    showToast: function(msg, isErr) {
        const toast = document.getElementById('toast');
        toast.textContent = msg; 
        toast.className = 'toast show';
        if(isErr) toast.classList.add('error'); else toast.classList.add('success');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },
    escapeHtml: function(text) {
        if (!text) return '';
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    formatTime: function(seconds) {
        const m = Math.floor(seconds / 60); 
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },
    formatTotalDuration: function(seconds) {
        if (seconds < 60) return `${Math.floor(seconds)}秒`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分`;
        return `${(seconds / 3600).toFixed(1)}時間`;
    },
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    sortSongs: function(songs, sortBy) {
        if (!songs || !Array.isArray(songs)) return [];

        const list = [...songs];
        list.sort((a, b) => {
            const valA = String(a[sortBy] || ''); 
            const valB = String(b[sortBy] || '');
            return valA.localeCompare(valB, 'ja');
        });
        return list;
    }
};