use std::fs;
use tauri::Manager;

#[tauri::command]
fn save_image(
    app: tauri::AppHandle,
    id: String,
    data: Vec<u8>,
    ext: String,
    subdir: Vec<String>,
) -> Result<String, String> {
    // Validate each path component to prevent directory traversal
    for part in &subdir {
        if part.is_empty() || part.contains("..") || part.starts_with('/') || part.starts_with('\\') {
            return Err(format!("Invalid directory component: {}", part));
        }
    }

    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");

    let dir = subdir.iter().fold(base, |acc, part| acc.join(part));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.{}", id, ext));
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_image(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let images_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    let p = std::path::PathBuf::from(&path);
    if !p.starts_with(&images_dir) {
        return Err("Access denied: path is outside images directory".into());
    }
    if p.exists() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_image, delete_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
