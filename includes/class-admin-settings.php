<?php
/**
 * Admin Settings for Live Frontend Text Editor
 */

if (!defined('ABSPATH')) exit;

class WFIE_Admin_Settings {

    const OPTION_NAME = 'wfie_settings';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'add_settings_page']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
    }

    public static function get_options() {
        $defaults = [
            'enabled_post_types' => ['page', 'post'],
            'title_selector'     => 'h1.entry-title, h1.page-title, .entry-title, h1:first-of-type',
            'content_selector'   => '.ppb-article-body, .bk-page-wrapper, .entry-content, .post-content, main article, main, .bk-content-wrap',
            'min_capability'     => 'edit_posts',
        ];
        return wp_parse_args(get_option(self::OPTION_NAME, []), $defaults);
    }

    public static function add_settings_page() {
        add_options_page(
            'Pengaturan Frontend Text Editor',
            'Frontend Text Editor',
            'manage_options',
            'wfie-settings',
            [__CLASS__, 'render_settings_page']
        );

        // Integrasi otomatis ke menu Portal PPB FIP jika plugin BK Connect Core aktif
        global $menu;
        $has_ppb_hub = false;
        if (is_array($menu)) {
            foreach ($menu as $item) {
                if (!empty($item[2]) && $item[2] === 'ppb-portal-hub') {
                    $has_ppb_hub = true;
                    break;
                }
            }
        }
        if ($has_ppb_hub || function_exists('ppb_register_portal_hub_menu')) {
            add_submenu_page(
                'ppb-portal-hub',
                'Pengaturan Live Frontend Text Editor',
                '✏️ Live Frontend Editor',
                'manage_options',
                'wfie-settings',
                [__CLASS__, 'render_settings_page']
            );
        }
    }

    public static function register_settings() {
        register_setting('wfie_settings_group', self::OPTION_NAME, [
            'sanitize_callback' => [__CLASS__, 'sanitize_settings'],
        ]);
    }

    public static function sanitize_settings($input) {
        $clean = [];
        $clean['enabled_post_types'] = !empty($input['enabled_post_types']) && is_array($input['enabled_post_types'])
            ? array_map('sanitize_key', $input['enabled_post_types'])
            : ['page', 'post'];
        $clean['title_selector']   = sanitize_text_field($input['title_selector'] ?? '');
        $clean['content_selector'] = sanitize_text_field($input['content_selector'] ?? '');
        $clean['min_capability']   = sanitize_text_field($input['min_capability'] ?? 'edit_posts');
        return $clean;
    }

    public static function render_settings_page() {
        $options = self::get_options();
        $post_types = get_post_types(['public' => true], 'objects');
        ?>
        <div class="wrap">
            <h1>✏️ Pengaturan Live Frontend Text Editor</h1>
            <p>Konfigurasikan target elemen yang dapat diedit langsung di tampilan depan situs.</p>

            <form method="post" action="options.php" style="background:#fff; padding:24px; border-radius:12px; border:1px solid #cbd5e1; max-width:750px; margin-top:20px;">
                <?php settings_fields('wfie_settings_group'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">Tipe Konten yang Diaktifkan</th>
                        <td>
                            <?php foreach ($post_types as $pt) : ?>
                                <label style="display:inline-block; margin-right:16px; margin-bottom:8px;">
                                    <input type="checkbox" name="<?php echo self::OPTION_NAME; ?>[enabled_post_types][]" value="<?php echo esc_attr($pt->name); ?>" <?php checked(in_array($pt->name, $options['enabled_post_types'])); ?>>
                                    <?php echo esc_html($pt->label); ?> (<code><?php echo esc_html($pt->name); ?></code>)
                                </label>
                            <?php endforeach; ?>
                            <p class="description">Pilih jenis postingan yang tombol "Mode Edit Frontend"-nya akan aktif.</p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row"><label for="title_selector">CSS Selector Judul Halaman</label></th>
                        <td>
                            <input type="text" id="title_selector" name="<?php echo self::OPTION_NAME; ?>[title_selector]" value="<?php echo esc_attr($options['title_selector']); ?>" class="regular-text" style="width:100%;">
                            <p class="description">Selector CSS untuk menemukan judul artikel/halaman. Default: <code>h1.entry-title, h1.page-title, .entry-title, h1:first-of-type</code></p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row"><label for="content_selector">CSS Selector Konten Utama</label></th>
                        <td>
                            <input type="text" id="content_selector" name="<?php echo self::OPTION_NAME; ?>[content_selector]" value="<?php echo esc_attr($options['content_selector']); ?>" class="regular-text" style="width:100%;">
                            <p class="description">Selector CSS untuk menemukan area konten artikel. Default: <code>.entry-content, .post-content, main article, main, .bk-content-wrap</code></p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Simpan Pengaturan'); ?>
            </form>
        </div>
        <?php
    }
}
