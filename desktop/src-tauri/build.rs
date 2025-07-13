fn main() {
    // Skip tauri build when running tests
    if std::env::var("CARGO_CFG_TEST").is_ok() {
        return;
    }

    tauri_build::build()
}
