use super::{classification::AIClassificationInputFile, cleanup::AICleanupInputCandidate};

pub fn ai_file_classification_system_prompt(enable_thinking: bool) -> String {
    let mut lines = vec![
        "You are the Zen Canvas AI file classification engine.",
        "Classify files only from metadata: file name, extension, path, parent directory, size, modified time, directory flag, and existing classification fields.",
        "Do not invent or infer file content.",
        "Do not output Markdown.",
        "Do not output code fences.",
        "Return only JSON.",
        "Do not suggest directly deleting files.",
        "targetTemplate must be a relative path template, never an absolute path.",
        "When uncertain, use suggestedAction = Review.",
        "Sensitive files must set requiresConfirmation = true.",
        "Low confidence files must set requiresConfirmation = true.",
        "Allowed fileType values: Document, Image, Video, Audio, Code, ArchivePackage, Installer, Spreadsheet, Presentation, Other.",
        "Allowed purpose values: Project, Teaching, Study, Work, Personal, Career, Finance, Identity, Media, Installer, Temporary, Archive, Unknown.",
        "Allowed lifecycle values: Inbox, Active, Reference, Archive, Disposable, Duplicate, Sensitive.",
        "Allowed riskLevel values: Normal, Sensitive, System, Unknown.",
        "Allowed suggestedAction values: Keep, Move, MoveAndRename, Archive, Review, DeleteCandidate.",
        "Return JSON in this exact shape: {\"classifications\":[{\"id\":\"file-id\",\"fileType\":\"Document\",\"purpose\":\"Teaching\",\"lifecycle\":\"Active\",\"context\":\"Scala\",\"riskLevel\":\"Normal\",\"suggestedAction\":\"Move\",\"targetTemplate\":\"Teaching/Scala/试卷\",\"suggestedName\":\"\",\"confidence\":0.92,\"reason\":\"文件名包含 Scala、期末、复习题，判断为教学考试资料。\",\"keywords\":[\"Scala\",\"期末\",\"复习题\"],\"requiresConfirmation\":false}]}",
    ];
    if !enable_thinking {
        lines.push("Do not output thinking, reasoning traces, chain-of-thought, or analysis.");
    }
    lines.join("\n")
}

pub fn build_ai_classification_prompt(
    files: &[AIClassificationInputFile],
    learned_rules: &[String],
) -> Result<String, String> {
    serde_json::to_string_pretty(&serde_json::json!({
        "task": "classifyFiles",
        "learnedRulesInstruction": "以下是用户已经确认过的分类习惯，请优先参考，但不要违反安全规则。",
        "learnedRules": learned_rules,
        "files": files,
    }))
    .map_err(|error| format!("failed to build AI classification prompt: {error}"))
}

pub fn ai_cleanup_analysis_system_prompt(enable_thinking: bool) -> String {
    let mut lines = vec![
        "You are the Zen Canvas file cleanup risk analyzer.",
        "You only analyze existing cleanup candidates. You do not execute cleanup.",
        "You must not directly delete, move, or trash files.",
        "You must not suggest bypassing Zen Canvas Safe Trash, preview, confirmation, or restore flows.",
        "Be conservative. If uncertain, return tier = Review or tier = Caution.",
        "Return only JSON.",
        "Do not output Markdown.",
        "Do not output code fences.",
        "Allowed tier values: Safe, Review, Caution.",
        "Allowed suggestedAction values: MoveToTrash, Reveal, UninstallAdvice, AppInternalCleanup, None.",
        "System paths must not be cleaned.",
        "Windows, Program Files, and ProgramData paths must not be cleaned.",
        "AppData should not default to MoveToTrash.",
        "Browser profiles must be Caution.",
        "Chat application databases must be Caution.",
        "Database files must be Caution.",
        "Virtual machine images must be Caution.",
        "Unknown large files can only be Review.",
        "Caution items must set selectedByDefault = false.",
        "If the original trashAllowed is false, you must not change trashAllowed to true.",
        "Do not invent candidateId values.",
        "Do not invent or rewrite paths.",
        "You may improve category, reason, and riskNote text.",
        "Return JSON in this exact shape: {\"analyses\":[{\"candidateId\":\"id\",\"tier\":\"Safe\",\"category\":\"可重新生成的依赖目录\",\"suggestedAction\":\"MoveToTrash\",\"confidence\":0.95,\"reason\":\"该目录是 node_modules，通常可通过包管理器重新生成。\",\"riskNote\":\"如果存在 npm link、本地补丁或未提交依赖改动，清理前应确认。\",\"trashAllowed\":true,\"selectedByDefault\":true}]}",
    ];
    if !enable_thinking {
        lines.push("Do not output thinking, reasoning traces, chain-of-thought, or analysis.");
    }
    lines.join("\n")
}

pub fn build_ai_cleanup_analysis_prompt(
    candidates: &[AICleanupInputCandidate],
) -> Result<String, String> {
    serde_json::to_string_pretty(&serde_json::json!({
        "task": "analyzeCleanupCandidates",
        "candidates": candidates,
    }))
    .map_err(|error| format!("failed to build AI cleanup analysis prompt: {error}"))
}
