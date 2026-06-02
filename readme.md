# Blueprint to 3D Wireframe Converter

    ## Blueprint Processing

    Upload a black-and-white blueprint PNG, and the app will:

    Detect dark line segments.
    Convert them into a simple wireframe.
    Extrude them vertically.
    Generate an OBJ file.
    Provide a download link.

    This is a minimal MVP. The next significant improvement would be replacing the row-scan line detector with Hough transform or PDF vector extraction so architectural plans are converted much more accurately.

## Workflow

md

Upload File
     │
     ▼
Extract Blueprint Lines
     │
     ▼
Build Wireframe Geometry
     │
     ▼
Export OBJ

## PDF pipeline

md

PDF
  ↓
PDFium
  ↓
Extract Vector Paths
  ↓
Convert Paths → Lines
  ↓
Extrude
  ↓
OBJ / GLTF

## Backend

[src/AxumServer.rs]
Handle HTTP requests and file uploads

[src/blueprint.rs]
Extract blueprint lines from images

[src/buleprintlines.rs]
Handle file uploads and vector processing

[src/DataStructures.rs]
Data structures for lines and meshes

[src/extrusion.rs]
Convert 2D lines into 3D wireframe segments

[src/main.rs]
Main application entry point

[src/obj.rs]
Export wireframe to OBJ format

[src/UploadHandler.rs]
Handle file uploads

[src/vectorize.rs]
Extract lines from blueprint images

[src/wireframe.rs]
Build wireframe geometry from lines

## Frontend

[1/2/static/index.html]
Simple HTML interface for uploading files and downloading OBJ

[1/2/static/app.js]
JavaScript for handling file uploads and downloads

## Cargo

### [cargo.toml](cargo.toml)

toml
[package]
name = "blueprint3d"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.8", features = ["multipart"] }
tokio = { version = "1", features = ["full"] }
pdfium-render = "0.8"
tower-http = { version = "0.6", features = ["fs"] }

serde = { version = "1", features = ["derive"] }
serde_json = "1"

image = "0.25"
imageproc = "0.25"

uuid = { version = "1", features = ["v4"] }

anyhow = "1"
thiserror = "2"

tracing = "0.1"
tracing-subscriber = "0.3"

## Rust's package manager

Usage: cargo [+toolchain] [OPTIONS] [COMMAND]
       cargo [+toolchain] [OPTIONS] -Zscript <MANIFEST_RS> [ARGS]...

Options:
  -V, --version                  Print version info and exit
      --list                     List installed commands
      --explain `<CODE>`         Provide a detailed explanation of a rustc error message
  -v, --verbose...               Use verbose output (-vv very verbose/build.rs output)
  -q, --quiet                    Do not print cargo log messages
      --color `<WHEN>`           Coloring [possible values: auto, always, never]
  -C `<DIRECTORY>`                 Change to DIRECTORY before doing anything (nightly-only)
      --locked                   Assert that `Cargo.lock` will remain unchanged
      --offline                  Run without accessing the network
      --frozen                   Equivalent to specifying both --locked and --offline
      --config `<KEY=VALUE|PATH>`  Override a configuration value
  -Z `<FLAG>`                      Unstable (nightly-only) flags to Cargo, see 'cargo -Z help' for details
  -h, --help                     Print help

## Commands

    build, b    Compile the current package
    check, c    Analyze the current package and report errors, but don't build object files
    clean       Remove the target directory
    doc, d      Build this package's and its dependencies' documentation
    new         Create a new cargo package
    init        Create a new cargo package in an existing directory
    add         Add dependencies to a manifest file
    remove      Remove dependencies from a manifest file
    run, r      Run a binary or example of the local package
    test, t     Run the tests
    bench       Run the benchmarks
    update      Update dependencies listed in Cargo.lock
    search      Search registry for crates
    publish     Package and upload this package to the registry
    install     Install a Rust binary
    uninstall   Uninstall a Rust binary
    ...         See all commands with --list

See 'cargo help `<command>`' for more information on a specific command

Kill Rust-related processes

In PowerShell:

taskkill /F /IM rust-analyzer.exe
taskkill /F /IM cargo.exe
taskkill /F /IM rustc.exe

Clean target directory

Try:

cargo clean

If Windows still complains:

taskkill /F /IM Code.exe

Close VS Code completely and retry deleting target.

Step 3: Rebuild
cargo build

Exclude the project from antivirus
Windows Defender is a common culprit for Rust builds.
Open:
Windows Security→ Virus & threat protection→ Manage settings→ Exclusions
Add:
C:\Users\dividicus\wireframe from image
and optionally:
C:\Users\dividicus\.cargoC:\Users\dividicus\.rustup

Step 5: Avoid spaces in project names
Your path is:
C:\Users\dividicus\wireframe from image
Rust handles spaces, but some tools behave better without them.
Consider:
cd ..ren "wireframe from image" wireframe_from_imagecd wireframe_from_imagecargo build

Useful diagnostics
Run:
cargo build -vv
and:
cargo tree
If the build still fails after killing processes and cleaning target, paste:
Get-Process | findstr rust
and your current Cargo.toml, and I can pinpoint what's holding the file lock.