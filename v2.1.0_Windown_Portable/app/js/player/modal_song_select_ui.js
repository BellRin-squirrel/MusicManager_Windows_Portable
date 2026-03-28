(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;
    const m = window.ModalSongSelect;

    Object.assign(m, {
        init: function() {
            // プレイリスト一覧での右クリック捕捉
            const playlistList = document.getElementById('playlistList');
            if (playlistList) {
                playlistList.addEventListener('mousedown', (e) => {
                    if (e.button === 2) {
                        const item = e.target.closest('.playlist-item');
                        if (item) {
                            const name = item.querySelector('span').textContent.trim();
                            const found = s.playlists.find(p => p.playlistName === name);
                            if (found) {
                                this._tempContextId = found.id;
                            }
                        }
                    }
                });
            }

            // 「曲を編集」メニュークリック
            const menuEditSongs = document.getElementById('menuEditSongs');
            if (menuEditSongs) {
                menuEditSongs.addEventListener('click', () => {
                    const itemMenu = document.getElementById('playlistItemMenu');
                    if (itemMenu) itemMenu.style.display = 'none';
                    const targetId = this.findTargetPlaylistId();
                    if (targetId) this.open(targetId);
                    else u.showToast("対象のプレイリストが見つかりません。", true);
                });
            }

            document.getElementById('btnCancelSelect').addEventListener('click', () => this.close());
            document.getElementById('btnSaveSelect').addEventListener('click', () => this.save());

            const searchInput = document.getElementById('songSelectSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.filterData(e.target.value));
            }

            this.initMarqueeSelection();
        },

        open: async function(pl_id) {
            // ★ 処理開始: 全画面オーバーレイを表示
            u.showLoading();
            u.updateLoadingProgress(0, 0, "データを読み込み中...");

            try {
                this.currentPlaylistId = pl_id;
                this.lastClickedIndex = null;
                
                const pl = s.playlists.find(p => p.id === pl_id);
                this.selectedFilenames = new Set();
                if (pl && pl.music) {
                    pl.music.forEach(fname => this.selectedFilenames.add(fname));
                }

                // 設定と全タグ情報を取得してカラムを決定
                const settings = await eel.get_app_settings()();
                const allTags = await eel.get_available_tags()();
                this.activeTags = allTags.filter(t => settings.active_tags.includes(t.key));

                // ヘッダーの生成
                this.renderHeader();

                const success = await this.fetchLibrary();
                if (!success) {
                    u.showToast("ライブラリの取得に失敗しました", true);
                    u.hideLoading();
                    return;
                }
                
                this.sortField = null;
                this.sortDesc = false;
                this.updateSortUI();
                this.filterData('');
                
                const modal = document.getElementById('songSelectModal');
                if (modal) modal.classList.add('show');

            } catch (e) {
                console.error("Open Modal Error:", e);
                u.showToast("エラーが発生しました", true);
            } finally {
                // ★ 処理終了: オーバーレイを隠す
                u.hideLoading();
            }
        },

        close: function() {
            const modal = document.getElementById('songSelectModal');
            if (modal) modal.classList.remove('show');
            this._tempContextId = null;
        },

        renderHeader: function() {
            const head = document.getElementById('selectTableHeader');
            if (!head) return;
            
            let html = `
                <tr>
                    <th class="chk-cell"><input type="checkbox" id="checkAllSongs" class="col-check-box"></th>
                    <th class="col-art-small"></th>
            `;
            
            this.activeTags.forEach(tag => {
                html += `<th class="sortable col-${tag.key}" onclick="window.ModalSongSelect.sortData('${tag.key}')">${tag.label}</th>`;
            });
            
            html += `</tr>`;
            head.innerHTML = html;

            // 全選択チェックボックスのイベント再登録
            const checkAllBtn = document.getElementById('checkAllSongs');
            if (checkAllBtn) {
                checkAllBtn.closest('th').addEventListener('click', (e) => {
                    if (e.target !== checkAllBtn) e.preventDefault();
                    this.toggleAllSelection();
                });
            }
        },

        updateSortUI: function() {
            const headers = document.querySelectorAll('#selectTableHeader th.sortable');
            headers.forEach(th => {
                th.innerText = th.innerText.replace(/ [▲▼]/g, "");
                const fieldClass = `col-${this.sortField}`;
                if (th.classList.contains(fieldClass)) {
                    th.innerText += this.sortDesc ? " ▼" : " ▲";
                }
            });
        },

        renderList: function() {
            const tbody = document.getElementById('selectTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            const fragment = document.createDocumentFragment();

            this.filteredData.forEach((item, index) => {
                const fname = item.musicFilename.split(/[\\/]/).pop();
                const isSelected = this.selectedFilenames.has(fname);
                const tr = document.createElement('tr');
                tr.className = `select-row ${isSelected ? 'selected' : ''}`;
                tr.dataset.fname = fname;
                
                tr.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT') {
                        this.handleRowClick(index, e);
                    }
                };

                const artSrc = item.imageData || s.DEFAULT_ICON;
                
                let cellsHtml = `
                    <td class="chk-cell">
                        <input type="checkbox" class="col-check-box" ${isSelected ? 'checked' : ''} onchange="window.ModalSongSelect.handleRowClick(${index}, event)">
                    </td>
                    <td class="col-art-small"><img src="${artSrc}"></td>
                `;

                // 有効なタグに基づいてセルを生成
                this.activeTags.forEach(tag => {
                    const val = u.escapeHtml(item[tag.key] || '');
                    cellsHtml += `<td class="col-${tag.key}">${val}</td>`;
                });

                tr.innerHTML = cellsHtml;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
            this.updateHeaderCheckboxState();
        },

        handleRowClick: function(index, event) {
            const item = this.filteredData[index];
            const fname = item.musicFilename.split(/[\\/]/).pop();

            if (event.shiftKey && this.lastClickedIndex !== null) {
                const start = Math.min(this.lastClickedIndex, index);
                const end = Math.max(this.lastClickedIndex, index);
                
                const startItem = this.filteredData[this.lastClickedIndex];
                const startFname = startItem.musicFilename.split(/[\\/]/).pop();
                const shouldSelect = this.selectedFilenames.has(startFname);

                for (let i = start; i <= end; i++) {
                    const targetFname = this.filteredData[i].musicFilename.split(/[\\/]/).pop();
                    if (shouldSelect) this.selectedFilenames.add(targetFname);
                    else this.selectedFilenames.delete(targetFname);
                }
            } else {
                if (this.selectedFilenames.has(fname)) this.selectedFilenames.delete(fname);
                else this.selectedFilenames.add(fname);
                this.lastClickedIndex = index;
            }

            this.renderList();
        },

        updateHeaderCheckboxState: function() {
            const checkAllBtn = document.getElementById('checkAllSongs');
            if (!checkAllBtn || this.filteredData.length === 0) return;

            let checkedCount = 0;
            this.filteredData.forEach(item => {
                const fname = item.musicFilename.split(/[\\/]/).pop();
                if (this.selectedFilenames.has(fname)) checkedCount++;
            });

            if (checkedCount === 0) {
                checkAllBtn.checked = false; checkAllBtn.indeterminate = false;
            } else if (checkedCount === this.filteredData.length) {
                checkAllBtn.checked = true; checkAllBtn.indeterminate = false;
            } else {
                checkAllBtn.checked = false; checkAllBtn.indeterminate = true;
            }
        },

        toggleAllSelection: function() {
            const checkAllBtn = document.getElementById('checkAllSongs');
            if (!checkAllBtn) return;
            const shouldSelectAll = !checkAllBtn.checked || checkAllBtn.indeterminate;
            this.filteredData.forEach(item => {
                const fname = item.musicFilename.split(/[\\/]/).pop();
                if (shouldSelectAll) this.selectedFilenames.add(fname);
                else this.selectedFilenames.delete(fname);
            });
            this.renderList();
        },

        initMarqueeSelection: function() {
            const container = document.getElementById('songSelectListContainer');
            const marquee = document.getElementById('selectionMarquee');
            if (!container || !marquee) return;
            let isSelecting = false; let startX = 0; let startY = 0;
            container.onmousedown = (e) => {
                if (e.button !== 0 || e.target.closest('tr') || e.target.tagName === 'INPUT') return;
                isSelecting = true;
                const rect = container.getBoundingClientRect();
                startX = e.clientX - rect.left; startY = e.clientY - rect.top + container.scrollTop;
                marquee.style.display = 'block'; marquee.style.width = '0'; marquee.style.height = '0';
                e.preventDefault();
            };
            window.onmousemove = (e) => {
                if (!isSelecting) return;
                const rect = container.getBoundingClientRect();
                const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height)) + container.scrollTop;
                const x = Math.min(startX, curX); const y = Math.min(startY, curY);
                const w = Math.abs(curX - startX); const h = Math.abs(curY - startY);
                marquee.style.left = x + 'px'; marquee.style.top = (y - container.scrollTop) + 'px';
                marquee.style.width = w + 'px'; marquee.style.height = h + 'px';
                this.selectRowsInMarquee(x, y, w, h, rect, container.scrollTop);
            };
            window.onmouseup = () => { isSelecting = false; marquee.style.display = 'none'; };
        },

        selectRowsInMarquee: function(x, y, w, h, containerRect, scrollY) {
            const rows = document.querySelectorAll('#selectTableBody tr');
            rows.forEach(row => {
                const r = row.getBoundingClientRect();
                const rTop = r.top - containerRect.top + scrollY;
                const rBot = r.bottom - containerRect.top + scrollY;
                if (!(rBot < y || rTop > y + h)) {
                    const fname = row.dataset.fname;
                    if (!this.selectedFilenames.has(fname)) {
                        this.selectedFilenames.add(fname);
                        row.classList.add('selected');
                        const c = row.querySelector('input'); if(c) c.checked = true;
                    }
                }
            });
            this.updateHeaderCheckboxState();
        }
    });
})();