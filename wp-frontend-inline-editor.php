<?php
/**
 * Plugin Name: Live Frontend Text Editor
 * Plugin URI:  https://bk-fip.unm.ac.id/
 * Description: Plugin WordPress untuk mengedit judul dan teks konten artikel/halaman secara visual langsung pada frontend (Live WYSIWYG) tanpa membuka WP Admin.
 * Version:     1.0.0
 * Author:      Jurusan PPB / BK FIP UNM
 * License:     GPL-2.0+
 * Text Domain: wp-frontend-inline-editor
 */

if (!defined('ABSPATH')) exit;

define('WFIE_VERSION', '1.0.0');
define('WFIE_FILE', __FILE__);
define('WFIE_PATH', plugin_dir_path(__FILE__));
define('WFIE_URL', plugin_dir_url(__FILE__));

require_once WFIE_PATH . 'includes/class-rest-api.php';
require_once WFIE_PATH . 'includes/class-admin-settings.php';

WFIE_Rest_API::init();
WFIE_Admin_Settings::init();

/**
 * Cek apakah halaman saat ini memenuhi syarat untuk mengaktifkan editor frontend
 */
function wfie_can_user_edit_current_post() {
    if (!is_user_logged_in()) {
        return false;
    }

    if (!is_singular()) {
        return false;
    }

    $post_id = get_the_ID();
    if (!$post_id) {
        return false;
    }

    $options = WFIE_Admin_Settings::get_options();
    $post_type = get_post_type($post_id);

    if (!in_array($post_type, (array) $options['enabled_post_types'])) {
        return false;
    }

    $min_cap = $options['min_capability'] ?? 'edit_posts';
    if (!current_user_can($min_cap) || !current_user_can('edit_post', $post_id)) {
        return false;
    }

    return true;
}

/**
 * Tambahkan Tombol "✏️ Mode Edit Frontend" pada WP Admin Bar
 */
function wfie_add_admin_bar_node($wp_admin_bar) {
    if (!wfie_can_user_edit_current_post()) {
        return;
    }

    $wp_admin_bar->add_node([
        'id'    => 'wfie-edit-toggle',
        'title' => '<span class="ab-icon dashicons dashicons-edit"></span><span class="ab-label">Mode Edit Frontend</span>',
        'href'  => '#',
        'meta'  => [
            'class'   => 'wfie-admin-bar-btn',
            'onclick' => 'if(window.WFIE){ window.WFIE.toggleEditMode(); } return false;',
            'title'   => 'Aktifkan pengeditan teks langsung pada halaman ini',
        ],
    ]);
}
add_action('admin_bar_menu', 'wfie_add_admin_bar_node', 999);

/**
 * Enqueue Script dan Style di Frontend jika user berwenang
 */
function wfie_enqueue_assets() {
    if (!wfie_can_user_edit_current_post()) {
        return;
    }

    $options = WFIE_Admin_Settings::get_options();

    wp_enqueue_style(
        'wfie-editor-css',
        WFIE_URL . 'assets/css/editor-frontend.css',
        [],
        WFIE_VERSION
    );

    wp_enqueue_script(
        'wfie-editor-js',
        WFIE_URL . 'assets/js/editor-frontend.js',
        [],
        WFIE_VERSION,
        true
    );

    wp_localize_script('wfie-editor-js', 'wfieConfig', [
        'restUrl'         => esc_url_raw(rest_url('wfie/v1/save')),
        'adminUrl'        => esc_url_raw(admin_url()),
        'nonce'           => wp_create_nonce('wp_rest'),
        'postId'          => get_the_ID(),
        'titleSelector'   => $options['title_selector'],
        'contentSelector' => $options['content_selector'],
        'i18n'            => [
            'saving'      => 'Menyimpan perubahan...',
            'saved'       => 'Perubahan tersimpan!',
            'saveError'   => 'Gagal menyimpan perubahan. Coba lagi.',
            'unsavedWarn' => 'Ada perubahan teks yang belum disimpan. Yakin ingin meninggalkan halaman ini?',
            'editModeOn'  => 'Mode Edit: Aktif',
            'editModeOff' => 'Mode Edit: Nonaktif',
            'clickToEdit' => 'Klik untuk mengedit teks',
        ],
    ]);
}
add_action('wp_enqueue_scripts', 'wfie_enqueue_assets');

/**
 * Render Floating Dock HTML di footer halaman
 */
function wfie_render_floating_dock() {
    if (!wfie_can_user_edit_current_post()) {
        return;
    }
    ?>
    <!-- WFIE Live Frontend Text Editor Floating Dock -->
    <div id="wfie-dock" class="wfie-dock-container wfie-collapsed" style="display:none;">
        <div class="wfie-dock-inner">
            <div class="wfie-dock-status">
                <span class="wfie-status-dot"></span>
                <span class="wfie-status-text" id="wfie-status-label">Mode Baca</span>
            </div>

            <div class="wfie-dock-actions">
                <button type="button" id="wfie-btn-toggle" class="wfie-btn wfie-btn-toggle" title="Aktifkan/Nonaktifkan Mode Edit">
                    <span class="wfie-btn-icon">✏️</span>
                    <span class="wfie-btn-label">Mode Edit</span>
                </button>

                <button type="button" id="wfie-btn-save" class="wfie-btn wfie-btn-save" style="display:none;" title="Simpan Perubahan (Ctrl+S)">
                    <span class="wfie-btn-icon">💾</span>
                    <span class="wfie-btn-label">Simpan</span>
                </button>

                <button type="button" id="wfie-btn-discard" class="wfie-btn wfie-btn-discard" style="display:none;" title="Batal Perubahan">
                    <span class="wfie-btn-icon">↺</span>
                    <span class="wfie-btn-label">Batal</span>
                </button>
            </div>
        </div>
    </div>

    <!-- WFIE Floating Text Formatting Toolbar (Medium / Notion Style) -->
    <div id="wfie-toolbar" class="wfie-floating-toolbar" style="display:none;">
        <button type="button" data-cmd="bold" title="Tebal (Ctrl+B)"><b>B</b></button>
        <button type="button" data-cmd="italic" title="Miring (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Garis Bawah (Ctrl+U)"><u>U</u></button>
        <button type="button" data-cmd="formatBlock" data-val="h2" title="Heading 2">H2</button>
        <button type="button" data-cmd="formatBlock" data-val="h3" title="Heading 3">H3</button>
        <button type="button" data-cmd="formatBlock" data-val="p" title="Paragraf Biasa">¶</button>
        <button type="button" data-cmd="insertUnorderedList" title="Daftar Poin (List)">• List</button>
        <button type="button" id="wfie-btn-link" title="Sisipkan Tautan URL">🔗 Link</button>
    </div>

    <!-- Floating Cursor Hover Indicator -->
    <div id="wfie-hover-pill" class="wfie-hover-pill" style="display:none;"></div>

    <!-- Toast Notification -->
    <div id="wfie-toast" class="wfie-toast" style="display:none;"></div>
    <?php
}
add_action('wp_footer', 'wfie_render_floating_dock');
