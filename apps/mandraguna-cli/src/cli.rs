//! CLI argument parsing and dispatch for `mandraguna-cli`.
//!
//! Defines the top-level [`Cli`] struct, the [`Commands`] enum, and
//! the [`run`] function that orchestrates parsing and subcommand dispatch.
use clap::{Parser, Subcommand};

/// Top-level CLI configuration for `mandraguna-cli`.
#[derive(Debug, Parser)]
#[command(
    name = "mandraguna-cli",
    about = "CLI tools for the Vacti vulnerability assessment platform",
    version
)]
pub struct Cli {
    /// Enable verbose output with additional details.
    #[arg(short = 'v', long, global = true)]
    pub verbose: bool,

    /// Suppress all output except errors.
    #[arg(short = 'q', long, global = true)]
    pub quiet: bool,

    /// Output format: text, json, or markdown.
    #[arg(short = 'o', long, default_value = "text", global = true)]
    pub output: String,

    /// Disable colored output.
    #[arg(long, global = true)]
    pub no_color: bool,

    /// Subcommand to execute.
    #[command(subcommand)]
    pub command: Commands,
}

/// Top-level subcommands for `mandraguna-cli`.
#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Print version and platform information.
    Version,
}

/// Dispatch a fully-parsed [`Cli`] value to the appropriate subcommand
/// handler and return an exit code.
///
/// Separated from [`run`] so tests can inject a constructed [`Cli`] without
/// touching `std::env::args`.
///
/// Returns an exit code:
/// - `0` on success
/// - `2` on invalid arguments (unknown output format)
pub fn dispatch(cli: &Cli) -> i32 {
    match cli.output.as_str() {
        "text" | "json" | "markdown" => {}
        other => {
            eprintln!("Error: unknown output format {other:?}: must be text, json, or markdown");
            return 2;
        }
    }

    match &cli.command {
        Commands::Version => {
            if !cli.quiet {
                println!("mandraguna-cli {}", env!("CARGO_PKG_VERSION"));
            }
            0
        }
    }
}

/// Parse CLI arguments, validate them, and dispatch to the appropriate
/// subcommand handler.
///
/// Returns an exit code:
/// - `0` on success
/// - `2` on invalid arguments (unknown output format)
pub fn run() -> i32 {
    let cli = Cli::parse();
    dispatch(&cli)
}

#[cfg(test)]
mod tests {
    use super::{Cli, Commands, dispatch};

    fn make_cli(output: &str, quiet: bool, verbose: bool) -> Cli {
        Cli {
            verbose,
            quiet,
            output: output.to_owned(),
            no_color: false,
            command: Commands::Version,
        }
    }

    #[test]
    fn test_dispatch_version_text_returns_zero() {
        let cli = make_cli("text", false, false);
        assert_eq!(dispatch(&cli), 0);
    }

    #[test]
    fn test_dispatch_version_json_returns_zero() {
        let cli = make_cli("json", false, false);
        assert_eq!(dispatch(&cli), 0);
    }

    #[test]
    fn test_dispatch_version_markdown_returns_zero() {
        let cli = make_cli("markdown", false, false);
        assert_eq!(dispatch(&cli), 0);
    }

    #[test]
    fn test_dispatch_version_quiet_returns_zero() {
        let cli = make_cli("text", true, false);
        assert_eq!(dispatch(&cli), 0);
    }

    #[test]
    fn test_dispatch_unknown_format_returns_two() {
        let cli = make_cli("xml", false, false);
        assert_eq!(dispatch(&cli), 2);
    }
}
