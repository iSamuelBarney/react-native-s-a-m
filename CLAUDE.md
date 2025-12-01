# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type check without emitting
npm run clean      # Remove dist/ directory
npm run codegen    # Run Nitro codegen (npx nitrogen)
```

## Architecture

**S.A.M (State Awareness Manager)** is a React Native Nitro Module providing reactive storage with native C++ performance.

### Storage Types

- **Warm Storage**: Fast key-value storage (MMKV-based) for frequently accessed data
- **Cold Storage**: SQLite for relational/persistent data
- **Secure Storage**: iOS Keychain / Android Keystore with biometric auth (requires `react-native-keychain`)

### Core Files

- `src/SideFx.ts` - Main `Air` API wrapper around the native Nitro module. Handles listener callbacks, auto-initialization of default storage instances, and network monitoring methods.
- `src/specs/SideFx.nitro.ts` - Nitro module type definitions (the native interface spec)
- `src/hooks.ts` - React hooks: `useWarm`, `useCold`, `useStorage`
- `src/useNetwork.ts` - Network monitoring hooks: `useNetwork`, `useIsOnline`, `useNetworkQuality`
- `src/secure.ts` - SecureStorage API wrapping react-native-keychain
- `src/useSecure.ts` - React hooks for secure storage
- `src/mfe.ts` - Micro-frontend state tracking utilities
- `src/types.ts` - TypeScript types for hooks and errors

### Key Patterns

1. **Auto-initialization**: Default Warm and Cold instances auto-initialize on first use (iOS). Android requires `Air.setWarmRootPath()` first.

2. **Listener pattern**: Register callbacks via `Air.addListener(id, config, callback)`. Native stores config, JS stores callbacks in a Map.

3. **Network state**: Stored in Warm storage under `sam-network` instance. Use `INTERNET_STATE` key for simple online/offline/online-weak status.

## Git Workflow

This repo uses **squash and merge**. Always create feature branches and PR into main. Before starting work or if your branch is behind, pull from main or rebase:

```bash
git checkout main && git pull
git checkout -b feature/my-change

# If branch gets behind main:
git fetch origin && git rebase origin/main
```

## CI/CD

PRs merged to `main` automatically:
1. Bump patch version via `npm version patch`
2. Commit with `[skip ci]` to prevent loops
3. Build and publish to npm

Requires `NPM_TOKEN` secret in GitHub Actions.
