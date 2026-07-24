use tauri::utils::config::WindowEffectsConfig;
use tauri::utils::{WindowEffect, WindowEffectState};
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
    .title("Soup Tracker Settings")
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

/// Place the panel directly beneath the menu bar icon, nudged left so it stays
/// on screen when the icon sits near the right edge.
fn place_panel(w: &tauri::WebviewWindow, icon: tauri::PhysicalPosition<f64>) {
    let scale = w.scale_factor().unwrap_or(1.0);
    let size = w.outer_size().map(|s| s.width as f64).unwrap_or(420.0 * scale);
    let mut x = icon.x - size / 2.0;
    if let Ok(Some(mon)) = w.current_monitor() {
        let mw = mon.size().width as f64;
        let margin = 8.0 * scale;
        x = x.min(mw - size - margin).max(margin);
    }
    let _ = w.set_position(tauri::PhysicalPosition::new(x, icon.y + 6.0));
}

/// The panel that drops down from the menu bar icon.
fn toggle_panel(app: &tauri::AppHandle, icon: tauri::PhysicalPosition<f64>) {
    if let Some(w) = app.get_webview_window("panel") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.set_visible_on_all_workspaces(true);
            place_panel(&w, icon);
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
    .title("Soup Tracker")
    .inner_size(360.0, 540.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .transparent(true)
    .shadow(true)
    .effects(WindowEffectsConfig {
        effects: vec![WindowEffect::Popover],
        state: Some(WindowEffectState::Active),
        radius: Some(12.0),
        color: None,
    })
    .build();

    if let Some(w) = app.get_webview_window("panel") {
        // Join every space and float above fullscreen apps, like a real menu bar popover.
        let _ = w.set_visible_on_all_workspaces(true);
        place_panel(&w, icon);
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Frontend pushes today's progress up so the menu bar shows it live,
/// the way CodeBurn shows spend rather than just an icon.
#[tauri::command]
fn set_tray_progress(app: tauri::AppHandle, done: u32, total: u32) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(Some(format!("{}/{}", done, total)));
        let _ = tray.set_tooltip(Some(&format!("Soup Tracker — {} of {} done today", done, total)));
    }
}

/// What the frontend needs to render an "update available" notice, without
/// knowing anything about the update protocol.
#[derive(Clone, serde::Serialize)]
struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
}

/// Ask the update server whether a newer build exists. Returns `None` when we
/// are already current. Never installs anything — that is `install_update`'s job,
/// so the frontend can show the version and ask before touching the app.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
            notes: update.body.clone(),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Download + install the pending update, emitting `updater://progress`
/// ({ downloaded, total }) as bytes arrive, then relaunch into the fresh build.
/// `app.restart()` is exactly what tauri-plugin-process's `restart` command
/// calls internally, so no extra plugin or permission is needed.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    let app_for_progress = app.clone();
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            move |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                let _ = app_for_progress.emit(
                    "updater://progress",
                    serde_json::json!({ "downloaded": downloaded, "total": content_length }),
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;

    // Relaunch into the freshly-installed bundle. Diverges (`-> !`), so this
    // is the function's terminating expression.
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_tray_progress, check_for_update, install_update])
        .plugin(tauri_plugin_updater::Builder::new().build())
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
                "Soup Tracker",
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
            let tray_open = MenuItem::with_id(app, "open", "Open Soup Tracker", true, None::<&str>)?;
            let tray_settings = MenuItem::with_id(app, "tsettings", "Settings…", true, None::<&str>)?;
            let tray_quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
            let tray_menu = Menu::with_items(app, &[&tray_open, &tray_settings, &tray_quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(
                    tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))
                        .unwrap_or_else(|_| app.default_window_icon().unwrap().clone()),
                )
                .icon_as_template(true)
                .tooltip("Soup Tracker — today's plan")
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
                        position,
                        ..
                    } = event
                    {
                        toggle_panel(tray.app_handle(), position);
                    }
                })
                .build(app)?;

            let _ = handle;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it instead of quitting: the tray icon
            // stays live, the way Docker and Wispr Flow behave.
            if let tauri::WindowEvent::Focused(false) = event {
                if window.label() == "panel" {
                    let _ = window.hide();
                }
            }
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
