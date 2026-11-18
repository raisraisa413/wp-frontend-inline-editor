/**
 * Live Frontend Text Editor (WFIE) - Client Engine
 * Pure Vanilla JavaScript
 */

(function () {
    'use strict';

    if (window.WFIE) return;

    var WFIE = {
        isEditing: false,
        isDirty: false,
        isSaving: false,
        titleEl: null,
        contentEl: null,
        origTitle: '',
        origContent: '',
        dockEl: null,
        toolbarEl: null,
        statusLabel: null,
        btnToggle: null,
        btnSave: null,
        btnDiscard: null,
        toastEl: null,

        init: function () {
            var self = this;
            if (typeof wfieConfig === 'undefined') return;

            // Cache DOM elements
            self.dockEl      = document.getElementById('wfie-dock');
            self.toolbarEl   = document.getElementById('wfie-toolbar');
            self.statusLabel = document.getElementById('wfie-status-label');
            self.btnToggle   = document.getElementById('wfie-btn-toggle');
            self.btnSave     = document.getElementById('wfie-btn-save');
            self.btnDiscard  = document.getElementById('wfie-btn-discard');
            self.toastEl     = document.getElementById('wfie-toast');

            if (!self.dockEl) return;

            // Tampilkan floating dock
            self.dockEl.style.display = 'block';

            // Temukan elemen judul dan konten
            self.findElements();

            // Bind Events
            self.bindEvents();
        },

        findElements: function () {
            var self = this;
            var titleSel = wfieConfig.titleSelector || 'h1.entry-title, h1.page-title, .entry-title, h1:first-of-type';
            var contentSel = wfieConfig.contentSelector || '.entry-content, .post-content, main article, main, .bk-content-wrap';

            self.titleEl = document.querySelector(titleSel);
            self.contentEl = document.querySelector(contentSel);
        },

        bindEvents: function () {
            var self = this;

            // Toggle Mode Edit
            if (self.btnToggle) {
                self.btnToggle.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.toggleEditMode();
                });
            }

            // Simpan Perubahan
            if (self.btnSave) {
                self.btnSave.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.saveChanges();
                });
            }

            // Batal Perubahan
            if (self.btnDiscard) {
                self.btnDiscard.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.discardChanges();
                });
            }

            // Keyboard Shortcut Ctrl+S / Cmd+S
            document.addEventListener('keydown', function (e) {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    if (self.isEditing && self.isDirty) {
                        e.preventDefault();
                        self.saveChanges();
                    }
                }
            });

            // Deteksi Unsaved Changes saat user menutup tab browser
            window.addEventListener('beforeunload', function (e) {
                if (self.isEditing && self.isDirty) {
                    var msg = wfieConfig.i18n.unsavedWarn || 'Ada perubahan belum disimpan.';
                    e.preventDefault();
                    e.returnValue = msg;
                    return msg;
                }
            });

            // Cegah klik link membuka halaman lain saat sedang dalam Mode Edit
            document.addEventListener('click', function (e) {
                if (!self.isEditing) return;
                var link = e.target.closest('[data-wfie-editable="true"] a');
                if (link) {
                    e.preventDefault();
                }
            }, true);

            // Floating Selection Toolbar Handling
            document.addEventListener('selectionchange', function () {
                if (!self.isEditing) return;
                self.updateFloatingToolbar();
            });

            // Toolbar Button Actions
            if (self.toolbarEl) {
                var buttons = self.toolbarEl.querySelectorAll('button[data-cmd]');
                buttons.forEach(function (btn) {
                    btn.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        var cmd = btn.getAttribute('data-cmd');
                        var val = btn.getAttribute('data-val') || null;
                        document.execCommand(cmd, false, val);
                        self.markDirty();
                        self.updateFloatingToolbar();
                    });
                });

                // Link Action
                var btnLink = document.getElementById('wfie-btn-link');
                if (btnLink) {
                    btnLink.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        var url = prompt('Masukkan URL tautan:', 'https://');
                        if (url) {
                            document.execCommand('createLink', false, url);
                            self.markDirty();
                        }
                    });
                }
            }
        },

        toggleEditMode: function () {
            var self = this;
            self.findElements();

            if (!self.isEditing) {
                self.enableEditMode();
            } else {
                if (self.isDirty) {
                    var confirmExit = confirm(wfieConfig.i18n.unsavedWarn || 'Ada perubahan belum disimpan. Ingin keluar tanpa menyimpan?');
                    if (!confirmExit) return;
                    self.discardChanges();
                }
                self.disableEditMode();
            }
        },

        enableEditMode: function () {
            var self = this;
            self.isEditing = true;
            document.body.classList.add('wfie-editing-active');
            self.dockEl.classList.add('wfie-editing');

            var titleInsideContent = (self.contentEl && self.titleEl && self.contentEl.contains(self.titleEl));

            // Simpan snapshot asli untuk fitur batal
            if (self.titleEl && !titleInsideContent) {
                self.origTitle = self.titleEl.innerHTML;
                self.titleEl.setAttribute('contenteditable', 'true');
                self.titleEl.setAttribute('data-wfie-editable', 'true');
                self.titleEl.addEventListener('input', self.onContentInput);
            }

            if (self.contentEl) {
                self.origContent = self.contentEl.innerHTML;
                self.contentEl.setAttribute('contenteditable', 'true');
                self.contentEl.setAttribute('data-wfie-editable', 'true');
                self.contentEl.addEventListener('input', self.onContentInput);
                self.lockAdminManagedZones();
            }

            // Tampilkan tombol kontrol
            self.btnSave.style.display = 'inline-flex';
            self.btnDiscard.style.display = 'inline-flex';
            self.statusLabel.textContent = wfieConfig.i18n.editModeOn || 'Mode Edit Aktif';

            var hasLocked = self.contentEl && self.contentEl.querySelectorAll('.ppb-admin-managed-zone').length > 0;
            if (hasLocked) {
                self.showToast('Mode Edit Aktif! Teks berbingkai emas bisa diedit langsung; blok biru 🔒 diubah lewat WP Admin.');
            } else {
                self.showToast('Mode Edit Aktif! Klik teks mana saja untuk mengedit.');
            }
        },

        lockAdminManagedZones: function () {
            var self = this;
            if (!self.contentEl) return;

            // Fallback untuk grid dosen statis/tercache jika tidak memakai shortcode wrapper
            var dosenGrid = self.contentEl.querySelector('.bk-dosen-grid');
            if (dosenGrid && !dosenGrid.closest('.ppb-admin-managed-zone')) {
                dosenGrid.classList.add('ppb-admin-managed-zone');
                dosenGrid.setAttribute('data-ppb-admin-label', 'Direktori Dosen & SINTA');
                dosenGrid.setAttribute('data-ppb-admin-url', (wfieConfig.adminUrl || '/wp-admin/') + 'admin.php?page=bk-direktori-dosen');
            }

            var zones = self.contentEl.querySelectorAll('.ppb-admin-managed-zone');
            zones.forEach(function (zone) {
                zone.setAttribute('contenteditable', 'false');

                if (!zone.querySelector(':scope > .ppb-admin-managed-badge')) {
                    var label = zone.getAttribute('data-ppb-admin-label') || 'Portal PPB FIP';
                    var url = zone.getAttribute('data-ppb-admin-url') || (wfieConfig.adminUrl || '/wp-admin/') + 'admin.php?page=ppb-portal-hub';

                    var badge = document.createElement('a');
                    badge.className = 'ppb-admin-managed-badge';
                    badge.href = url;
                    badge.target = '_blank';
                    badge.rel = 'noopener';
                    badge.setAttribute('contenteditable', 'false');
                    badge.title = 'Bagian ini dikelola dari database WP Admin. Klik untuk membuka halaman pengelolaannya.';
                    badge.textContent = '🔒 Ubah via WP Admin: ' + label + ' ↗';
                    zone.insertBefore(badge, zone.firstChild);
                }

                if (!zone.getAttribute('data-wfie-lock-bound')) {
                    zone.setAttribute('data-wfie-lock-bound', 'true');
                    zone.addEventListener('click', function (e) {
                        if (!self.isEditing) return;
                        if (e.target.closest('.ppb-admin-managed-badge')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        var lbl = zone.getAttribute('data-ppb-admin-label') || 'WP Admin';
                        self.showToast('🔒 Bagian "' + lbl + '" diubah lewat WP Admin. Klik tombol biru di pojok blok.', true);
                    });
                }
            });
        },

        unlockAdminManagedZones: function () {
            var self = this;
            if (!self.contentEl) return;
            var badges = self.contentEl.querySelectorAll('.ppb-admin-managed-badge');
            badges.forEach(function (b) { b.remove(); });
            var zones = self.contentEl.querySelectorAll('.ppb-admin-managed-zone');
            zones.forEach(function (zone) {
                zone.removeAttribute('contenteditable');
            });
        },

        disableEditMode: function () {
            var self = this;
            self.isEditing = false;
            self.isDirty = false;
            document.body.classList.remove('wfie-editing-active');
            self.dockEl.classList.remove('wfie-editing');
            self.dockEl.classList.remove('wfie-dirty');

            self.unlockAdminManagedZones();

            if (self.titleEl) {
                self.titleEl.removeAttribute('contenteditable');
                self.titleEl.removeAttribute('data-wfie-editable');
                self.titleEl.removeEventListener('input', self.onContentInput);
            }

            if (self.contentEl) {
                self.contentEl.removeAttribute('contenteditable');
                self.contentEl.removeAttribute('data-wfie-editable');
                self.contentEl.removeEventListener('input', self.onContentInput);
            }

            self.hideToolbar();
            self.btnSave.style.display = 'none';
            self.btnDiscard.style.display = 'none';
            self.statusLabel.textContent = wfieConfig.i18n.editModeOff || 'Mode Normal';
        },

        onContentInput: function () {
            WFIE.markDirty();
        },

        markDirty: function () {
            var self = this;
            if (!self.isDirty) {
                self.isDirty = true;
                self.dockEl.classList.add('wfie-dirty');
                self.statusLabel.textContent = 'Ada perubahan belum disimpan';
            }
        },

        discardChanges: function () {
            var self = this;
            var titleInsideContent = (self.contentEl && self.titleEl && self.contentEl.contains(self.titleEl));
            if (self.titleEl && self.origTitle && !titleInsideContent) {
                self.titleEl.innerHTML = self.origTitle;
            }
            if (self.contentEl && self.origContent) {
                self.contentEl.innerHTML = self.origContent;
            }
            self.findElements();
            self.isDirty = false;
            self.dockEl.classList.remove('wfie-dirty');
            self.statusLabel.textContent = wfieConfig.i18n.editModeOn || 'Mode Edit Aktif';
            self.hideToolbar();
            self.showToast('Perubahan dibatalkan.');
        },

        updateFloatingToolbar: function () {
            var self = this;
            var selection = window.getSelection();
            if (!selection || selection.isCollapsed || !self.toolbarEl) {
                self.hideToolbar();
                return;
            }

            var range = selection.getRangeAt(0);
            var commonAncestor = range.commonAncestorContainer;
            var containerEl = commonAncestor.nodeType === 1 ? commonAncestor : commonAncestor.parentElement;

            // Pastikan seleksi berada di dalam elemen yang sedang diedit
            if (!containerEl.closest('[data-wfie-editable="true"]')) {
                self.hideToolbar();
                return;
            }

            var rect = range.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                self.hideToolbar();
                return;
            }

            // Posisi di atas teks yang dipilih
            var scrollY = window.pageYOffset || document.documentElement.scrollTop;
            var scrollX = window.pageXOffset || document.documentElement.scrollLeft;

            var top = rect.top + scrollY - 45;
            var left = rect.left + scrollX + (rect.width / 2);

            self.toolbarEl.style.top = top + 'px';
            self.toolbarEl.style.left = left + 'px';
            self.toolbarEl.style.display = 'flex';
        },

        hideToolbar: function () {
            var self = this;
            if (self.toolbarEl) {
                self.toolbarEl.style.display = 'none';
            }
        },

        saveChanges: function () {
            var self = this;
            if (self.isSaving) return;

            self.isSaving = true;
            self.statusLabel.textContent = wfieConfig.i18n.saving || 'Menyimpan...';

            var payload = {
                post_id: wfieConfig.postId
            };

            if (self.titleEl) {
                payload.post_title = self.titleEl.innerText.trim();
            }

            if (self.contentEl) {
                var clone = self.contentEl.cloneNode(true);
                clone.removeAttribute('contenteditable');
                clone.removeAttribute('data-wfie-editable');

                // Hapus badge UI editor agar tidak ikut tersimpan ke database
                clone.querySelectorAll('.ppb-admin-managed-badge').forEach(function (b) {
                    b.remove();
                });

                // Kembalikan blok shortcode dinamis ke tag [ppb_...] aslinya
                clone.querySelectorAll('.ppb-admin-managed-zone[data-ppb-shortcode]').forEach(function (zone) {
                    var rawShortcode = zone.getAttribute('data-ppb-shortcode');
                    if (rawShortcode && zone.parentNode) {
                        zone.parentNode.replaceChild(document.createTextNode(rawShortcode), zone);
                    }
                });

                // Bersihkan sisa atribut editor di dalam clone
                clone.querySelectorAll('[contenteditable]').forEach(function (el) {
                    el.removeAttribute('contenteditable');
                });
                clone.querySelectorAll('[data-wfie-lock-bound]').forEach(function (el) {
                    el.removeAttribute('data-wfie-lock-bound');
                });

                if (self.contentEl.classList.contains('bk-page-wrapper')) {
                    payload.post_content = clone.outerHTML;
                } else {
                    payload.post_content = clone.innerHTML;
                }
            }

            fetch(wfieConfig.restUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': wfieConfig.nonce
                },
                body: JSON.stringify(payload)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                self.isSaving = false;
                if (data.success) {
                    self.isDirty = false;
                    self.dockEl.classList.remove('wfie-dirty');
                    self.statusLabel.textContent = wfieConfig.i18n.saved || 'Perubahan tersimpan!';
                    if (self.titleEl) self.origTitle = self.titleEl.innerHTML;
                    if (self.contentEl) self.origContent = self.contentEl.innerHTML;
                    self.showToast('✅ Berhasil disimpan ke WordPress!');
                } else {
                    self.statusLabel.textContent = 'Gagal menyimpan!';
                    self.showToast('❌ ' + (data.message || 'Gagal menyimpan.'), true);
                }
            })
            .catch(function (err) {
                self.isSaving = false;
                self.statusLabel.textContent = 'Gagal menyimpan!';
                self.showToast('❌ Kesalahan koneksi jaringan.', true);
            });
        },

        showToast: function (message, isError) {
            var self = this;
            if (!self.toastEl) return;

            self.toastEl.textContent = message;
            self.toastEl.className = 'wfie-toast' + (isError ? ' wfie-toast-error' : '');
            self.toastEl.style.display = 'flex';

            clearTimeout(self.toastTimer);
            self.toastTimer = setTimeout(function () {
                self.toastEl.style.display = 'none';
            }, 3500);
        }
    };

    // Auto-init on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            WFIE.init();
        });
    } else {
        WFIE.init();
    }

    window.WFIE = WFIE;
})();
