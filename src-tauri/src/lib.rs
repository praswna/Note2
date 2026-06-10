use std::fs;

const ALLOWED_DATA_FILES: &[&str] = &["notes.json", "notebooks.json", "tags.json", "versions.json"];

fn exe_dir() -> Result<std::path::PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Cannot determine executable directory".to_string())
        .map(|p| p.to_path_buf())
}

fn images_dir() -> Result<std::path::PathBuf, String> {
    Ok(exe_dir()?.join("data").join("images"))
}

fn data_dir() -> Result<std::path::PathBuf, String> {
    Ok(exe_dir()?.join("data"))
}

#[tauri::command]
fn read_data_file(filename: String) -> Result<String, String> {
    if !ALLOWED_DATA_FILES.contains(&filename.as_str()) {
        return Err(format!("Not allowed: {}", filename));
    }
    let path = data_dir()?.join(&filename);
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_data_file(filename: String, content: String) -> Result<(), String> {
    if !ALLOWED_DATA_FILES.contains(&filename.as_str()) {
        return Err(format!("Not allowed: {}", filename));
    }
    let dir = data_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(&filename), content).map_err(|e| e.to_string())
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
        .invoke_handler(tauri::generate_handler![
            save_image,
            delete_image,
            read_data_file,
            write_data_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
