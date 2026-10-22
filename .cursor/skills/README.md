# Project Skills

This directory contains project-level Cursor skills that are available to all agents working in this repository.

## Installed Skills

### pstack (v0.15.28)

**Author**: Lauren Tan (poteto)  
**Description**: "if you want to go fast, go deep first" - Rigorous agent workflows for writing high-quality code with fearless parallelism.

**Source**: https://github.com/cursor/plugins/tree/main/pstack  
**License**: MIT

pstack provides 56 skills including:
- `/poteto-mode` - Main workflow orchestrator with 23 playbooks
- `/setup-pstack` - Configure models and reasoning budgets  
- `/poteto-help` - Get guidance on which skill to use
- Architecture, investigation, refactoring, and verification workflows
- And many more...

See [pstack/README.md](./pstack/README.md) for full documentation and [pstack/UPDATE.md](./pstack/UPDATE.md) for update instructions.

## Usage

All skills from this directory are automatically available to Cursor agents in this repository.

## Skills Discovery

According to pstack's own documentation, Cursor discovers skills from:
- `.cursor/skills/` - Project-local skills (this directory) ✅
- `~/.cursor/skills/` - User-global skills
- `~/.cursor/plugins/` - Installed plugins

**Source**: https://github.com/cursor/plugins/tree/main/pstack/docs/guide (see references to `.cursor/skills/` in guide sections 01, 06, and 09)

## Adding New Skills

Individual project-specific skills can be added directly:
```
.cursor/skills/my-skill/
├── SKILL.md
└── references/
```

Large skill collections can be vendored as subdirectories like pstack.
