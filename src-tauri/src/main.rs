// SiteLens Studio desktop shell: runs the Node server as a sidecar (bundled
// Node + the server code from resources/app), shows its page in a window and
// keeps syncing from the menu bar after the window is closed.
//
// The server stays on 127.0.0.1:4318 because Google's OAuth redirect URI is
// registered for that address. If something is already listening there (the
// dev server), the app uses it rather than starting a second one.
//
// Live development (`npm run desktop:dev`): a debug build with STUDIO_DEV_URL
// set shows that page (Vite's dev server, which reloads on save) instead of the
// built one, with the API from `npm run dev` on 4318. Release builds ignore it.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const PORT: u16 = 4318;
const ORIGIN: &str = "http://127.0.0.1:4318/";
const START_TIMEOUT: Duration = Duration::from_secs(30);

// Links that leave Studio (and target=_blank ones, which a webview drops) become
// plain navigations, so `on_navigation` can hand them to the system browser.
// Google refuses OAuth inside embedded webviews, so sign-in goes there too.
const LINK_SCRIPT: &str = r#"
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const url = new URL(a.href, location.href);
  if (a.target === '_blank' || url.origin !== location.origin || url.pathname === '/auth/google') {
    e.preventDefault();
    location.href = url.href;
  }
}, true);
window.open = (u) => { location.href = new URL(u, location.href).href; return null; };
"#;

struct Sidecar(Mutex<Option<CommandChild>>);

fn port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn server_up() -> bool {
    port_open(PORT)
}

fn dev_url() -> Option<url::Url> {
    if !cfg!(debug_assertions) {
        return None;
    }
    std::env::var("STUDIO_DEV_URL").ok().and_then(|u| u.parse().ok())
}

// The page the window shows: the dev server's in live development, else Studio's own.
fn page_url() -> url::Url {
    dev_url().unwrap_or_else(|| ORIGIN.parse().unwrap())
}

fn page_up() -> bool {
    match dev_url() {
        Some(u) => server_up() && port_open(u.port_or_known_default().unwrap_or(PORT)),
        None => server_up(),
    }
}

// Studio's own pages (and the splash page) stay in the window; /auth/google is
// the start of Google sign-in, which has to happen in a real browser.
fn stays_inside(url: &url::Url) -> bool {
    if url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") {
        return true;
    }
    let local = matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"));
    let port = url.port_or_known_default();
    let ours = port == Some(PORT) || dev_url().map_or(false, |d| port == d.port_or_known_default());
    local && ours && url.path() != "/auth/google"
}

fn log_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_log_dir().ok().map(|dir| {
        let _ = fs::create_dir_all(&dir);
        dir.join("server.log")
    })
}

fn append_log(path: &Option<PathBuf>, line: &str) {
    if let Some(path) = path {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(f, "{}", line.trim_end());
        }
    }
}

fn start_server(app: &AppHandle) -> Result<(), String> {
    if server_up() {
        return Ok(());
    }
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let code = resources.join("app");
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    let (mut events, child) = app
        .shell()
        .sidecar("node")
        .map_err(|e| e.to_string())?
        .args(["--no-warnings=ExperimentalWarning", "server/index.mjs"])
        .current_dir(&code)
        .env("STUDIO_DATA_DIR", data.to_string_lossy().to_string())
        .env("PORT", PORT.to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    app.state::<Sidecar>().0.lock().unwrap().replace(child);

    let log = log_path(app);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => append_log(&log, &String::from_utf8_lossy(&bytes)),
                CommandEvent::Error(err) => append_log(&log, &format!("[sidecar error] {err}")),
                CommandEvent::Terminated(status) => append_log(&log, &format!("[server exited] {:?}", status.code)),
                _ => {}
            }
        }
    });
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let opener = app.clone();
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("SiteLens Studio")
        .inner_size(1360.0, 900.0)
        .min_inner_size(720.0, 480.0)
        .initialization_script(LINK_SCRIPT)
        .on_navigation(move |url| {
            if stays_inside(url) {
                return true;
            }
            let _ = opener.opener().open_url(url.as_str(), None::<&str>);
            false
        })
        .build();
    let Ok(window) = window else { return };

    // Swap the splash page for Studio as soon as the server answers.
    let log = log_path(app);
    std::thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < START_TIMEOUT {
            if page_up() {
                let _ = window.navigate(page_url());
                return;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        let at = log.map(|p| p.display().to_string()).unwrap_or_default();
        let _ = window.eval(&format!(
            "document.querySelector('p').textContent = {:?}",
            format!("SiteLens Studio’s server didn’t start. Its log is at {at}")
        ));
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            if let Err(err) = start_server(handle) {
                append_log(&log_path(handle), &format!("[start failed] {err}"));
            }

            let open = MenuItem::with_id(app, "open", "Open SiteLens Studio", true, None::<&str>)?;
            let browser = MenuItem::with_id(app, "browser", "Open in browser", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit SiteLens Studio", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &browser, &PredefinedMenuItem::separator(app)?, &quit])?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("SiteLens Studio")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "browser" => {
                        let _ = app.opener().open_url(page_url().as_str(), None::<&str>);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            show_main(handle);
            Ok(())
        })
        // Closing the window hides it: the server keeps syncing from the menu bar.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build SiteLens Studio")
        .run(|app, event| match event {
            // Dock icon clicked with the window hidden.
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => show_main(app),
            // Only Quit (an explicit exit code) ends the app; a closed window doesn't.
            RunEvent::ExitRequested { code: None, api, .. } => api.prevent_exit(),
            RunEvent::Exit => {
                if let Some(child) = app.state::<Sidecar>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
            _ => {}
        });
}
