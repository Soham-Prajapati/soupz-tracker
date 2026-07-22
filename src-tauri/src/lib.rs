use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

/// Open (or focus) the Settings window. Cmd+, and the app menu both land here.
fn open_settings(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Campaign Settings")
    .inner_size(560.0, 620.0)
    .resizable(true)
    .build();
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// The panel that drops down from the menu bar icon.
fn toggle_panel(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("panel") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
        return;
    }
    let _ = WebviewWindowBuilder::new(
        app,
        "panel",
        WebviewUrl::App("index.html?window=panel".into()),
    )
    .title("Campaign")
    .inner_size(420.0, 620.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            // ---- App menu: adds Settings (Cmd+,) next to the standard items ----
            let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+Comma"))?;
            let app_submenu = Submenu::with_items(
                app,
                "Campaign",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &settings_item,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;
            let edit_submenu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;
            let view_submenu = Submenu::with_items(
                app,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app, None)?],
            )?;
            let menu = Menu::with_items(app, &[&app_submenu, &edit_submenu, &view_submenu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == "settings" {
                    open_settings(app);
                }
            });

            // ---- Menu bar tray icon ----
            let tray_open = MenuItem::with_id(app, "open", "Open Campaign", true, None::<&str>)?;
            let tray_settings = MenuItem::with_id(app, "tsettings", "Settings…", true, None::<&str>)?;
            let tray_quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
            let tray_menu = Menu::with_items(app, &[&tray_open, &tray_settings, &tray_quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("Campaign — today's plan")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main(app),
                    "tsettings" => open_settings(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_panel(tray.app_handle());
                    }
                })
                .build(app)?;

            let _ = handle;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it instead of quitting: the tray icon
            // stays live, the way Docker and Wispr Flow behave.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
