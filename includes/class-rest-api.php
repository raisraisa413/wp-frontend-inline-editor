<?php
/**
 * REST API Controller for Live Frontend Text Editor
 * Handles secure saving of post_title and post_content from frontend inline editor.
 */

if (!defined('ABSPATH')) exit;

class WFIE_Rest_API {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes() {
        register_rest_route('wfie/v1', '/save', [
            'methods'             => 'POST',
            'callback'            => [__CLASS__, 'handle_save'],
            'permission_callback' => [__CLASS__, 'check_permission'],
            'args'                => [
                'post_id' => [
                    'required'          => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param) && intval($param) > 0;
                    },
                    'sanitize_callback' => 'absint',
                ],
                'post_title' => [
                    'required'          => false,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'post_content' => [
                    'required'          => false,
                    'type'              => 'string',
                ],
            ],
        ]);
    }

    public static function check_permission($request) {
        $post_id = absint($request->get_param('post_id'));
        if (!$post_id) {
            return new WP_Error('wfie_no_id', 'ID postingan tidak valid.', ['status' => 400]);
        }

        if (!is_user_logged_in()) {
            return new WP_Error('wfie_not_logged_in', 'Anda harus login terlebih dahulu.', ['status' => 401]);
        }

        if (!current_user_can('edit_post', $post_id)) {
            return new WP_Error('wfie_forbidden', 'Anda tidak memiliki izin untuk mengedit postingan ini.', ['status' => 403]);
        }

        return true;
    }

    public static function handle_save($request) {
        $post_id      = absint($request->get_param('post_id'));
        $title_raw    = $request->get_param('post_title');
        $content_raw  = $request->get_param('post_content');

        $existing_post = get_post($post_id);
        if (!$existing_post) {
            return new WP_Error('wfie_not_found', 'Postingan tidak ditemukan di database.', ['status' => 404]);
        }

        $update_data = [
            'ID' => $post_id,
        ];

        if ($title_raw !== null) {
            $update_data['post_title'] = sanitize_text_field($title_raw);
        }

        if ($content_raw !== null) {
            // Pertahankan elemen style/SVG untuk admin yang memiliki kapabilitas unfiltered_html
            if (current_user_can('unfiltered_html')) {
                $update_data['post_content'] = $content_raw;
            } else {
                $update_data['post_content'] = wp_kses_post($content_raw);
            }
        }

        // Simpan ke WordPress Database & buat revisi otomatis
        $updated_id = wp_update_post($update_data, true);

        if (is_wp_error($updated_id)) {
            return new WP_Error('wfie_save_failed', $updated_id->get_error_message(), ['status' => 500]);
        }

        // Tandai bahwa halaman/post ini telah diedit lewat Live Frontend Editor
        update_post_meta($post_id, '_wfie_custom_edited', current_time('mysql'));

        return rest_ensure_response([
            'success'   => true,
            'message'   => 'Perubahan berhasil disimpan!',
            'post_id'   => $post_id,
            'timestamp' => current_time('mysql'),
        ]);
    }
}
