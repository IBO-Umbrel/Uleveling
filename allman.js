#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Recursively gather .ts/.js/.tsx/.jsx files under a directory
function gatherFiles(dir, out = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (["node_modules", "dist", ".next", "coverage", ".turbo"].includes(e.name)) continue;
            gatherFiles(full, out);
        } else if (/\.(ts|js|tsx|jsx)$/.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

function applyAllmanToFile(filePath) {
    let text = fs.readFileSync(filePath, "utf8");
    const orig = text;
    const lines = text.split(/\r?\n/);
    const out = [];
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Match arrow functions ending with '{' (e.g. '... => {')
        const arrowMatch = line.match(/^(\s*)(.*=>)\s*\{\s*(?:\/\/.*)?$/);
        if (arrowMatch) {
            const indent = arrowMatch[1];
            const before = arrowMatch[2].replace(/\s+$/, "");
            const comment = (line.match(/(\/\/.*)$/) || ["", ""])[1];
            out.push(indent + before);
            out.push(indent + "{" + (comment ? " " + comment : ""));
            changed = true;
            continue;
        }

        // Match common control/decl constructs ending with '{' on same line
        const ctrlMatch = line.match(
            /^(\s*)(.*\b(?:if|for|while|switch|else if|else|try|catch|finally|function|class)\b.*)\s*\{\s*(?:\/\/.*)?$/
        );
        if (ctrlMatch) {
            const indent = ctrlMatch[1];
            const before = ctrlMatch[2].replace(/\s+$/, "");
            const comment = (line.match(/(\/\/.*)$/) || ["", ""])[1];
            out.push(indent + before);
            out.push(indent + "{" + (comment ? " " + comment : ""));
            changed = true;
            continue;
        }

        // Avoid touching single-line constructs that may include template literals
        // or complex inline expressions — keep those as-is to avoid breaking code.
        // (We intentionally do not transform single-line blocks here.)

        // Default: keep line
        out.push(line);
    }

    const newText = out.join("\n");
    if (changed && newText !== orig) {
        fs.writeFileSync(filePath, newText, "utf8");
        return true;
    }
    return false;
}

function main() {
    const root = process.cwd();
    const target = path.join(root, "src");
    if (!fs.existsSync(target)) {
        console.error("No src/ directory found in", root);
        process.exit(1);
    }

    const files = gatherFiles(target);
    if (files.length === 0) {
        console.log("No .ts/.js files found under src/");
        return;
    }

    let modified = 0;
    for (const f of files) {
        try {
            if (applyAllmanToFile(f)) {
                console.log("Patched:", path.relative(root, f));
                modified++;
            }
        } catch (err) {
            console.error("Error processing", f, err.message);
        }
    }

    console.log(`Done — modified ${modified} file(s).`);
}

if (require.main === module) main();
