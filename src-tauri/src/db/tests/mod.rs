use super::*;
use crate::{
    file_ops::OperationLogDto,
    settings::{save_app_settings, AppSettings, OrganizeRootMode},
};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

include!("part1.rs");
include!("part2.rs");
include!("part3.rs");
include!("helpers.rs");
