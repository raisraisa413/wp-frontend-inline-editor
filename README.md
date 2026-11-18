# Live Frontend Text Editor (`wp-frontend-inline-editor`)

Plugin WordPress untuk mengedit judul dan teks konten artikel/halaman secara visual langsung pada frontend (Live WYSIWYG) tanpa perlu masuk ke editor klasik/Gutenberg di WP Admin.

## Fitur Utama
- **Floating Control Dock** (`✏️ Mode Edit` / `💾 Simpan` / `↺ Batal`) di sudut kanan bawah halaman bagi Admin/Editor yang sedang login.
- **Shortcut WP Admin Bar** (`✏️ Mode Edit Frontend`).
- **Floating Formatting Toolbar** (Bold, Italic, Underline, H2, H3, Paragraph, Bullet List, Link) bergaya Medium/Notion saat teks diblok.
- **Penyimpanan Instan via REST API (`Ctrl + S`)** lengkap dengan revisi otomatis WordPress & kompatibilitas penuh dengan tema **BK FIP UNM (`bk-fip-wordpress`)** serta **Portal PPB FIP (`bk-connect-core`)**.

## Cara Pasang dengan Deployer for Git
1. Buka **WP Admin → Deployer for Git → Install Plugin**.
2. Pilih **Provider Type**: `GitHub`.
3. Masukkan **Repository URL**:
   ```
   https://github.com/raisraisa413/wp-frontend-inline-editor
   ```
4. Pilih **Branch**: `main`.
5. Jika repositori diatur **Public**, kosongkan kolom Access Token. Jika **Private**, masukkan GitHub Personal Access Token (PAT) Anda.
6. Klik **Install Plugin**, lalu aktifkan plugin **Live Frontend Text Editor** di menu **Plugins**.
