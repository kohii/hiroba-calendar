# Updating pstack

This directory contains a vendored copy of the pstack plugin for project-level use.

## Current Version

- **Version**: 0.15.28
- **Commit**: ddf824aff1e55ba14bd666b30bce3fc69962abe6
- **Source**: https://github.com/cursor/plugins/tree/main/pstack
- **Repository**: https://github.com/cursor/plugins

## How to Update

To update to the latest version of pstack, use this script:

```bash
#!/bin/bash
# update-pstack.sh - Update pstack from GitHub source

REPO_URL="https://github.com/cursor/plugins"
TARGET_DIR=".cursor/skills/pstack"

# Clone sparse checkout of pstack directory
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"
git init
git remote add origin "$REPO_URL"
git config core.sparseCheckout true
echo "pstack/" > .git/info/sparse-checkout
git pull --depth=1 origin main

# Get commit info
LATEST_COMMIT=$(git rev-parse HEAD)
NEW_VERSION=$(grep -o '"version": "[^"]*"' pstack/plugin.json | cut -d'"' -f4)

# Backup and replace
cd "$OLDPWD"
if [ -d "$TARGET_DIR" ]; then
  mv "$TARGET_DIR" "${TARGET_DIR}.backup-$(date +%Y%m%d-%H%M%S)"
fi

mkdir -p "$TARGET_DIR"
cp -r "$TMP_DIR/pstack"/* "$TARGET_DIR/"
rm -rf "$TMP_DIR"

echo "Updated pstack to v$NEW_VERSION (commit: $LATEST_COMMIT)"
echo "Remember to update UPDATE.md with new version/commit and commit the changes"
```

### Manual Update

1. Clone the plugins repository:
   ```bash
   git clone --depth 1 https://github.com/cursor/plugins /tmp/cursor-plugins
   cd /tmp/cursor-plugins
   COMMIT=$(git rev-parse HEAD)
   ```

2. Copy pstack and get version:
   ```bash
   rm -rf .cursor/skills/pstack
   cp -r pstack .cursor/skills/pstack
   VERSION=$(grep -o '"version": "[^"]*"' .cursor/skills/pstack/plugin.json | cut -d'"' -f4)
   ```

3. Update this file with new version and commit, then commit changes:
   ```bash
   # Update UPDATE.md manually with $VERSION and $COMMIT
   git add .cursor/skills/pstack
   git commit -m "chore: update pstack plugin to v$VERSION"
   ```

4. Clean up:
   ```bash
   rm -rf /tmp/cursor-plugins
   ```

## License

pstack is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Documentation

- pstack guide: https://github.com/cursor/plugins/tree/main/pstack/docs/guide
- Skills discovery: According to pstack's documentation, `.cursor/skills/` is a standard location for project-level skills (alongside `~/.cursor/skills/` and `~/.cursor/plugins/`)
