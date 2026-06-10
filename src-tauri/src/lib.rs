use std::fs;

const ALLOWED_DATA_FILES: &[&str] = &["notebooks.json", "tags.json", "versions.json"];
const NOTE_INDEX_FILE: &str = "index.json";

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

fn notes_dir() -> Result<std::path::PathBuf, String> {
    Ok(data_dir()?.join("notes"))
}

fn safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
}

fn note_path(notebook_id: &str, id: &str) -> Result<std::path::PathBuf, String> {
    Ok(notes_dir()?.join(notebook_id).join(format!("{}.json", id)))
}

// ─── Per-note file commands ───────────────────────────────────────────────────

#[tauri::command]
fn write_note_file(id: String, notebook_id: String, content: String) -> Result<(), String> {
    if !safe_id(&id) { return Err(format!("Invalid note id: {}", id)); }
    if !safe_id(&notebook_id) { return Err(format!("Invalid notebook id: {}", notebook_id)); }
    let path = note_path(&notebook_id, &id)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_note_file(id: String, notebook_id: String) -> Result<String, String> {
    if !safe_id(&id) { return Err(format!("Invalid note id: {}", id)); }
    if !safe_id(&notebook_id) { return Err(format!("Invalid notebook id: {}", notebook_id)); }
    let path = note_path(&notebook_id, &id)?;
    if !path.exists() { return Ok(String::new()); }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note_file(id: String, notebook_id: String) -> Result<(), String> {
    if !safe_id(&id) { return Err(format!("Invalid note id: {}", id)); }
    if !safe_id(&notebook_id) { return Err(format!("Invalid notebook id: {}", notebook_id)); }
    let path = note_path(&notebook_id, &id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn move_note_file(id: String, from_notebook_id: String, to_notebook_id: String) -> Result<(), String> {
    if !safe_id(&id) { return Err(format!("Invalid note id: {}", id)); }
    if !safe_id(&from_notebook_id) { return Err(format!("Invalid from notebook id: {}", from_notebook_id)); }
    if !safe_id(&to_notebook_id) { return Err(format!("Invalid to notebook id: {}", to_notebook_id)); }
    let src = note_path(&from_notebook_id, &id)?;
    let dst = note_path(&to_notebook_id, &id)?;
    if !src.exists() { return Ok(()); }
    fs::create_dir_all(dst.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::rename(&src, &dst).map_err(|e| e.to_string())
}

// ─── Note index ───────────────────────────────────────────────────────────────

#[tauri::command]
fn write_note_index(content: String) -> Result<(), String> {
    let dir = notes_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(NOTE_INDEX_FILE), content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_note_index() -> Result<String, String> {
    let path = notes_dir()?.join(NOTE_INDEX_FILE);
    if !path.exists() { return Ok(String::new()); }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// ─── Shared data files (notebooks, tags, versions) ───────────────────────────

#[tauri::command]
fn read_data_file(filename: String) -> Result<String, String> {
    if !ALLOWED_DATA_FILES.contains(&filename.as_str()) {
        return Err(format!("Not allowed: {}", filename));
    }
    let path = data_dir()?.join(&filename);
    if !path.exists() { return Ok(String::new()); }
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

// ─── Image commands ───────────────────────────────────────────────────────────

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
            write_note_file,
            read_note_file,
            delete_note_file,
            move_note_file,
            write_note_index,
            read_note_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
