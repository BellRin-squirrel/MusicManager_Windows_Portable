(function() {
    const s = window.PlayerState;

    window.ModalSongSelect = {
        libraryData: [],
        filteredData: [],
        selectedFilenames: new Set(),
        currentPlaylistId: null,
        sortField: null,
        sortDesc: false,
        lastClickedIndex: null,
        _tempContextId: null,
        activeTags: [], // 設定で有効化されているタグリスト

        // --- Core: プレイリストの特定ロジック ---
        findTargetPlaylistId: function() {
            if (this._tempContextId) {
                return this._tempContextId;
            }
            if (window.SidebarController) {
                const side = window.SidebarController;
                for (let key in side) {
                    const val = side[key];
                    if (typeof val === 'number' && val !== -1 && s.playlists[val]) {
                        return s.playlists[val].id;
                    }
                }
            }
            if (s.currentPlaylistId) {
                return s.currentPlaylistId;
            }
            return null;
        },

        fetchLibrary: async function() {
            try {
                this.libraryData = await eel.get_library_data_with_meta(true)();
                return true;
            } catch (e) {
                console.error("[DEBUG-CORE] Python Error:", e);
                return false;
            }
        },

        filterData: function(query) {
            const q = query.toLowerCase().trim();
            this.filteredData = q ? this.libraryData.filter(item => 
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.artist && item.artist.toLowerCase().includes(q)) ||
                (item.album && item.album.toLowerCase().includes(q))
            ) : [...this.libraryData];
            this.lastClickedIndex = null;
            this.applySort();
        },

        // Core: 並び替え
        sortData: function(field) {
            if (this.sortField === field) {
                this.sortDesc = !this.sortDesc;
            } else {
                this.sortField = field;
                this.sortDesc = false;
            }
            this.updateSortUI();
            this.applySort();
        },

        applySort: function() {
            if (this.sortField) {
                this.filteredData.sort((a, b) => {
                    let va = a[this.sortField] || '';
                    let vb = b[this.sortField] || '';
                    if (['track', 'year', 'disc', 'bpm'].includes(this.sortField)) {
                        va = parseInt(va) || 0; vb = parseInt(vb) || 0;
                    } else {
                        va = va.toString().toLowerCase(); vb = vb.toString().toLowerCase();
                    }
                    if (va < vb) return this.sortDesc ? 1 : -1;
                    if (va > vb) return this.sortDesc ? -1 : 1;
                    return 0;
                });
            }
            this.renderList();
        },

        save: async function() {
            const btn = document.getElementById('btnSaveSelect');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "保存中...";
            
            try {
                const newSongs = Array.from(this.selectedFilenames);
                const updatedPl = await eel.update_playlist_by_id(this.currentPlaylistId, 'music', newSongs)();
                
                if (updatedPl) {
                    const idx = s.playlists.findIndex(p => p.id === this.currentPlaylistId);
                    if (idx !== -1) s.playlists[idx] = updatedPl;
                    if (s.currentPlaylistIndex !== -1 && s.playlists[s.currentPlaylistIndex].id === this.currentPlaylistId) {
                        window.MainViewController.renderMainView();
                    }
                    window.PlayerUtils.showToast("プレイリストを更新しました", false);
                    this.close();
                }
            } catch (e) {
                window.PlayerUtils.showToast("保存に失敗しました", true);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    };
})();