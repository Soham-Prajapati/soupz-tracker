mod engine_store;
mod tracker_state;

use std::{collections::BTreeMap, fs, io, path::Path};
use tauri::utils::config::WindowEffectsConfig;
use tauri::utils::{WindowEffect, WindowEffectState};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder,
};
use tracker_state::{MutationResult, TrackerPatch, TrackerState, TrackerStateStore, TRACKER_STATE_EVENT};
use engine_store::EngineStateStore;
use serde_json::Value;

fn copy_missing_tree(source: &Path, target: &Path) -> io::Result<()> {
    if !source.exists() { return Ok(()); }
    if source.is_file() {
        if !target.exists() {
            if let Some(parent) = target.parent() { fs::create_dir_all(parent)?; }
            fs::copy(source, target)?;
        }
        return Ok(());
    }
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        copy_missing_tree(&entry.path(), &target.join(entry.file_name()))?;
    }
    Ok(())
}

fn migrate_legacy_app_data(home: &Path, app_data: &Path) -> io::Result<()> {
    let legacy_support = home.join("Library/Application Support/app.soupz.desktop");
    for name in ["tracker-state.json", "engine-state.json"] {
        copy_missing_tree(&legacy_support.join(name), &app_data.join(name))?;
    }
    let legacy_web_storage = home.join("Library/WebKit/app.soupz.desktop/WebsiteData/LocalStorage");
    let current_web_storage = home.join("Library/WebKit/com.soupz.tracker/WebsiteData/LocalStorage");
    copy_missing_tree(&legacy_web_storage, &current_web_storage)
}

fn broadcast_committed(app: &tauri::AppHandle, result: &MutationResult) {
    if result.committed {
        let _ = app.emit(TRACKER_STATE_EVENT, &result.state);
    }
}

#[tauri::command]
fn get_tracker_state(store: State<'_, TrackerStateStore>) -> TrackerState {
    store.snapshot()
}

#[tauri::command]
fn get_engine_plans(store: State<'_, EngineStateStore>) -> Result<Vec<Value>, String> {
    store.plans().map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_engine_plan(store: State<'_, EngineStateStore>, plan: Value) -> Result<(), String> {
    store.upsert_plan(plan).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_engine_plan(store: State<'_, EngineStateStore>, plan_id: String) -> Result<(), String> {
    store.remove_plan(&plan_id).map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn migrate_tracker_state(
    app: tauri::AppHandle,
    store: State<'_, TrackerStateStore>,
    legacy_done: BTreeMap<String, bool>,
    legacy_pushed: BTreeMap<String, String>,
) -> Result<MutationResult, String> {
    let result = store
        .migrate(legacy_done, legacy_pushed)
        .map_err(|error| error.to_string())?;
    broadcast_committed(&app, &result);
    Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
fn apply_tracker_patch(
    app: tauri::AppHandle,
    store: State<'_, TrackerStateStore>,
    expected_revision: u64,
    done: BTreeMap<String, bool>,
    pushed: BTreeMap<String, String>,
) -> Result<MutationResult, String> {
    let result = store
        .apply(expected_revision, TrackerPatch { done, pushed })
        .map_err(|error| error.to_string())?;
    broadcast_committed(&app, &result);
    Ok(result)
}

#[tauri::command]
fn merge_tracker_remote(
    app: tauri::AppHandle,
    store: State<'_, TrackerStateStore>,
    done: BTreeMap<String, bool>,
    pushed: BTreeMap<String, String>,
    complete: bool,
) -> Result<MutationResult, String> {
    let result = store
        .merge_remote(TrackerPatch { done, pushed }, complete)
        .map_err(|error| error.to_string())?;
    broadcast_committed(&app, &result);
    Ok(result)
}

#[tauri::command]
fn acknowledge_tracker_sync(
    app: tauri::AppHandle,
    store: State<'_, TrackerStateStore>,
    done: BTreeMap<String, bool>,
    pushed: BTreeMap<String, String>,
) -> Result<MutationResult, String> {
    let result = store
        .acknowledge(TrackerPatch { done, pushed })
        .map_err(|error| error.to_string())?;
    broadcast_committed(&app, &result);
    Ok(result)
}

#[tauri::command]
fn replace_tracker_account(
    app: tauri::AppHandle,
    store: State<'_, TrackerStateStore>,
    done: BTreeMap<String, bool>,
    pushed: BTreeMap<String, String>,
) -> Result<MutationResult, String> {
    let result = store.replace_for_account(TrackerPatch { done, pushed })
        .map_err(|error| error.to_string())?;
    broadcast_committed(&app, &result);
    Ok(result)
}

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
    .title("Soupz Tracker Settings")
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
    .title("Soupz Tracker")
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
        let _ = tray.set_tooltip(Some(&format!("Soupz Tracker — {} of {} done today", done, total)));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_tray_progress,
            get_tracker_state,
            migrate_tracker_state,
            apply_tracker_patch,
            merge_tracker_remote,
            acknowledge_tracker_sync,
            replace_tracker_account,
            get_engine_plans,
            upsert_engine_plan,
            remove_engine_plan,
        ])
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();
            let app_data = app.path().app_data_dir()?;
            if let Ok(home) = app.path().home_dir() {
                migrate_legacy_app_data(&home, &app_data)?;
            }
            let state_path = app_data.join("tracker-state.json");
            app.manage(TrackerStateStore::open(state_path)?);
            let engine_path = app_data.join("engine-state.json");
            app.manage(EngineStateStore::new(engine_path));

            // ---- App menu: adds Settings (Cmd+,) next to the standard items ----
            let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+Comma"))?;
            let app_submenu = Submenu::with_items(
                app,
                "Soupz Tracker",
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
            let tray_open = MenuItem::with_id(app, "open", "Open Soupz Tracker", true, None::<&str>)?;
            let tray_settings = MenuItem::with_id(app, "tsettings", "Settings…", true, None::<&str>)?;
            let tray_quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
            let tray_menu = Menu::with_items(app, &[&tray_open, &tray_settings, &tray_quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(
                    tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))
                        .unwrap_or_else(|_| app.default_window_icon().unwrap().clone()),
                )
                .icon_as_template(true)
                .tooltip("Soupz Tracker — today's plan")
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

#[cfg(test)]
mod migration_tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn legacy_app_support_and_web_storage_copy_only_missing_files() {
        let root = std::env::temp_dir().join(format!("soupz-legacy-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let legacy_support = root.join("Library/Application Support/app.soupz.desktop");
        let legacy_web = root.join("Library/WebKit/app.soupz.desktop/WebsiteData/LocalStorage");
        fs::create_dir_all(&legacy_support).unwrap();
        fs::create_dir_all(&legacy_web).unwrap();
        fs::write(legacy_support.join("tracker-state.json"), b"legacy").unwrap();
        fs::write(legacy_web.join("localstorage.sqlite3"), b"web").unwrap();
        let current = root.join("Library/Application Support/com.soupz.tracker");
        migrate_legacy_app_data(&root, &current).unwrap();
        assert_eq!(fs::read(current.join("tracker-state.json")).unwrap(), b"legacy");
        assert_eq!(fs::read(root.join("Library/WebKit/com.soupz.tracker/WebsiteData/LocalStorage/localstorage.sqlite3")).unwrap(), b"web");
        fs::write(current.join("tracker-state.json"), b"current").unwrap();
        migrate_legacy_app_data(&root, &current).unwrap();
        assert_eq!(fs::read(current.join("tracker-state.json")).unwrap(), b"current");
        let _ = fs::remove_dir_all(root);
    }
}
