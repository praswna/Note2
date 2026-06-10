use std::fs;

fn images_dir() -> Result<std::path::PathBuf, String> {
    let dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Cannot determine executable directory".to_string())?
        .join("images");
    Ok(dir)
}

#[tauri::command]
fn save_image(id: String, data: Vec<u8>, ext: String, subdir: Vec<String>) -> Result<String, String> {
    for part in &subdir {
        if part.is_empty() || part.contains("..") || part.starts_with('/') || part.starts_with('\\') {
            return Err(format!("Invalid directory component: {}", part));
        }
    }
    let dir = subdir.iter().fold(images_dir()?, |acc, part| acc.join(part));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.{}", id, ext));
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_image(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if !p.starts_with(images_dir()?) {
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
