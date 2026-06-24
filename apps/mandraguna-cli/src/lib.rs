//! `mandraguna-cli` library crate - CLI tools for the Vacti platform.
//!
//! Exposes the [`cli`] entry point and the [`commands`] dispatch layer.
#![forbid(unsafe_code)]

pub mod application;
pub mod cli;
pub mod commands;
pub mod domain;
pub mod infrastructure;
