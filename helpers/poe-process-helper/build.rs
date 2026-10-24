fn main() {
    println!("cargo:rerun-if-changed=../../renderer/assets/logo/windows/icon.ico");

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os != "windows" {
        return;
    }

    let mut resource = winresource::WindowsResource::new();
    resource.set_icon("../../renderer/assets/logo/windows/icon.ico");
    resource
        .compile()
        .expect("failed to embed Windows metadata into PoE process helper");
}
