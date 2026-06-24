//! `mandraguna-cli` binary entry point.
#![forbid(unsafe_code)]

fn main() {
    let exit_code = mandraguna_cli::cli::run();
    std::process::exit(exit_code);
}
